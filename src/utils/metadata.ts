/** Plain `fetch()` never times out on its own — a single unresponsive lookup (dead DNS, a
 * silently-hanging proxy, etc.) would otherwise stall the whole bulk-enrichment batch forever
 * on one book with no error and no way out. Aborts and rejects after `timeoutMs` instead. */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export interface ExternalBookMetadata {
  title: string;
  subtitle?: string;
  arabic_title?: string;
  tags?: string;
  author?: string;
  publisher?: string;
  publicationYear?: number;
  category?: string;
  language: string;
  description?: string;
  cover_url?: string | null;
  isbn10?: string | null;
  isbn13?: string | null;
  dewey_code?: string | null;
  /**
   * Fields Google Books/OpenLibrary did not return (used to show a clear "needs manual
   * entry" hint instead of silently leaving the field blank with no explanation — see
   * enrichMetadataWithGroq, which is the only thing that can actually fill these in).
   */
  unresolvedFields?: ("arabic_title" | "subtitle" | "description")[];
}

function cleanCategory(cat: string): string {
  if (!cat) return "";
  const parts = cat.split(",").map(p => p.trim());
  const filtered = parts.filter(p => {
    const l = p.toLowerCase();
    if (l.includes("translation")) return false;
    if (l.includes("voyage")) return false;
    if (l.includes("travel")) return false;
    if (l.includes("general")) return false;
    if (l.includes("textbook")) return false;
    if (l.includes("study guide")) return false;
    if (l.includes("handbook")) return false;
    return true;
  });
  if (filtered.length > 0) return filtered[0];
  return parts[0] || "";
}

function generateFallbackTags(title: string, category: string): string {
  const tags: string[] = [];
  const cleanCat = cleanCategory(category);
  if (cleanCat) {
    tags.push(cleanCat.toLowerCase());
  }
  
  const titleLower = title.toLowerCase();
  if (titleLower.includes("alchemist") || titleLower.includes("philosophy") || titleLower.includes("sina")) {
    tags.push("philosophy", "classic", "allegory");
  } else if (titleLower.includes("pride") || titleLower.includes("prejudice") || titleLower.includes("austen")) {
    tags.push("classic", "romance", "society");
  } else if (titleLower.includes("medicine") || titleLower.includes("anatomy") || titleLower.includes("health")) {
    tags.push("medical", "reference", "science");
  } else if (titleLower.includes("history") || titleLower.includes("civilization")) {
    tags.push("history", "non-fiction");
  } else if (titleLower.includes("novel") || titleLower.includes("story") || titleLower.includes("fiction")) {
    tags.push("fiction", "literature");
  }
  
  return Array.from(new Set(tags)).join(", ");
}

function extractIsbnsFromGoogleIdentifiers(identifiers?: { type: string; identifier: string }[]) {
  let isbn10: string | null = null;
  let isbn13: string | null = null;
  if (identifiers) {
    for (const id of identifiers) {
      if (id.type === "ISBN_10") isbn10 = id.identifier.replace(/[^0-9Xx]/g, "");
      if (id.type === "ISBN_13") isbn13 = id.identifier.replace(/[^0-9Xx]/g, "");
    }
  }
  return { isbn10, isbn13 };
}

function extractIsbnsFromOlArray(isbns?: string[]) {
  let isbn10: string | null = null;
  let isbn13: string | null = null;
  if (isbns) {
    for (const val of isbns) {
      const clean = val.replace(/[^0-9Xx]/g, "");
      if (clean.length === 10 && !isbn10) isbn10 = clean;
      if (clean.length === 13 && !isbn13) isbn13 = clean;
    }
  }
  return { isbn10, isbn13 };
}

export async function fetchBookMetadata(query: string): Promise<ExternalBookMetadata> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("Please enter a non-empty ISBN or search query.");
  }

  const clean = trimmed.replace(/[- ]/g, "");
  const queryIsIsbn = (clean.length === 10 || clean.length === 13) && /^\d+$/.test(clean.substring(0, 9));

  let googleMeta: Partial<ExternalBookMetadata> = {};
  let olMeta: Partial<ExternalBookMetadata> = {};

  const googlePromise = (async () => {
    try {
      const googleUrl = queryIsIsbn
        ? `https://www.googleapis.com/books/v1/volumes?q=isbn:${clean}`
        : `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(trimmed)}&maxResults=5`;
      const response = await fetchWithTimeout(googleUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.items && data.items.length > 0) {
          let chosenItem = data.items[0];
          if (!queryIsIsbn) {
            for (const item of data.items) {
              const idfs = item.volumeInfo?.industryIdentifiers;
              if (idfs && idfs.some((id: any) => id.type === "ISBN_10" || id.type === "ISBN_13")) {
                chosenItem = item;
                break;
              }
            }
          }
          const info = chosenItem.volumeInfo;
          let publicationYear: number | undefined;
          if (info.publishedDate) {
            const year = parseInt(info.publishedDate.substring(0, 4), 10);
            if (!isNaN(year)) publicationYear = year;
          }
          const cover = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || null;
          const { isbn10, isbn13 } = extractIsbnsFromGoogleIdentifiers(info.industryIdentifiers);
          googleMeta = {
            title: info.title || "",
            subtitle: info.subtitle || "",
            author: info.authors ? info.authors.join(", ") : "",
            publisher: info.publisher || "",
            publicationYear,
            category: info.categories ? info.categories.join(", ") : "",
            language: info.language === "en" ? "English" : info.language === "ar" ? "Arabic" : info.language === "fr" ? "French" : info.language || "English",
            description: info.description || "",
            cover_url: cover ? cover.replace("http://", "https://") : null,
            isbn10,
            isbn13
          };
        }
      }
    } catch (err) {
      console.error("Google Books metadata fetch failed", err);
    }
  })();

  const olPromise = (async () => {
    try {
      if (queryIsIsbn) {
        const olUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${clean}&jscmd=data&format=json`;
        const response = await fetchWithTimeout(olUrl);
        if (response.ok) {
          const data = await response.json();
          const bookKey = `ISBN:${clean}`;
          if (data[bookKey]) {
            const info = data[bookKey];
            let publicationYear: number | undefined;
            if (info.publish_date) {
              const match = info.publish_date.match(/\d{4}/);
              if (match) {
                const year = parseInt(match[0], 10);
                if (!isNaN(year)) publicationYear = year;
              }
            }
            const authorNames = info.authors ? info.authors.map((a: any) => a.name).join(", ") : "";
            const publisherNames = info.publishers ? info.publishers.map((p: any) => p.name).join(", ") : "";
            const categoryNames = info.subjects ? info.subjects.slice(0, 3).map((s: any) => s.name).join(", ") : "";
            const cover = info.cover?.large || info.cover?.medium || info.cover?.small || `https://covers.openlibrary.org/b/isbn/${clean}-L.jpg`;
            const deweyCode = info.classifications?.dewey_decimal_class?.[0] || null;
            olMeta = {
              title: info.title || "",
              subtitle: info.subtitle || "",
              author: authorNames,
              publisher: publisherNames,
              publicationYear,
              category: categoryNames,
              cover_url: cover,
              isbn10: clean.length === 10 ? clean : null,
              isbn13: clean.length === 13 ? clean : null,
              dewey_code: deweyCode
            };
          }
        }
      } else {
        const olUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(trimmed)}&limit=5`;
        const response = await fetchWithTimeout(olUrl);
        if (response.ok) {
          const data = await response.json();
          if (data.docs && data.docs.length > 0) {
            let doc = data.docs[0];
            for (const d of data.docs) {
              if (d.isbn && d.isbn.length > 0) {
                doc = d;
                break;
              }
            }
            let publicationYear: number | undefined;
            if (doc.first_publish_year) {
              publicationYear = doc.first_publish_year;
            } else if (doc.publish_year && doc.publish_year.length > 0) {
              publicationYear = doc.publish_year[0];
            }
            const authorNames = doc.author_name ? doc.author_name.join(", ") : "";
            const publisherNames = doc.publisher ? doc.publisher[0] : "";
            const categoryNames = doc.subject ? doc.subject.slice(0, 3).join(", ") : "";
            const { isbn10, isbn13 } = extractIsbnsFromOlArray(doc.isbn);
            const firstIsbn = isbn13 || isbn10;
            const cover = doc.cover_i 
              ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
              : firstIsbn 
                ? `https://covers.openlibrary.org/b/isbn/${firstIsbn}-L.jpg`
                : null;
            olMeta = {
              title: doc.title || "",
              subtitle: doc.subtitle || "",
              author: authorNames,
              publisher: publisherNames,
              publicationYear,
              category: categoryNames,
              cover_url: cover,
              isbn10,
              isbn13
            };
          }
        }
      }
    } catch (err) {
      console.error("Open Library metadata fetch failed", err);
    }
  })();

  await Promise.all([googlePromise, olPromise]);

  const title = googleMeta.title || olMeta.title || "";
  const category = cleanCategory(googleMeta.category || olMeta.category || "");
  const subtitle = googleMeta.subtitle || olMeta.subtitle || "";
  // Providers only ever return an Arabic title when the book's canonical title is
  // already in Arabic script \u2014 there is no translation happening here.
  const arabic_title = /[\u0600-\u06FF]/.test(title) ? title : "";
  const tags = generateFallbackTags(title, category);
  const description = googleMeta.description || olMeta.description || "";

  const finalIsbn10 = googleMeta.isbn10 || olMeta.isbn10 || null;
  const finalIsbn13 = googleMeta.isbn13 || olMeta.isbn13 || null;

  if (!title && !googleMeta.author && !olMeta.author) {
    throw new Error("Could not find any metadata matches for this query.");
  }

  let cover_url = googleMeta.cover_url || olMeta.cover_url || null;
  if (!cover_url && (finalIsbn13 || finalIsbn10)) {
    cover_url = `https://covers.openlibrary.org/b/isbn/${finalIsbn13 || finalIsbn10}-L.jpg`;
  }

  // Tracked so the UI can show a clear "needs manual entry" hint per field instead of a
  // silently blank input that looks like the lookup just didn't work this time.
  const unresolvedFields: ExternalBookMetadata["unresolvedFields"] = [];
  if (!arabic_title) unresolvedFields.push("arabic_title");
  if (!subtitle) unresolvedFields.push("subtitle");
  if (description.length < 30) unresolvedFields.push("description");

  return {
    title,
    subtitle,
    arabic_title,
    tags,
    author: googleMeta.author || olMeta.author || "",
    publisher: googleMeta.publisher || olMeta.publisher || "",
    publicationYear: googleMeta.publicationYear || olMeta.publicationYear,
    category,
    language: googleMeta.language || olMeta.language || "English",
    description,
    cover_url,
    isbn10: finalIsbn10,
    isbn13: finalIsbn13,
    dewey_code: googleMeta.dewey_code || olMeta.dewey_code || null,
    unresolvedFields
  };
}

export async function fetchBookMetadataByIsbn(isbn: string): Promise<ExternalBookMetadata> {
  return fetchBookMetadata(isbn);
}

export async function enrichMetadataWithGroq(
  queryOrIsbn: string,
  existingMetadata: Partial<ExternalBookMetadata>,
  apiKey: string
): Promise<ExternalBookMetadata> {
  if (!apiKey) {
    return {
      title: existingMetadata.title || "",
      subtitle: existingMetadata.subtitle || "",
      arabic_title: existingMetadata.arabic_title || "",
      tags: existingMetadata.tags || "",
      author: existingMetadata.author || "",
      publisher: existingMetadata.publisher || "",
      category: existingMetadata.category || "",
      language: existingMetadata.language || "English",
      description: existingMetadata.description || "",
      publicationYear: existingMetadata.publicationYear,
      cover_url: existingMetadata.cover_url || null,
      isbn10: existingMetadata.isbn10 || null,
      isbn13: existingMetadata.isbn13 || null,
      dewey_code: existingMetadata.dewey_code || null,
      unresolvedFields: existingMetadata.unresolvedFields || []
    };
  }

  const prompt = `You are a professional library cataloging assistant.
A book lookup for query or ISBN "${queryOrIsbn}" returned the following partial/existing information:
${JSON.stringify(existingMetadata, null, 2)}

Your task is to identify the book and fill in any missing or empty fields, or correct/refine existing ones if they are clearly incorrect or incomplete.
Specifically, you MUST return a valid JSON object with the following keys and values:
- "title": string (The official full title of the book)
- "subtitle": string (The subtitle of the book, otherwise empty string)
- "arabic_title": string (The official Arabic title of the book, or a translated Arabic title if the book is translated or originally in Arabic, otherwise empty string)
- "author": string (The author(s) of the book)
- "publisher": string (The publisher of the book)
- "category": string (A single general standard library category, e.g. "Fiction", "Philosophy", "Science", "History". Clean up and remove any translation/metadata noise)
- "tags": string (A comma-separated list of 3-6 highly descriptive tags/keywords, e.g. "classic, gothic, social commentary, female protagonist")
- "language": string (The primary language of the book, e.g. "English", "Arabic", "French")
- "description": string (A comprehensive, detailed description and summary of the book, 1-2 paragraphs, at least 100-200 words, including themes, plot, and historical value)
- "publicationYear": number (The 4-digit publication year of the book, as a number, or null if unknown)
- "isbn10": string (The 10-digit ISBN of the book containing only digits and X, or empty string if unknown)
- "isbn13": string (The 13-digit ISBN of the book containing only digits, or empty string if unknown)
- "dewey_code": string (Your best-estimate Dewey Decimal Classification number for this book's primary subject, e.g. "823.912" for a modern English novel, or empty string if you cannot reasonably estimate one. This is a librarian's estimate, not necessarily the exact number assigned by a cataloger.)

If Google/OpenLibrary returned nothing, use your knowledge about the book "${queryOrIsbn}" to fill in all the details.
Return ONLY the JSON object. Do not include any explanations, introduction, markdown blocks, or other text outside the JSON.`;

  try {
    const response = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Groq API error response:", errText);
      throw new Error(`Groq API returned status ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      const arabic_title = parsed.arabic_title || existingMetadata.arabic_title || "";
      const subtitle = parsed.subtitle || existingMetadata.subtitle || "";
      const description = parsed.description || existingMetadata.description || "";
      const unresolvedFields: ExternalBookMetadata["unresolvedFields"] = [];
      if (!arabic_title) unresolvedFields.push("arabic_title");
      if (!subtitle) unresolvedFields.push("subtitle");
      if (description.length < 30) unresolvedFields.push("description");
      return {
        title: parsed.title || existingMetadata.title || "",
        subtitle,
        arabic_title,
        tags: parsed.tags || existingMetadata.tags || "",
        author: parsed.author || existingMetadata.author || "",
        publisher: parsed.publisher || existingMetadata.publisher || "",
        category: parsed.category || existingMetadata.category || "",
        language: parsed.language || existingMetadata.language || "English",
        description,
        publicationYear: parsed.publicationYear ? Number(parsed.publicationYear) : existingMetadata.publicationYear,
        cover_url: existingMetadata.cover_url || null,
        isbn10: parsed.isbn10 || existingMetadata.isbn10 || null,
        isbn13: parsed.isbn13 || existingMetadata.isbn13 || null,
        dewey_code: parsed.dewey_code || existingMetadata.dewey_code || null,
        unresolvedFields
      };
    }
  } catch (error) {
    console.error("Failed to enrich metadata with Groq:", error);
  }

  return {
    title: existingMetadata.title || "",
    subtitle: existingMetadata.subtitle || "",
    arabic_title: existingMetadata.arabic_title || "",
    tags: existingMetadata.tags || "",
    author: existingMetadata.author || "",
    publisher: existingMetadata.publisher || "",
    category: existingMetadata.category || "",
    language: existingMetadata.language || "English",
    description: existingMetadata.description || "",
    publicationYear: existingMetadata.publicationYear,
    cover_url: existingMetadata.cover_url || null,
    isbn10: existingMetadata.isbn10 || null,
    isbn13: existingMetadata.isbn13 || null,
    dewey_code: existingMetadata.dewey_code || null,
    unresolvedFields: existingMetadata.unresolvedFields || []
  };
}

/** Fetches an image URL and converts it to a base64 data URL for storage as `cover_path`.
 * Falls back to returning the raw URL if the fetch fails (e.g. CORS/network issue), so callers
 * always get something to store rather than nothing. */
export async function downloadCoverAsBase64(coverUrl: string): Promise<string> {
  try {
    const response = await fetchWithTimeout(coverUrl);
    if (!response.ok) return coverUrl;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error("Cover image download failed", err);
    return coverUrl;
  }
}
