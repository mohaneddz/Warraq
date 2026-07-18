import { database } from "./database";

const id = () => crypto.randomUUID() as string;

function randomDateBetween(start: Date, end: Date) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
}

export async function seedDummyData() {
  const db = await database();
  
  await db.execute("DELETE FROM fines");
  await db.execute("DELETE FROM inventory_scans");
  await db.execute("DELETE FROM inventory_sessions");
  await db.execute("DELETE FROM loans");
  await db.execute("DELETE FROM reservations");
  await db.execute("DELETE FROM attachments");
  await db.execute("DELETE FROM copies");
  await db.execute("DELETE FROM book_authors");
  await db.execute("DELETE FROM book_tags");
  await db.execute("DELETE FROM books");
  await db.execute("DELETE FROM authors");
  await db.execute("DELETE FROM tags");
  await db.execute("DELETE FROM publishers");
  await db.execute("DELETE FROM categories");
  await db.execute("DELETE FROM members");
  await db.execute("DELETE FROM shelves");
  await db.execute("DELETE FROM audit_logs");
  await db.execute("DELETE FROM saved_searches");
  await db.execute("DELETE FROM integration_cache");

  const today = new Date();
  const pastWeek = new Date();
  pastWeek.setDate(today.getDate() - 7);
  const pastMonth = new Date();
  pastMonth.setMonth(today.getMonth() - 1);

  const membersData = [
    { name: "Ahmed Yelles", dpt: "Cardiology", role: "Resident" },
    { name: "Salima K.", dpt: "Pediatrics", role: "Specialist" },
    { name: "Yacine B.", dpt: "Neurology", role: "Resident" },
    { name: "Meriem Z.", dpt: "Internal Medicine", role: "Professor" },
    { name: "Karim F.", dpt: "Surgery", role: "Nurse" },
    { name: "Fatima R.", dpt: "Radiology", role: "Resident" },
    { name: "Nassim D.", dpt: "Emergency", role: "Doctor" },
  ];

  const createdMembers: string[] = [];
  for (let i = 0; i < membersData.length; i++) {
    const m = membersData[i];
    const memberId = id();
    await db.execute(
      "INSERT INTO members (id, member_number, full_name, email, department, role, status, joined_at, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, $9)",
      [memberId, `M-${1042 + i}`, m.name, `${m.name.toLowerCase().replace(/ /g, '.')}@hospital.dz`, m.dpt, m.role, randomDateBetween(new Date(2023, 0, 1), pastMonth), today.toISOString(), today.toISOString()]
    );
    createdMembers.push(memberId);
  }

  const booksData = [
    { title: "تاريخ الجزائر الثقافي", author: "محمد العربي الزبيري", isbn: "978-9931-23-456-7", category: "History", lang: "ar" },
    { title: "طب الأندلس", author: "ابن زهر", isbn: "978-2-1234-5678-9", category: "Medicine", lang: "ar" },
    { title: "مخطوطات ابن رشد", author: "ابن رشد", isbn: "978-0-9876-5432-1", category: "Philosophy", lang: "ar" },
    { title: "Harrison's Principles of Internal Medicine", author: "J. Larry Jameson", isbn: "978-1259644030", category: "Medicine", lang: "en" },
    { title: "Gray's Anatomy", author: "Susan Standring", isbn: "978-0702077050", category: "Medicine", lang: "en" },
    { title: "Robbins Basic Pathology", author: "Vinay Kumar", isbn: "978-0323353175", category: "Pathology", lang: "en" },
    { title: "Atlas of Human Anatomy", author: "Frank H. Netter", isbn: "978-1455704187", category: "Medicine", lang: "en" },
    { title: "الشفاء", author: "ابن سينا", isbn: "978-3-16-148410-0", category: "Medicine", lang: "ar" },
    { title: "Guyton and Hall Textbook of Medical Physiology", author: "John E. Hall", isbn: "978-0323597128", category: "Physiology", lang: "en" },
    { title: "Clinical Neuroanatomy", author: "Stephen G. Waxman", isbn: "978-1259862091", category: "Neurology", lang: "en" },
    { title: "القاموس الطبي الموحد", author: "منظمة الصحة العالمية", isbn: "978-9290216706", category: "Dictionary", lang: "ar" },
  ];

  let copyCounter = 1000;
  const createdCopies: string[] = [];
  const createdBooks: string[] = [];

  for (const b of booksData) {
    const bookId = id();
    createdBooks.push(bookId);
    
    // Insert publisher and category via raw SQL to ensure ids
    let categoryId = id();
    await db.execute("INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)", [categoryId, b.category]);
    // Get correct category id in case it was ignored
    const catRows = await db.select<{id: string}[]>("SELECT id FROM categories WHERE name=?", [b.category]);
    categoryId = catRows[0].id;

    await db.execute(
      "INSERT INTO books (id, title, isbn13, category_id, language, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'manual', ?, ?)",
      [bookId, b.title, b.isbn, categoryId, b.lang, today.toISOString(), today.toISOString()]
    );
    
    // Add author
    let authorId = id();
    await db.execute("INSERT OR IGNORE INTO authors (id, name, normalized_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", [authorId, b.author, b.author.toLowerCase(), today.toISOString(), today.toISOString()]);
    const authRows = await db.select<{id: string}[]>("SELECT id FROM authors WHERE normalized_name=?", [b.author.toLowerCase()]);
    authorId = authRows[0].id;
    
    await db.execute("INSERT INTO book_authors (book_id, author_id, author_order) VALUES (?, ?, 0)", [bookId, authorId]);

    const numCopies = Math.floor(Math.random() * 3) + 3; 
    for (let i = 0; i < numCopies; i++) {
      const copyId = id();
      const barcode = `WA-${copyCounter++}`;
      createdCopies.push(copyId);
      await db.execute(
        "INSERT INTO copies (id, book_id, accession_number, barcode, status, condition, created_at, updated_at) VALUES (?, ?, ?, ?, 'available', 'good', ?, ?)",
        [copyId, bookId, `ACC-${copyCounter}`, barcode, today.toISOString(), today.toISOString()]
      );
    }
  }

  for (let i = 0; i < 35; i++) {
    const memberId = createdMembers[Math.floor(Math.random() * createdMembers.length)];
    const copyId = createdCopies[Math.floor(Math.random() * createdCopies.length)];
    
    const isReturned = Math.random() < 0.6;
    const isOverdue = !isReturned && Math.random() < 0.4;

    const loanId = id();
    
    let borrowedDate;
    let dueDateObj;
    let returnedDateStr = null;

    if (isReturned) {
      borrowedDate = new Date(randomDateBetween(pastMonth, pastWeek));
      dueDateObj = new Date(borrowedDate);
      dueDateObj.setDate(dueDateObj.getDate() + 14);
      
      const returnedDate = new Date(borrowedDate);
      returnedDate.setDate(returnedDate.getDate() + Math.floor(Math.random() * 10) + 1);
      returnedDateStr = returnedDate.toISOString();
    } else if (isOverdue) {
      borrowedDate = new Date(randomDateBetween(new Date(today.getTime() - 40*24*60*60*1000), new Date(today.getTime() - 20*24*60*60*1000)));
      dueDateObj = new Date(borrowedDate);
      dueDateObj.setDate(dueDateObj.getDate() + 14); 
    } else {
      borrowedDate = new Date(randomDateBetween(pastWeek, today));
      dueDateObj = new Date(borrowedDate);
      dueDateObj.setDate(dueDateObj.getDate() + 14);
    }

    await db.execute(
      "INSERT INTO loans (id, copy_id, member_id, borrowed_at, due_at, returned_at, renewed_count) VALUES ($1, $2, $3, $4, $5, $6, 0)",
      [loanId, copyId, memberId, borrowedDate.toISOString(), dueDateObj.toISOString(), returnedDateStr]
    );

    if (!isReturned) {
      await db.execute("UPDATE copies SET status = 'on-loan' WHERE id = $1", [copyId]);
    }
  }

  for (let i = 0; i < 5; i++) {
    const memberId = createdMembers[Math.floor(Math.random() * createdMembers.length)];
    const bookId = createdBooks[Math.floor(Math.random() * createdBooks.length)];
    
    await db.execute(
      "INSERT INTO reservations (id, book_id, member_id, status, position, reserved_at) VALUES ($1, $2, $3, 'queued', 1, $4)",
      [id(), bookId, memberId, randomDateBetween(pastWeek, today)]
    );
  }

  await db.execute(
    "INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
    [id(), "system", "system_seeded", "system", "all", new Date().toISOString()]
  );
}
