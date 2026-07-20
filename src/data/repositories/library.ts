import { database } from "../database";
import type Database from "@tauri-apps/plugin-sql";
import { dueDate, today } from "../../utils/dates";
import type { Book, Copy, DashboardMetrics, Loan, Member, Reservation } from "../../types";
import { 
  normalizeIsbn, cleanBarcode, cleanAccession, 
  cleanPhone, cleanText, cleanMemberNumber 
} from "../../utils/isbn";

const id = () => crypto.randomUUID();
const timestamp = () => new Date().toISOString();

export async function dashboard(): Promise<DashboardMetrics> {
  const db = await database();
  const rows = await db.select<{ titles: number; copies: number; on_loan: number; members: number; overdue: number; ready: number }[]>(`SELECT
    (SELECT COUNT(*) FROM books WHERE archived_at IS NULL) titles,
    (SELECT COUNT(*) FROM copies WHERE status != 'archived') copies,
    (SELECT COUNT(*) FROM loans WHERE returned_at IS NULL) on_loan,
    (SELECT COUNT(*) FROM members WHERE status = 'active') members,
    (SELECT COUNT(*) FROM loans WHERE returned_at IS NULL AND due_at < date('now')) overdue,
    (SELECT COUNT(*) FROM reservations WHERE status = 'ready') ready`);
  
  const recentLoans = await db.select<Loan[]>(`
    SELECT l.*, b.title, m.full_name as member_name 
    FROM loans l 
    JOIN copies c ON l.copy_id = c.id 
    JOIN books b ON c.book_id = b.id 
    JOIN members m ON l.member_id = m.id 
    ORDER BY l.borrowed_at DESC LIMIT 5`);

  const overdueLoans = await db.select<Loan[]>(`
    SELECT l.*, b.title, m.full_name as member_name 
    FROM loans l 
    JOIN copies c ON l.copy_id = c.id 
    JOIN books b ON c.book_id = b.id 
    JOIN members m ON l.member_id = m.id 
    WHERE l.returned_at IS NULL AND l.due_at < date('now')
    ORDER BY l.due_at ASC LIMIT 5`);

  const activityRaw = await db.select<{ date: string; count: number }[]>(`
    SELECT date(borrowed_at) as date, COUNT(*) as count 
    FROM loans 
    WHERE borrowed_at >= date('now', '-6 days') 
    GROUP BY date(borrowed_at) 
    ORDER BY date ASC`);
    
  const activityMap = new Map<string, number>();
  activityRaw.forEach(r => activityMap.set(r.date, r.count));
  const activity = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    activity.push({ date: dateStr, count: activityMap.get(dateStr) || 0 });
  }

  const row = rows[0] ?? { titles: 0, copies: 0, on_loan: 0, members: 0, overdue: 0, ready: 0 };

  const activeDepartments = await db.select<{ name: string; count: number }[]>(`
    SELECT m.department as name, COUNT(l.id) as count 
    FROM loans l 
    JOIN members m ON m.id = l.member_id 
    WHERE m.department IS NOT NULL AND m.department != '' 
    GROUP BY m.department 
    ORDER BY count DESC 
    LIMIT 5`);

  const checkoutsRaw = await db.select<{ hour: string; count: number }[]>(`
    SELECT strftime('%H', borrowed_at) as hour, COUNT(*) as count 
    FROM loans 
    WHERE date(borrowed_at) = date('now') 
    GROUP BY hour`);

  const returnsRaw = await db.select<{ hour: string; count: number }[]>(`
    SELECT strftime('%H', returned_at) as hour, COUNT(*) as count 
    FROM loans 
    WHERE returned_at IS NOT NULL AND date(returned_at) = date('now') 
    GROUP BY hour`);

  const rhythmMap = new Map<number, { checkouts: number; returns: number }>();
  checkoutsRaw.forEach(r => {
    const h = parseInt(r.hour, 10);
    rhythmMap.set(h, { checkouts: r.count, returns: 0 });
  });
  returnsRaw.forEach(r => {
    const h = parseInt(r.hour, 10);
    const existing = rhythmMap.get(h) ?? { checkouts: 0, returns: 0 };
    existing.returns = r.count;
    rhythmMap.set(h, existing);
  });

  const circulationRhythm = [
    { time: '8 AM', checkouts: rhythmMap.get(8)?.checkouts ?? 0, returns: rhythmMap.get(8)?.returns ?? 0 },
    { time: '10 AM', checkouts: rhythmMap.get(10)?.checkouts ?? 0, returns: rhythmMap.get(10)?.returns ?? 0 },
    { time: '12 PM', checkouts: rhythmMap.get(12)?.checkouts ?? 0, returns: rhythmMap.get(12)?.returns ?? 0 },
    { time: '2 PM', checkouts: rhythmMap.get(14)?.checkouts ?? 0, returns: rhythmMap.get(14)?.returns ?? 0 },
    { time: '4 PM', checkouts: rhythmMap.get(16)?.checkouts ?? 0, returns: rhythmMap.get(16)?.returns ?? 0 },
    { time: '6 PM', checkouts: rhythmMap.get(18)?.checkouts ?? 0, returns: rhythmMap.get(18)?.returns ?? 0 },
  ];

  return { 
    titles: row.titles, copies: row.copies, onLoan: row.on_loan, members: row.members, overdue: row.overdue, readyReservations: row.ready,
    recentLoans, overdueLoans, activity, activeDepartments, circulationRhythm
  };
}


export async function books(query = "", itemType = ""): Promise<Book[]> {
  const db = await database();
  const term = `%${query.trim()}%`;
  const filterType = itemType && itemType !== "All Items" && itemType !== "All" ? itemType : "";
  return db.select<Book[]>(
    `SELECT b.*, p.name publisher, c.name category, 
     (SELECT GROUP_CONCAT(a.name, ', ') FROM book_authors ba JOIN authors a ON a.id=ba.author_id WHERE ba.book_id=b.id) author,
     (SELECT GROUP_CONCAT(t.name, ', ') FROM book_tags bt JOIN tags t ON t.id=bt.tag_id WHERE bt.book_id=b.id) tags,
     (SELECT COUNT(*) FROM copies WHERE book_id=b.id) total_copies,
     (SELECT COUNT(*) FROM copies WHERE book_id=b.id AND status='available') available_copies
     FROM books b 
     LEFT JOIN publishers p ON p.id=b.publisher_id 
     LEFT JOIN categories c ON c.id=b.category_id 
     WHERE b.archived_at IS NULL 
     AND (?='' OR b.item_type = ?)
     AND (?='' OR b.title LIKE ? OR b.arabic_title LIKE ? OR b.subtitle LIKE ? OR b.isbn13 LIKE ? OR b.isbn10 LIKE ? OR EXISTS (SELECT 1 FROM book_authors ba JOIN authors a ON a.id=ba.author_id WHERE ba.book_id=b.id AND a.name LIKE ?)) 
     ORDER BY b.title`,
    [filterType, filterType, query.trim(), term, term, term, term, term, term]
  );
}

export async function saveBook(input: Omit<Book, "id" | "created_at"> & { author?: string; barcode?: string; accession?: string }): Promise<void> {
  const db = await database(); const bookId = id(); const now = timestamp();
  const title = cleanText(input.title);
  const itemType = input.item_type ? cleanText(input.item_type) : "book";
  const subtitle = input.subtitle ? cleanText(input.subtitle) : null;
  const arabicTitle = input.arabic_title ? cleanText(input.arabic_title) : null;
  const author = input.author ? cleanText(input.author) : null;
  const publisher = input.publisher ? cleanText(input.publisher) : null;
  const category = input.category ? cleanText(input.category) : null;
  const barcode = input.barcode ? cleanBarcode(input.barcode) : null;
  const accession = input.accession ? cleanAccession(input.accession) : null;
  const description = input.description ? cleanText(input.description) : null;
  const tags = input.tags ? cleanText(input.tags) : null;
  const isbn10 = input.isbn10 ? normalizeIsbn(input.isbn10) : null;
  const isbn13 = input.isbn13 ? normalizeIsbn(input.isbn13) : null;
  const language = cleanText(input.language);
  const callNumber = input.call_number ? cleanText(input.call_number) : null;

  let publisherId: string | null = null;
  if (publisher) { const existing = await db.select<{ id: string }[]>("SELECT id FROM publishers WHERE name=?", [publisher]); publisherId = existing[0]?.id ?? id(); if (!existing[0]) await db.execute("INSERT INTO publishers (id,name,created_at,updated_at) VALUES (?,?,?,?)", [publisherId, publisher, now, now]); }
  let categoryId: string | null = null;
  if (category) { const existing = await db.select<{ id: string }[]>("SELECT id FROM categories WHERE name=?", [category]); categoryId = existing[0]?.id ?? id(); if (!existing[0]) await db.execute("INSERT INTO categories (id,name) VALUES (?,?)", [categoryId, category]); }
  await db.execute("INSERT INTO books (id,item_type,isbn10,isbn13,title,subtitle,arabic_title,description,language,publisher_id,category_id,call_number,cover_path,source,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [bookId, itemType, isbn10, isbn13, title, subtitle, arabicTitle, description, language, publisherId, categoryId, callNumber, input.cover_path ?? null, "manual", now, now]);
  if (author) { const normalized = author.toLocaleLowerCase(); const existing = await db.select<{ id: string }[]>("SELECT id FROM authors WHERE normalized_name=?", [normalized]); const authorId = existing[0]?.id ?? id(); if (!existing[0]) await db.execute("INSERT INTO authors (id,name,normalized_name,created_at,updated_at) VALUES (?,?,?,?,?)", [authorId, author, normalized, now, now]); await db.execute("INSERT INTO book_authors (book_id,author_id,author_order) VALUES (?,?,0)", [bookId, authorId]); }
  if (barcode || accession) {
    const finalAccession = await ensureUniqueAccession(db, accession);
    const finalBarcode = await ensureUniqueBarcode(db, barcode, finalAccession);
    await db.execute("INSERT INTO copies (id,book_id,accession_number,barcode,status,condition,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)", [id(), bookId, finalAccession, finalBarcode, "available", "good", now, now]);
  }
  
  // Save tags relation
  if (tags) {
    const tagsList = tags.split(",").map(t => t.trim()).filter(Boolean);
    for (const tagName of tagsList) {
      const existingTag = await db.select<{ id: string }[]>("SELECT id FROM tags WHERE name = ?", [tagName]);
      let tagId = existingTag[0]?.id;
      if (!tagId) {
        tagId = id();
        const colors = ["#FEE2E2", "#FEF3C7", "#D1FAE5", "#DBEAFE", "#E0E7FF", "#F3E8FF", "#FCE7F3"];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        await db.execute("INSERT INTO tags (id, name, color) VALUES (?, ?, ?)", [tagId, tagName, randomColor]);
      }
      await db.execute("INSERT OR IGNORE INTO book_tags (book_id, tag_id) VALUES (?, ?)", [bookId, tagId]);
    }
  }

  await audit(db, "create", "book", bookId, null, JSON.stringify({ title }));
}

export async function updateBook(bookId: string, input: Partial<Book> & { author?: string }): Promise<void> {
  const db = await database();
  const now = timestamp();
    let publisherId: string | null | undefined = undefined;
    if (input.publisher !== undefined) {
      if (input.publisher?.trim()) {
        const cleanPub = cleanText(input.publisher);
        const existing = await db.select<{ id: string }[]>("SELECT id FROM publishers WHERE name=?", [cleanPub]);
        publisherId = existing[0]?.id ?? id();
        if (!existing[0]) {
          await db.execute("INSERT INTO publishers (id,name,created_at,updated_at) VALUES (?,?,?,?)", [publisherId, cleanPub, now, now]);
        }
      } else {
        publisherId = null;
      }
    }

    let categoryId: string | null | undefined = undefined;
    if (input.category !== undefined) {
      if (input.category?.trim()) {
        const cleanCat = cleanText(input.category);
        const existing = await db.select<{ id: string }[]>("SELECT id FROM categories WHERE name=?", [cleanCat]);
        categoryId = existing[0]?.id ?? id();
        if (!existing[0]) {
          await db.execute("INSERT INTO categories (id,name) VALUES (?,?)", [categoryId, cleanCat]);
        }
      } else {
        categoryId = null;
      }
    }

    const fields: string[] = [];
    const params: any[] = [];
    if (input.title !== undefined) { fields.push("title = ?"); params.push(cleanText(input.title)); }
    if (input.item_type !== undefined) { fields.push("item_type = ?"); params.push(cleanText(input.item_type)); }
    if (input.subtitle !== undefined) { fields.push("subtitle = ?"); params.push(input.subtitle ? cleanText(input.subtitle) : null); }
    if (input.arabic_title !== undefined) { fields.push("arabic_title = ?"); params.push(input.arabic_title ? cleanText(input.arabic_title) : null); }
    if (input.description !== undefined) { fields.push("description = ?"); params.push(input.description ? cleanText(input.description) : null); }
    if (input.language !== undefined) { fields.push("language = ?"); params.push(cleanText(input.language)); }
    if (input.publication_year !== undefined) { fields.push("publication_year = ?"); params.push(input.publication_year); }
    if (input.call_number !== undefined) { fields.push("call_number = ?"); params.push(input.call_number ? cleanText(input.call_number) : null); }
    if (input.isbn10 !== undefined) { fields.push("isbn10 = ?"); params.push(input.isbn10 ? normalizeIsbn(input.isbn10) : null); }
    if (input.isbn13 !== undefined) { fields.push("isbn13 = ?"); params.push(input.isbn13 ? normalizeIsbn(input.isbn13) : null); }
    if (input.cover_path !== undefined) { fields.push("cover_path = ?"); params.push(input.cover_path); }
    if (publisherId !== undefined) { fields.push("publisher_id = ?"); params.push(publisherId); }
    if (categoryId !== undefined) { fields.push("category_id = ?"); params.push(categoryId); }
    
    fields.push("updated_at = ?");
    params.push(now);

    if (fields.length > 0) {
      params.push(bookId);
      await db.execute(`UPDATE books SET ${fields.join(", ")} WHERE id = ?`, params);
    }

    if (input.author !== undefined) {
      await db.execute("DELETE FROM book_authors WHERE book_id = ?", [bookId]);
      if (input.author.trim()) {
        const cleanAuth = cleanText(input.author);
        const normalized = cleanAuth.toLowerCase();
        const existing = await db.select<{ id: string }[]>("SELECT id FROM authors WHERE normalized_name=?", [normalized]);
        const authorId = existing[0]?.id ?? id();
        if (!existing[0]) {
          await db.execute("INSERT INTO authors (id,name,normalized_name,created_at,updated_at) VALUES (?,?,?,?,?)", [authorId, cleanAuth, normalized, now, now]);
        }
        await db.execute("INSERT INTO book_authors (book_id,author_id,author_order) VALUES (?,?,0)", [bookId, authorId]);
      }
    }

    if (input.tags !== undefined) {
      await db.execute("DELETE FROM book_tags WHERE book_id = ?", [bookId]);
      if (input.tags?.trim()) {
        const cleanT = cleanText(input.tags);
        const tagsList = cleanT.split(",").map(t => t.trim()).filter(Boolean);
        for (const tagName of tagsList) {
          const existingTag = await db.select<{ id: string }[]>("SELECT id FROM tags WHERE name = ?", [tagName]);
          let tagId = existingTag[0]?.id;
          if (!tagId) {
            tagId = id();
            const colors = ["#FEE2E2", "#FEF3C7", "#D1FAE5", "#DBEAFE", "#E0E7FF", "#F3E8FF", "#FCE7F3"];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            await db.execute("INSERT INTO tags (id, name, color) VALUES (?, ?, ?)", [tagId, tagName, randomColor]);
          }
          await db.execute("INSERT OR IGNORE INTO book_tags (book_id, tag_id) VALUES (?, ?)", [bookId, tagId]);
        }
      }
    }

    await audit(db, "update", "book", bookId, null, JSON.stringify(input));
}

export async function deleteBook(bookId: string): Promise<void> {
  const db = await database();
  const now = timestamp();
  await db.execute("UPDATE books SET archived_at = ?, updated_at = ? WHERE id = ?", [now, now, bookId]);
  await db.execute("UPDATE copies SET status = 'archived', updated_at = ? WHERE book_id = ?", [now, bookId]);
}

export async function getCopiesForBook(bookId: string): Promise<Copy[]> {
  const db = await database();
  return db.select<Copy[]>(`
    SELECT c.*, s.code as shelf 
    FROM copies c 
    LEFT JOIN shelves s ON s.id=c.shelf_id 
    WHERE c.book_id = ? AND c.status != 'archived'
  `, [bookId]);
}

async function ensureUniqueBarcode(db: Database, inputBarcode?: string | null, accessionNumber?: string | null, excludeCopyId?: string): Promise<string> {
  const cleanB = inputBarcode ? cleanBarcode(inputBarcode) : "";
  if (cleanB) {
    const query = excludeCopyId 
      ? "SELECT id FROM copies WHERE barcode = ? AND id != ?" 
      : "SELECT id FROM copies WHERE barcode = ?";
    const params = excludeCopyId ? [cleanB, excludeCopyId] : [cleanB];
    const existing = await db.select<{ id: string }[]>(query, params);
    if (existing.length > 0) {
      throw new Error(`A copy with barcode "${cleanB}" already exists in the system. Please use a unique barcode.`);
    }
    return cleanB;
  }
  
  const baseAccession = accessionNumber ? cleanAccession(accessionNumber) : "";
  let baseBarcode = baseAccession ? `BAR-${baseAccession}` : `BAR-${id().substring(0, 8).toUpperCase()}`;
  
  let existing = await db.select<{ id: string }[]>("SELECT id FROM copies WHERE barcode = ?", [baseBarcode]);
  if (!existing[0]) return baseBarcode;

  let attempt = 0;
  while (existing[0] && attempt < 10) {
    baseBarcode = `BAR-${baseAccession || 'CPY'}-${id().substring(0, 6).toUpperCase()}`;
    existing = await db.select<{ id: string }[]>("SELECT id FROM copies WHERE barcode = ?", [baseBarcode]);
    attempt++;
  }
  return baseBarcode;
}

async function ensureUniqueAccession(db: Database, inputAccession?: string | null, excludeCopyId?: string): Promise<string> {
  const cleanA = inputAccession ? cleanAccession(inputAccession) : "";
  if (cleanA) {
    const query = excludeCopyId 
      ? "SELECT id FROM copies WHERE accession_number = ? AND id != ?" 
      : "SELECT id FROM copies WHERE accession_number = ?";
    const params = excludeCopyId ? [cleanA, excludeCopyId] : [cleanA];
    const existing = await db.select<{ id: string }[]>(query, params);
    if (existing.length > 0) {
      throw new Error(`A copy with index/accession "${cleanA}" already exists in the system. Please use a unique index.`);
    }
    return cleanA;
  }

  let baseAccession = `ACC-${id().substring(0, 8).toUpperCase()}`;
  let existing = await db.select<{ id: string }[]>("SELECT id FROM copies WHERE accession_number = ?", [baseAccession]);
  let attempt = 0;
  while (existing[0] && attempt < 10) {
    baseAccession = `ACC-${id().substring(0, 8).toUpperCase()}`;
    existing = await db.select<{ id: string }[]>("SELECT id FROM copies WHERE accession_number = ?", [baseAccession]);
    attempt++;
  }
  return baseAccession;
}

export async function addCopy(bookId: string, barcode: string, accessionNumber: string, condition: string, shelfCode?: string | null): Promise<void> {
  const db = await database();
  const now = timestamp();
  
  let shelfId: string | null = null;
  if (shelfCode?.trim()) {
    const cleanShelf = cleanText(shelfCode);
    const existing = await db.select<{ id: string }[]>("SELECT id FROM shelves WHERE code = ?", [cleanShelf]);
    shelfId = existing[0]?.id ?? id();
    if (!existing[0]) {
      await db.execute("INSERT INTO shelves (id, code, capacity, created_at, updated_at) VALUES (?, ?, 50, ?, ?)", [shelfId, cleanShelf, now, now]);
    }
  }

  const finalAccession = await ensureUniqueAccession(db, accessionNumber);
  const finalBarcode = await ensureUniqueBarcode(db, barcode, finalAccession);

  await db.execute("INSERT INTO copies (id,book_id,accession_number,barcode,shelf_id,status,condition,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)", 
    [id(), bookId, finalAccession, finalBarcode, shelfId, "available", condition, now, now]);
}

export async function updateCopy(copyId: string, updates: Partial<Copy> & { shelf?: string | null }): Promise<void> {
  const db = await database();
  const now = timestamp();
  const fields: string[] = [];
  const params: any[] = [];
  
  if (updates.status !== undefined) { fields.push("status = ?"); params.push(updates.status); }
  if (updates.condition !== undefined) { fields.push("condition = ?"); params.push(updates.condition); }
  if (updates.barcode !== undefined && updates.barcode) {
    const finalBarcode = await ensureUniqueBarcode(db, updates.barcode, undefined, copyId);
    fields.push("barcode = ?");
    params.push(finalBarcode);
  }
  if (updates.accession_number !== undefined && updates.accession_number) {
    const finalAccession = await ensureUniqueAccession(db, updates.accession_number, copyId);
    fields.push("accession_number = ?");
    params.push(finalAccession);
  }
  
  if (updates.shelf !== undefined) {
    let shelfId: string | null = null;
    if (updates.shelf && updates.shelf.trim()) {
      const existing = await db.select<{ id: string }[]>("SELECT id FROM shelves WHERE code = ?", [updates.shelf.trim()]);
      shelfId = existing[0]?.id ?? id();
      if (!existing[0]) {
        await db.execute("INSERT INTO shelves (id, code, capacity, created_at, updated_at) VALUES (?, ?, 50, ?, ?)", [shelfId, updates.shelf.trim(), now, now]);
      }
    }
    fields.push("shelf_id = ?");
    params.push(shelfId);
  }
  
  fields.push("updated_at = ?");
  params.push(now);
  
  params.push(copyId);
  await db.execute(`UPDATE copies SET ${fields.join(", ")} WHERE id = ?`, params);
}


export async function deleteCopy(copyId: string): Promise<void> {
  const db = await database();
  const now = timestamp();
  await db.execute("UPDATE copies SET status = 'archived', updated_at = ? WHERE id = ?", [now, copyId]);
}

export async function members(query = ""): Promise<Member[]> {
  const db = await database();
  const term = `%${query.trim()}%`;
  return db.select<Member[]>("SELECT * FROM members WHERE archived_at IS NULL AND (?='' OR full_name LIKE ? OR member_number LIKE ? OR email LIKE ? OR department LIKE ?) ORDER BY full_name", [query.trim(), term, term, term, term]);
}

export async function saveMember(input: Omit<Member, "id" | "member_number" | "joined_at"> & { member_number?: string }): Promise<void> {
  const db = await database();
  const now = timestamp();
  const memberNumber = input.member_number?.trim() 
    ? cleanMemberNumber(input.member_number) 
    : `MB-${String(Date.now()).slice(-6)}`;
  const fullName = cleanText(input.full_name);
  const email = input.email ? cleanText(input.email) : null;
  const phone = input.phone ? cleanPhone(input.phone) : null;
  const department = input.department ? cleanText(input.department) : null;
  const role = input.role ? cleanText(input.role) : null;
  await db.execute("INSERT INTO members (id,member_number,full_name,email,phone,department,role,status,expiry_date,avatar_path,joined_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [id(), memberNumber, fullName, email, phone, department, role, input.status, input.expiry_date ?? null, input.avatar_path ?? null, today(), now, now]);
}

export async function updateMember(memberId: string, updates: Partial<Member>): Promise<void> {
  const db = await database();
  const now = timestamp();
  const fields: string[] = [];
  const params: any[] = [];
  
  if (updates.full_name !== undefined) { fields.push("full_name = ?"); params.push(cleanText(updates.full_name)); }
  if (updates.email !== undefined) { fields.push("email = ?"); params.push(updates.email ? cleanText(updates.email) : null); }
  if (updates.phone !== undefined) { fields.push("phone = ?"); params.push(updates.phone ? cleanPhone(updates.phone) : null); }
  if (updates.department !== undefined) { fields.push("department = ?"); params.push(updates.department ? cleanText(updates.department) : null); }
  if (updates.role !== undefined) { fields.push("role = ?"); params.push(updates.role ? cleanText(updates.role) : null); }
  if (updates.status !== undefined) { fields.push("status = ?"); params.push(updates.status); }
  if (updates.expiry_date !== undefined) { fields.push("expiry_date = ?"); params.push(updates.expiry_date); }
  if (updates.avatar_path !== undefined) { fields.push("avatar_path = ?"); params.push(updates.avatar_path); }
  
  fields.push("updated_at = ?");
  params.push(now);
  
  params.push(memberId);
  await db.execute(`UPDATE members SET ${fields.join(", ")} WHERE id = ?`, params);
}

export async function deleteMember(memberId: string): Promise<void> {
  const db = await database();
  const now = timestamp();
  await db.execute("UPDATE members SET archived_at = ?, status = 'archived', updated_at = ? WHERE id = ?", [now, now, memberId]);
}

export async function copies(query = ""): Promise<(Copy & { title: string })[]> {
  const db = await database();
  const term = `%${query.trim()}%`;
  return db.select<(Copy & { title: string })[]>("SELECT c.*,b.title, s.code as shelf FROM copies c JOIN books b ON b.id=c.book_id LEFT JOIN shelves s ON s.id=c.shelf_id WHERE (?='' OR c.barcode LIKE ? OR c.accession_number LIKE ? OR b.title LIKE ?) ORDER BY b.title", [query.trim(), term, term, term]);
}

export async function loans(openOnly = false): Promise<Loan[]> {
  const db = await database();
  return db.select<Loan[]>(`SELECT l.*, b.title, c.barcode, m.full_name member_name FROM loans l JOIN copies c ON c.id=l.copy_id JOIN books b ON b.id=c.book_id JOIN members m ON m.id=l.member_id ${openOnly ? "WHERE l.returned_at IS NULL" : ""} ORDER BY l.borrowed_at DESC`);
}

export async function getLoansForMember(memberId: string): Promise<Loan[]> {
  const db = await database();
  return db.select<Loan[]>("SELECT l.*, b.title, c.barcode FROM loans l JOIN copies c ON c.id=l.copy_id JOIN books b ON b.id=c.book_id WHERE l.member_id = ? ORDER BY l.borrowed_at DESC", [memberId]);
}

export async function getReservationsForMember(memberId: string): Promise<Reservation[]> {
  const db = await database();
  return db.select<Reservation[]>("SELECT r.*, b.title FROM reservations r JOIN books b ON b.id=r.book_id WHERE r.member_id = ? ORDER BY r.reserved_at DESC", [memberId]);
}

export async function checkout(memberId: string, copyIds: string[], limit: number, days: number): Promise<void> {
  const db = await database();
  const now = timestamp();
    const member = await db.select<Member[]>("SELECT * FROM members WHERE id=?", [memberId]);
    if (member[0]?.status !== "active") throw new Error("Only active members can borrow.");
    const active = await db.select<{ count: number }[]>("SELECT COUNT(*) count FROM loans WHERE member_id=? AND returned_at IS NULL", [memberId]);
    if ((active[0]?.count ?? 0) + copyIds.length > limit) throw new Error(`Loan limit of ${limit} would be exceeded.`);
    for (const copyId of copyIds) {
      const copy = await db.select<Copy[]>("SELECT * FROM copies WHERE id=?", [copyId]);
      if (copy[0]?.status !== "available") throw new Error("Each selected copy must be available.");
      await db.execute("INSERT INTO loans (id,copy_id,member_id,borrowed_at,due_at,renewed_count,issued_by) VALUES (?,?,?,?,?,?,?)", [id(), copyId, memberId, now, dueDate(days), 0, "local-operator"]);
      await db.execute("UPDATE copies SET status='on-loan',updated_at=? WHERE id=?", [now, copyId]);
    }
    await audit(db, "checkout", "loan", memberId, null, JSON.stringify({ copyIds }));
}

export async function returnCopies(copyIds: string[], holdDays = 3): Promise<void> {
  const db = await database();
  const now = timestamp();
    for (const copyId of copyIds) {
      const loan = await db.select<Loan[]>("SELECT * FROM loans WHERE copy_id=? AND returned_at IS NULL", [copyId]);
      if (!loan[0]) throw new Error("No open loan was found for this copy.");
      await db.execute("UPDATE loans SET returned_at=?,received_by=? WHERE id=?", [now, "local-operator", loan[0].id]);
      const reserve = await db.select<Reservation[]>("SELECT * FROM reservations WHERE book_id=(SELECT book_id FROM copies WHERE id=?) AND status='queued' ORDER BY position,reserved_at LIMIT 1", [copyId]);
      if (reserve[0]) {
        await db.execute("UPDATE reservations SET status='ready',expires_at=? WHERE id=?", [dueDate(holdDays), reserve[0].id]);
        await db.execute("UPDATE copies SET status='reserved',updated_at=? WHERE id=?", [now, copyId]);
      } else {
        await db.execute("UPDATE copies SET status='available',updated_at=? WHERE id=?", [now, copyId]);
      }
    }
    await audit(db, "return", "loan", copyIds.join(","), null, JSON.stringify({ copyIds }));
}

export async function renewLoan(loanId: string, days: number): Promise<void> {
  const db = await database();
    const loan = await db.select<Loan[]>("SELECT * FROM loans WHERE id = ?", [loanId]);
    if (!loan[0]) throw new Error("Loan not found");
    
    const currentDueDate = new Date(loan[0].due_at);
    const baseDate = currentDueDate > new Date() ? currentDueDate : new Date();
    baseDate.setDate(baseDate.getDate() + days);
    const newDueDate = baseDate.toISOString().split('T')[0];
    
    await db.execute("UPDATE loans SET due_at = ?, renewed_count = renewed_count + 1 WHERE id = ?", [newDueDate, loanId]);
    await audit(db, "renew", "loan", loanId, null, JSON.stringify({ old_due: loan[0].due_at, new_due: newDueDate }));
}

export async function cancelReservation(reservationId: string): Promise<void> {
  const db = await database();
  await db.execute("UPDATE reservations SET status = 'cancelled' WHERE id = ?", [reservationId]);
}

export async function reservations(): Promise<Reservation[]> {
  const db = await database();
  return db.select<Reservation[]>("SELECT r.*,b.title,m.full_name member_name FROM reservations r JOIN books b ON b.id=r.book_id JOIN members m ON m.id=r.member_id ORDER BY r.status,r.position,r.reserved_at");
}

export async function addReservation(bookId: string, memberId: string): Promise<void> {
  const db = await database();
  const rows = await db.select<{ next: number }[]>("SELECT COALESCE(MAX(position),0)+1 next FROM reservations WHERE book_id=? AND status='queued'", [bookId]);
  await db.execute("INSERT INTO reservations (id,book_id,member_id,status,position,reserved_at) VALUES (?,?,?,?,?,?)", [id(), bookId, memberId, "queued", rows[0]?.next ?? 1, timestamp()]);
}

export async function auditLog() {
  const db = await database();
  return db.select<{ id: string; actor: string; action: string; entity_type: string; entity_id: string; created_at: string; after_json?: string }[]>("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 250");
}

async function audit(db: Database, action: string, entityType: string, entityId: string, before: string | null, after: string | null) {
  await db.execute("INSERT INTO audit_logs (id,actor,action,entity_type,entity_id,before_json,after_json,created_at) VALUES (?,?,?,?,?,?,?,?)", [id(), "local-operator", action, entityType, entityId, before, after, timestamp()]);
}

export async function importBooksFromDb(dbPath: string): Promise<{ importedCount: number }> {
  const db = await database();
  await db.execute("ATTACH DATABASE ? AS source_db", [dbPath]);
  try {
    const newBooks = await db.select<any[]>(
      "SELECT id FROM source_db.books WHERE id NOT IN (SELECT id FROM main.books)"
    );

    await db.execute("INSERT OR IGNORE INTO main.publishers SELECT * FROM source_db.publishers");
    await db.execute("INSERT OR IGNORE INTO main.categories SELECT * FROM source_db.categories");
    await db.execute("INSERT OR IGNORE INTO main.authors SELECT * FROM source_db.authors");
    await db.execute("INSERT OR IGNORE INTO main.books SELECT * FROM source_db.books");
    await db.execute("INSERT OR IGNORE INTO main.book_authors SELECT * FROM source_db.book_authors");
    await db.execute("INSERT OR IGNORE INTO main.book_tags SELECT * FROM source_db.book_tags");
    await db.execute("INSERT OR IGNORE INTO main.tags SELECT * FROM source_db.tags");
    await db.execute("INSERT OR IGNORE INTO main.copies SELECT * FROM source_db.copies");

    return { importedCount: newBooks.length };
  } finally {
    try {
      await db.execute("DETACH DATABASE source_db");
    } catch (_) {}
  }
}

export async function importMembersFromDb(dbPath: string): Promise<{ importedCount: number }> {
  const db = await database();
  await db.execute("ATTACH DATABASE ? AS source_db", [dbPath]);
  try {
    const newMembers = await db.select<any[]>(
      "SELECT id FROM source_db.members WHERE id NOT IN (SELECT id FROM main.members)"
    );

    await db.execute("INSERT OR IGNORE INTO main.members SELECT * FROM source_db.members");
    return { importedCount: newMembers.length };
  } finally {
    try {
      await db.execute("DETACH DATABASE source_db");
    } catch (_) {}
  }
}

export async function getShelves(): Promise<any[]> {
  const db = await database();
  return db.select<any[]>(`
    SELECT s.*, 
      (SELECT COUNT(*) FROM copies WHERE shelf_id = s.id AND status != 'archived') as copy_count
    FROM shelves s
    ORDER BY s.section, s.code
  `);
}

export async function createShelf(section: string, code: string, capacity: number, notes?: string | null, room?: string | null, floor?: string | null): Promise<void> {
  const db = await database();
  const now = timestamp();
  await db.execute(
    "INSERT INTO shelves (id, code, section, capacity, notes, room, floor, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id(), cleanText(code), cleanText(section), capacity, notes ? cleanText(notes) : null, room ? cleanText(room) : null, floor ? cleanText(floor) : null, now, now]
  );
}

export async function updateShelf(shelfId: string, updates: { code?: string; section?: string; capacity?: number; notes?: string | null; room?: string | null; floor?: string | null }): Promise<void> {
  const db = await database();
  const now = timestamp();
  const fields: string[] = [];
  const params: any[] = [];

  if (updates.code !== undefined) { fields.push("code = ?"); params.push(cleanText(updates.code)); }
  if (updates.section !== undefined) { fields.push("section = ?"); params.push(cleanText(updates.section)); }
  if (updates.capacity !== undefined) { fields.push("capacity = ?"); params.push(updates.capacity); }
  if (updates.notes !== undefined) { fields.push("notes = ?"); params.push(updates.notes ? cleanText(updates.notes) : null); }
  if (updates.room !== undefined) { fields.push("room = ?"); params.push(updates.room ? cleanText(updates.room) : null); }
  if (updates.floor !== undefined) { fields.push("floor = ?"); params.push(updates.floor ? cleanText(updates.floor) : null); }

  if (fields.length === 0) return;

  fields.push("updated_at = ?");
  params.push(now);
  params.push(shelfId);

  await db.execute(`UPDATE shelves SET ${fields.join(", ")} WHERE id = ?`, params);
}

export async function deleteShelf(shelfId: string): Promise<void> {
  const db = await database();
  const copiesCount = await db.select<{ count: number }[]>("SELECT COUNT(*) as count FROM copies WHERE shelf_id = ? AND status != 'archived'", [shelfId]);
  if ((copiesCount[0]?.count ?? 0) > 0) {
    throw new Error("Cannot delete shelf because it contains copies of books. Relocate or archive the copies first.");
  }
  await db.execute("DELETE FROM shelves WHERE id = ?", [shelfId]);
}

// ─── Building / Floor management ─────────────────────────────────────────────

export async function renameBuilding(oldName: string, newName: string): Promise<void> {
  if (!newName.trim()) throw new Error("Building name cannot be empty.");
  const db = await database();
  await db.execute("UPDATE shelves SET room = ?, updated_at = ? WHERE room = ?", [cleanText(newName), timestamp(), cleanText(oldName)]);
}

export async function deleteBuilding(name: string): Promise<void> {
  const db = await database();
  const rows = await db.select<{ count: number }[]>("SELECT COUNT(*) as count FROM shelves WHERE room = ?", [name]);
  if ((rows[0]?.count ?? 0) > 0) {
    throw new Error(`Cannot delete building "${name}" because it still has shelves. Remove all shelves first.`);
  }
}

export async function renameFloor(room: string, oldFloor: string, newFloor: string): Promise<void> {
  if (!newFloor.trim()) throw new Error("Floor name cannot be empty.");
  const db = await database();
  await db.execute("UPDATE shelves SET floor = ?, updated_at = ? WHERE room = ? AND floor = ?", [cleanText(newFloor), timestamp(), cleanText(room), cleanText(oldFloor)]);
}

export async function deleteFloor(room: string, floor: string): Promise<void> {
  const db = await database();
  const rows = await db.select<{ count: number }[]>("SELECT COUNT(*) as count FROM shelves WHERE room = ? AND floor = ?", [room, floor]);
  if ((rows[0]?.count ?? 0) > 0) {
    throw new Error(`Cannot delete floor "${floor}" because it still has shelves. Remove all shelves first.`);
  }
}



