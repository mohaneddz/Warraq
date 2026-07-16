export interface ExternalBookMetadata {
  title: string;
  subtitle?: string;
  author?: string;
  publisher?: string;
  publicationYear?: number;
  category?: string;
  language: string;
  description?: string;
}

export async function fetchBookMetadataByIsbn(isbn: string): Promise<ExternalBookMetadata> {
  const cleanIsbn = isbn.replace(/[- ]/g, "").trim();
  if (!cleanIsbn) {
    throw new Error("Please enter a non-empty ISBN.");
  }

  // Attempt Google Books lookup first (generally has better description and category detail)
  try {
    const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`;
    const response = await fetch(googleUrl);
    if (response.ok) {
      const data = await response.json();
      if (data.items && data.items.length > 0) {
        const info = data.items[0].volumeInfo;
        
        let publicationYear: number | undefined;
        if (info.publishedDate) {
          const year = parseInt(info.publishedDate.substring(0, 4), 10);
          if (!isNaN(year)) publicationYear = year;
        }

        return {
          title: info.title || "",
          subtitle: info.subtitle || "",
          author: info.authors ? info.authors.join(", ") : "",
          publisher: info.publisher || "",
          publicationYear,
          category: info.categories ? info.categories.join(", ") : "",
          language: info.language === "en" ? "English" : info.language === "ar" ? "Arabic" : info.language === "fr" ? "French" : info.language || "English",
          description: info.description || ""
        };
      }
    }
  } catch (err) {
    console.error("Google Books metadata fetch failed", err);
  }

  // Fallback to Open Library
  try {
    const olUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&jscmd=data&format=json`;
    const response = await fetch(olUrl);
    if (response.ok) {
      const data = await response.json();
      const bookKey = `ISBN:${cleanIsbn}`;
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

        return {
          title: info.title || "",
          subtitle: info.subtitle || "",
          author: authorNames,
          publisher: publisherNames,
          publicationYear,
          category: categoryNames,
          language: "English", // Open Library data endpoint does not always supply clean language code directly in default payload
          description: ""
        };
      }
    }
  } catch (err) {
    console.error("Open Library metadata fetch failed", err);
  }

  throw new Error("Could not find any metadata matches for this ISBN.");
}

export async function enrichMetadataWithGroq(
  isbn: string,
  existingMetadata: Partial<ExternalBookMetadata>,
  apiKey: string
): Promise<ExternalBookMetadata> {
  if (!apiKey) {
    return {
      title: existingMetadata.title || "",
      subtitle: existingMetadata.subtitle || "",
      author: existingMetadata.author || "",
      publisher: existingMetadata.publisher || "",
      category: existingMetadata.category || "",
      language: existingMetadata.language || "English",
      description: existingMetadata.description || "",
      publicationYear: existingMetadata.publicationYear,
    };
  }

  const prompt = `You are a professional library cataloging assistant.
A book lookup for ISBN "${isbn}" returned the following partial/existing information:
${JSON.stringify(existingMetadata, null, 2)}

Your task is to identify the book and fill in any missing or empty fields, or correct/refine existing ones if they are clearly incorrect or incomplete.
Specifically, you MUST return a valid JSON object with the following keys and values:
- "title": string (The official full title of the book)
- "subtitle": string (The subtitle or translated Arabic title of the book if applicable, otherwise empty string)
- "author": string (The author(s) of the book)
- "publisher": string (The publisher of the book)
- "category": string (A comma-separated list of genres/categories/subjects, e.g. "Fiction, Romance, Historical")
- "language": string (The primary language of the book, e.g. "English", "Arabic", "French")
- "description": string (A concise summary description of the book, 1-3 sentences)
- "publicationYear": number (The 4-digit publication year of the book, as a number, or null if unknown)

If Google/OpenLibrary returned nothing, use your knowledge about the ISBN "${isbn}" to fill in all the details.
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
        author: parsed.author || existingMetadata.author || "",
        publisher: parsed.publisher || existingMetadata.publisher || "",
        category: parsed.category || existingMetadata.category || "",
        language: parsed.language || existingMetadata.language || "English",
        description: parsed.description || existingMetadata.description || "",
        publicationYear: parsed.publicationYear ? Number(parsed.publicationYear) : existingMetadata.publicationYear
      };
    }
  } catch (error) {
    console.error("Failed to enrich metadata with Groq:", error);
  }

  return {
    title: existingMetadata.title || "",
    subtitle: existingMetadata.subtitle || "",
    author: existingMetadata.author || "",
    publisher: existingMetadata.publisher || "",
    category: existingMetadata.category || "",
    language: existingMetadata.language || "English",
    description: existingMetadata.description || "",
    publicationYear: existingMetadata.publicationYear,
  };
}
