import type { Book } from "../types";
import { updateBook } from "../data/repositories/library";
import { fetchBookMetadata, enrichMetadataWithGroq, downloadCoverAsBase64, type ExternalBookMetadata } from "./metadata";

export interface EnrichProgress {
  book: Book;
  status: "success" | "skipped" | "error";
  message: string;
}

/** A book is worth enriching if it's missing a cover, an ISBN, a Dewey code, or an Arabic title. */
export function findEnrichableBooks(allBooks: Book[]): Book[] {
  return allBooks.filter(
    (b) => (!b.cover_path && !b.cover_url) || (!b.isbn10 && !b.isbn13) || !b.dewey_code || !b.arabic_title
  );
}

/** Looks up one book against Google Books/Open Library (and Groq, if a key is configured) and
 * returns only the fields that were previously blank — existing data is never overwritten. */
export async function enrichBook(book: Book, opts: { groqApiKey?: string }): Promise<{ patch: Partial<Omit<Book, "author">>; notes: string[] }> {
  const notes: string[] = [];
  const patch: Partial<Omit<Book, "author">> = {};
  const query = book.isbn13 || book.isbn10 || [book.title, book.author].filter(Boolean).join(" ");

  let meta: ExternalBookMetadata | null = null;
  try {
    meta = await fetchBookMetadata(query);
  } catch {
    // No match from Google Books/Open Library — Groq (if enabled) may still fill in fields below.
  }

  if (opts.groqApiKey) {
    meta = await enrichMetadataWithGroq(query, meta || { title: book.title, language: book.language }, opts.groqApiKey);
  }

  if (!meta) {
    return { patch, notes: ["No metadata match found from any source."] };
  }

  if (!book.isbn10 && !book.isbn13 && (meta.isbn10 || meta.isbn13)) {
    if (meta.isbn10) patch.isbn10 = meta.isbn10;
    if (meta.isbn13) patch.isbn13 = meta.isbn13;
    notes.push("Filled ISBN.");
  }

  if (!book.dewey_code && meta.dewey_code) {
    patch.dewey_code = meta.dewey_code;
    notes.push(opts.groqApiKey ? "Dewey code is a Groq estimate; verify." : "Filled Dewey code from Open Library.");
  }

  if (!book.arabic_title && meta.arabic_title) {
    patch.arabic_title = meta.arabic_title;
    notes.push(opts.groqApiKey ? "Filled Arabic title via Groq translation." : "Filled Arabic title.");
  }

  if (!book.cover_path && !book.cover_url && meta.cover_url) {
    patch.cover_path = await downloadCoverAsBase64(meta.cover_url);
    notes.push("Downloaded cover image.");
  }

  return { patch, notes };
}

/** Runs enrichment one book at a time (never in parallel, with a short pause between requests)
 * so free-tier lookup APIs don't get hammered, reporting progress as it goes and allowing early
 * cancellation via `isCancelled`. */
export async function enrichAllBooks(
  targetBooks: Book[],
  opts: { groqApiKey?: string },
  onProgress: (p: EnrichProgress) => void,
  isCancelled: () => boolean
): Promise<void> {
  for (const book of targetBooks) {
    if (isCancelled()) break;
    try {
      const { patch, notes } = await enrichBook(book, opts);
      if (Object.keys(patch).length > 0) {
        await updateBook(book.id, patch);
        onProgress({ book, status: "success", message: notes.join(" ") });
      } else {
        onProgress({ book, status: "skipped", message: notes[0] || "Nothing new found." });
      }
    } catch (err: any) {
      onProgress({ book, status: "error", message: err?.message || String(err) });
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
}
