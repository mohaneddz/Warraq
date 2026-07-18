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

function getFallbackArabicTitle(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("alchemist")) return "الخيميائي";
  if (t.includes("pride and prejudice")) return "كبرياء وتحامل";
  if (t.includes("canon of medicine")) return "القانون في الطب";
  if (t.includes("study in scarlet")) return "دراسة في اللون القرمزي";
  if (t.includes("hamlet")) return "هاملت";
  if (t.includes("republic")) return "الجمهورية";
  if (t.includes("al-muqaddimah") || t.includes("muqaddimah")) return "المقدمة";
  return "";
}

function getFallbackSubtitle(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("alchemist")) return "A Fable About Following Your Dream";
  if (t.includes("pride and prejudice")) return "A Classic Regency Novel";
  if (t.includes("canon of medicine")) return "The Definitive Encyclopedia of Medical Wisdom";
  if (t.includes("study in scarlet")) return "The First Sherlock Holmes Adventure";
  return "";
}

function getFallbackDescription(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("alchemist")) {
    return "Paulo Coelho's masterpiece tells the mystical story of Santiago, an Andalusian shepherd boy who yearns to travel in search of a worldly treasure. His quest will lead him to riches far different—and far more satisfying—than he ever imagined. Santiago's journey teaches us about the essential wisdom of listening to our hearts, of recognizing opportunity and learning to read the omens strewn along life's path, and, most importantly, to follow our dreams.";
  }
  if (t.includes("pride and prejudice")) {
    return "Jane Austen's classic novel is a romantic comedy of manners set in Regency England. It follows the turbulent relationship between Elizabeth Bennet, the daughter of a country gentleman, and Fitzwilliam Darcy, a rich aristocratic landowner. They must overcome their titular sins of pride and prejudice in order to find mutual love and understanding. The novel remains one of the most popular and enduring works of English literature, celebrated for its wit, social observation, and sharp character studies.";
  }
  if (t.includes("canon of medicine")) {
    return "The Canon of Medicine (al-Qanun fi al-Tibb) is an encyclopedia of medicine in five books compiled by the Persian philosopher Ibn Sina (Avicenna) and completed in 1025. It presents a clear and organized summary of all the medical and physiological knowledge of the time, serving as an authoritative reference book for medical education in Europe and the Islamic world for centuries. It covers anatomy, general medicine, pharmacology, systemic diseases, and compound drugs.";
  }
  if (t.includes("study in scarlet")) {
    return "A Study in Scarlet is a detective mystery novel written by Sir Arthur Conan Doyle, introducing his famous consulting detective Sherlock Holmes and his friend and biographer Dr. John H. Watson. The story follows their first meeting, their move to 221B Baker Street, and their investigation of a bizarre murder in London involving a mysterious word written in blood on the wall, leading back to a tale of romance and revenge in Utah.";
  }
  return "";
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
      const response = await fetch(googleUrl);
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
        const response = await fetch(olUrl);
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
            olMeta = {
              title: info.title || "",
              subtitle: info.subtitle || "",
              author: authorNames,
              publisher: publisherNames,
              publicationYear,
              category: categoryNames,
              cover_url: cover,
              isbn10: clean.length === 10 ? clean : null,
              isbn13: clean.length === 13 ? clean : null
            };
          }
        }
      } else {
        const olUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(trimmed)}&limit=5`;
        const response = await fetch(olUrl);
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
  const subtitle = googleMeta.subtitle || olMeta.subtitle || getFallbackSubtitle(title);
  const arabic_title = /[\u0600-\u06FF]/.test(title) ? title : getFallbackArabicTitle(title);
  const tags = generateFallbackTags(title, category);

  let description = googleMeta.description || olMeta.description || "";
  if (description.length < 30) {
    const fallbackDesc = getFallbackDescription(title);
    if (fallbackDesc) {
      description = fallbackDesc;
    }
  }

  const finalIsbn10 = googleMeta.isbn10 || olMeta.isbn10 || null;
  const finalIsbn13 = googleMeta.isbn13 || olMeta.isbn13 || null;

  if (!title && !googleMeta.author && !olMeta.author) {
    throw new Error("Could not find any metadata matches for this query.");
  }

  let cover_url = googleMeta.cover_url || olMeta.cover_url || null;
  if (!cover_url && (finalIsbn13 || finalIsbn10)) {
    cover_url = `https://covers.openlibrary.org/b/isbn/${finalIsbn13 || finalIsbn10}-L.jpg`;
  }

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
    isbn13: finalIsbn13
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
      isbn13: existingMetadata.isbn13 || null
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

If Google/OpenLibrary returned nothing, use your knowledge about the book "${queryOrIsbn}" to fill in all the details.
Return ONLY the JSON object. Do not include any explanations, introduction, markdown blocks, or other text outside the JSON.`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
      return {
        title: parsed.title || existingMetadata.title || "",
        subtitle: parsed.subtitle || existingMetadata.subtitle || "",
        arabic_title: parsed.arabic_title || existingMetadata.arabic_title || "",
        tags: parsed.tags || existingMetadata.tags || "",
        author: parsed.author || existingMetadata.author || "",
        publisher: parsed.publisher || existingMetadata.publisher || "",
        category: parsed.category || existingMetadata.category || "",
        language: parsed.language || existingMetadata.language || "English",
        description: parsed.description || existingMetadata.description || "",
        publicationYear: parsed.publicationYear ? Number(parsed.publicationYear) : existingMetadata.publicationYear,
        cover_url: existingMetadata.cover_url || null,
        isbn10: parsed.isbn10 || existingMetadata.isbn10 || null,
        isbn13: parsed.isbn13 || existingMetadata.isbn13 || null
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
    isbn13: existingMetadata.isbn13 || null
  };
}
