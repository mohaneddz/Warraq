/**
 * Aggressive cover finder: for every catalogue record still missing a cover, search the web for
 * candidate images and have a vision model confirm which one is the ACTUAL cover of that exact
 * book before writing it. This is the heavy-duty complement to backfill_covers.mjs — use it for
 * the long tail that ISBN/title lookups can't resolve (medical texts, French/Arabic titles, etc).
 *
 * Pipeline per book:
 *   1. If a checksum-valid ISBN exists, try Google Books / Open Library first (exact + free).
 *   2. Otherwise (or if that misses) scrape image search (Bing, then DuckDuckGo) for candidates.
 *   3. Send each candidate to a vision model with the title + author and ask, strictly:
 *        "is this the front cover of THIS book?" → {is_cover, matches_book, confidence}
 *      Accept the first candidate that clears --min-confidence. A wrong cover is worse than none,
 *      so the bar is deliberately high and unverified candidates are discarded.
 *
 * Vision backend (OpenAI-compatible /chat/completions, defaults to Groq — same key as enrichment):
 *   GROQ_API_KEY   (required)  — or VISION_API_KEY to override
 *   VISION_BASE_URL            — default https://api.groq.com/openai/v1
 *   VISION_MODEL               — default meta-llama/llama-4-scout-17b-16e-instruct (multimodal)
 *
 * Usage:
 *   node scripts/find_covers.mjs --dry-run             # search + verify, write nothing
 *   node scripts/find_covers.mjs --limit 25            # cap how many books are touched
 *   node scripts/find_covers.mjs --min-confidence 0.8  # stricter acceptance (default 0.75)
 *   node scripts/find_covers.mjs --verbose             # log every candidate + verdict
 *   node scripts/find_covers.mjs                        # full run
 *
 * Safe to re-run: records that already have a cover are skipped.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// ---------------------------------------------------------------- flags
const flag = (name) => process.argv.includes(name);
const opt = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};

const DRY_RUN = flag("--dry-run");
const VERBOSE = flag("--verbose");
const LIMIT = Number(opt("--limit", "Infinity"));
const MIN_CONFIDENCE = Number(opt("--min-confidence", "0.75"));
const MAX_CANDIDATES = Number(opt("--max-candidates", "6"));
const CONCURRENCY = Number(opt("--concurrency", "3"));
const MIN_IMAGE_BYTES = 2000; // smaller than this is a placeholder/pixel, not a cover
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36";

// ---------------------------------------------------------------- env + clients
const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

if (!env.VITE_SUPABASE_URL || !env.SECRET_KEY) {
  console.error("Missing VITE_SUPABASE_URL or SECRET_KEY in App/.env");
  process.exit(1);
}

const VISION_KEY = env.VISION_API_KEY || env.GROQ_API_KEY;
const VISION_BASE_URL = env.VISION_BASE_URL || "https://api.groq.com/openai/v1";
const VISION_MODEL = env.VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";

if (!VISION_KEY) {
  console.error(
    "No vision API key found. Add GROQ_API_KEY (or VISION_API_KEY) to App/.env — the same\n" +
      "Groq key enrichment uses. Without it, candidates can't be verified and this script would\n" +
      "just guess, which is exactly what it's built to avoid."
  );
  process.exit(1);
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.SECRET_KEY, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------- ISBN helpers
const cleanIsbn = (v) => (v ?? "").replace(/[^0-9Xx]/g, "").toUpperCase();

function isValidIsbn10(s) {
  if (!/^\d{9}[\dX]$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += (s[i] === "X" ? 10 : Number(s[i])) * (10 - i);
  return sum % 11 === 0;
}
function isValidIsbn13(s) {
  if (!/^\d{13}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) sum += Number(s[i]) * (i % 2 ? 3 : 1);
  return sum % 10 === 0;
}
function validIsbnOf(book) {
  for (const raw of [book.isbn13, book.isbn10]) {
    const s = cleanIsbn(raw);
    if (s.length === 13 && isValidIsbn13(s)) return s;
    if (s.length === 10 && isValidIsbn10(s)) return s;
  }
  return null;
}

// ---------------------------------------------------------------- http helpers
async function fetchText(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "en,fr;q=0.8,ar;q=0.6" },
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, timeoutMs = 12000) {
  const txt = await fetchText(url, timeoutMs);
  if (!txt) return null;
  try {
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

/** Confirms a URL really serves a non-trivial image (not a blank placeholder or error page). */
async function isRealImage(url, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return false;
    if (!(res.headers.get("content-type") ?? "").startsWith("image/")) return false;
    const bytes = (await res.arrayBuffer()).byteLength;
    return bytes >= MIN_IMAGE_BYTES;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

const decodeEntities = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));

// ---------------------------------------------------------------- candidate sources

/** Bing Images embeds each result as `m="{...murl...}"` — pull the direct media URLs out. */
async function bingImages(query) {
  const html = await fetchText(
    `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`
  );
  if (!html) return [];
  const urls = [];
  const re = /murl&quot;:&quot;(.*?)&quot;/g;
  let m;
  while ((m = re.exec(html)) && urls.length < 25) {
    const url = decodeEntities(m[1]);
    if (/^https?:\/\//.test(url)) urls.push(url);
  }
  return urls;
}

/** DuckDuckGo image search needs a one-shot vqd token, then returns JSON results. */
async function duckImages(query) {
  const seed = await fetchText(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`);
  const vqd = seed && (seed.match(/vqd=["']?([\d-]+)["']?/) || seed.match(/vqd=([\d-]+)&/))?.[1];
  if (!vqd) return [];
  const json = await fetchJson(
    `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,&p=1`
  );
  return (json?.results ?? []).map((r) => r.image).filter((u) => /^https?:\/\//.test(u)).slice(0, 25);
}

const googleThumb = (info) => {
  const link = info?.imageLinks?.thumbnail ?? info?.imageLinks?.smallThumbnail;
  return link ? link.replace("http://", "https://").replace("&edge=curl", "") + "&zoom=1" : null;
};

/** Exact, free shortcuts when a checksum-valid ISBN is available — no vision call needed. */
async function isbnCover(isbn) {
  const g = await fetchJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1`);
  const gUrl = googleThumb(g?.items?.[0]?.volumeInfo);
  if (gUrl && (await isRealImage(gUrl))) return { url: gUrl, via: "google:isbn" };
  const ol = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
  if (await isRealImage(ol)) return { url: ol, via: "openlibrary:isbn" };
  return null;
}

// ---------------------------------------------------------------- vision verifier
async function verifyCover({ url, title, authors }) {
  const prompt =
    `You are verifying library book covers. The book is titled "${title}"` +
    (authors ? ` by ${authors}` : "") +
    `. Look at the image and decide if it is the FRONT COVER of this exact book ` +
    `(the title on the cover should match; author is a bonus signal). Reject stock photos, ` +
    `logos, author portraits, back covers, unrelated books, and banners. ` +
    `Reply with ONLY compact JSON: {"is_cover":bool,"matches_book":bool,"confidence":0..1,"reason":"short"}.`;

  const res = await fetch(`${VISION_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${VISION_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: VISION_MODEL,
      temperature: 0,
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 401) {
      console.error(`\n  Vision API returned 401 (Unauthorized) — the ${VISION_MODEL} key is invalid/expired.`);
      console.error("  Fix the Groq key (Settings → Integrations, or GROQ_API_KEY in .env) and re-run.\n");
      process.exit(1);
    }
    if (VERBOSE) console.warn(`      vision ${res.status}: ${body.slice(0, 120)}`);
    return { ok: false };
  }

  const json = await res.json().catch(() => null);
  const text = json?.choices?.[0]?.message?.content ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { ok: false };
  try {
    const v = JSON.parse(match[0]);
    return {
      ok: true,
      accept: v.is_cover === true && v.matches_book === true && Number(v.confidence) >= MIN_CONFIDENCE,
      confidence: Number(v.confidence) || 0,
      reason: v.reason ?? "",
    };
  } catch {
    return { ok: false };
  }
}

// ---------------------------------------------------------------- resolution
async function findCover(book) {
  const authors = book.book_authors.map((ba) => ba.authors.name).join(", ");
  const isbn = validIsbnOf(book);

  // 1) Exact ISBN shortcut (no vision spend).
  if (isbn) {
    const hit = await isbnCover(isbn);
    if (hit) return { ...hit, confidence: 1 };
  }

  // 2) Web image search → vision verification.
  const query = `${book.title} ${authors} book cover`.trim();
  const seen = new Set();
  const candidates = [];
  for (const src of [bingImages, duckImages]) {
    try {
      for (const url of await src(query)) {
        if (!seen.has(url)) {
          seen.add(url);
          candidates.push(url);
        }
      }
    } catch {
      /* source failed — try the next */
    }
    if (candidates.length >= MAX_CANDIDATES * 2) break;
  }

  let checked = 0;
  for (const url of candidates) {
    if (checked >= MAX_CANDIDATES) break;
    if (!(await isRealImage(url))) continue;
    checked++;
    const v = await verifyCover({ url, title: book.title, authors });
    if (!v.ok) continue;
    if (VERBOSE) console.log(`      [${v.confidence?.toFixed(2)}] ${v.accept ? "✓" : "·"} ${v.reason} — ${url.slice(0, 60)}`);
    if (v.accept) return { url, via: "web:vision", confidence: v.confidence };
  }
  return null;
}

// ---------------------------------------------------------------- main
const { data: books, error } = await supabase
  .from("books")
  .select("id, title, isbn13, isbn10, cover_url, book_authors ( authors ( name ) )")
  .is("archived_at", null)
  .order("title");

if (error) {
  console.error("Could not load books:", error.message);
  process.exit(1);
}

const withCover = books.filter((b) => b.cover_url?.trim()).length;
const pending = books.filter((b) => !b.cover_url?.trim()).slice(0, LIMIT);

console.log(`${books.length} catalogue records — ${withCover} already have covers, ${books.length - withCover} missing.`);
console.log(`Vision: ${VISION_MODEL} @ ${VISION_BASE_URL}`);
console.log(`Resolving ${pending.length}${DRY_RUN ? " (dry run — nothing will be written)" : ""}, min-confidence ${MIN_CONFIDENCE}...\n`);

const stats = { found: 0, missed: 0, written: 0, failed: 0, byVia: {} };
let cursor = 0;

async function worker() {
  while (cursor < pending.length) {
    const book = pending[cursor++];
    const n = String(cursor).padStart(3);
    let hit = null;
    try {
      hit = await findCover(book);
    } catch (err) {
      console.warn(`${n} !! ${book.title.slice(0, 45)} — ${String(err).slice(0, 60)}`);
    }

    if (!hit) {
      stats.missed++;
      console.log(`${n} ·  ${book.title.slice(0, 60)}`);
      continue;
    }

    stats.found++;
    stats.byVia[hit.via] = (stats.byVia[hit.via] ?? 0) + 1;
    console.log(`${n} ✓  [${hit.via} ${hit.confidence?.toFixed(2)}] ${book.title.slice(0, 50)}`);

    if (!DRY_RUN) {
      const { error: updateError } = await supabase.from("books").update({ cover_url: hit.url }).eq("id", book.id);
      if (updateError) {
        stats.failed++;
        console.warn(`        !! write failed: ${updateError.message}`);
      } else {
        stats.written++;
      }
    }
  }
}

await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));

const pct = pending.length ? Math.round((stats.found / pending.length) * 100) : 0;
console.log(`\n─────────────────────────────────────────────`);
console.log(`found ${stats.found}/${pending.length} (${pct}%)   missed ${stats.missed}`);
if (!DRY_RUN) console.log(`written ${stats.written}   failed ${stats.failed}`);
console.log(stats.byVia);
