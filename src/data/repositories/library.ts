import { supabase, unwrap } from "../supabaseClient";
import { currentActor } from "../../store/authStore";
import type { Book, Copy, DashboardMetrics, Loan, Member, Reservation, Room, Column, Shelf, ReservationScope } from "../../types";
import {
  normalizeIsbn, cleanBarcode, cleanAccession,
  cleanPhone, cleanText, cleanMemberNumber, generateRandomMemberNumber
} from "../../utils/isbn";

const timestamp = () => new Date().toISOString();

async function audit(action: string, entityType: string, entityId: string, after: unknown) {
  await supabase.from("audit_logs").insert({
    actor: currentActor(), action, entity_type: entityType, entity_id: entityId,
    after_json: after === null ? null : (after as object),
  });
}

/** Finds a row by its unique `name` column, inserting one if it doesn't exist yet. */
async function upsertByName(table: "publishers" | "categories" | "authors" | "tags", name: string, extra: Record<string, unknown> = {}): Promise<string> {
  const existing = await supabase.from(table).select("id").eq("name", name).maybeSingle();
  if (existing.data) return (existing.data as unknown as { id: string }).id;
  const inserted = unwrap<{ id: string }>(await supabase.from(table).insert({ name, ...extra }).select("id").single());
  return inserted.id;
}

export async function dashboard(): Promise<DashboardMetrics> {
  return unwrap(await supabase.rpc("dashboard_metrics")) as unknown as DashboardMetrics;
}

export async function books(query = "", itemType = ""): Promise<Book[]> {
  const filterType = itemType && itemType !== "All Items" && itemType !== "All" ? itemType : "";
  const rows = unwrap(await supabase.rpc("search_books", { p_query: query.trim(), p_item_type: filterType }));
  return (rows as (Book & { tag_list?: string | null })[]).map((r) => ({ ...r, tags: r.tag_list ?? null }));
}

export async function saveBook(input: Omit<Book, "id" | "created_at"> & { author?: string; barcode?: string; accession?: string }): Promise<void> {
  const title = cleanText(input.title);
  const itemType = input.item_type ? cleanText(String(input.item_type)) : "book";
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
  const deweyCode = input.dewey_code ? cleanText(input.dewey_code) : null;

  const publisherId = publisher ? await upsertByName("publishers", publisher) : null;
  const categoryId = category ? await upsertByName("categories", category) : null;

  const book = unwrap<{ id: string }>(await supabase.from("books").insert({
    item_type: itemType, isbn10, isbn13, title, subtitle, arabic_title: arabicTitle, description, language,
    publisher_id: publisherId, category_id: categoryId, call_number: callNumber, dewey_code: deweyCode,
    cover_path: input.cover_path ?? null, source: "manual", metadata: input.metadata ?? null,
  }).select("id").single());
  const bookId = book.id;

  if (author) {
    const authorId = await upsertByName("authors", author, { normalized_name: author.toLocaleLowerCase() });
    await supabase.from("book_authors").insert({ book_id: bookId, author_id: authorId, author_order: 0 });
  }

  if (barcode || accession) {
    const finalAccession = await ensureUniqueAccession(accession);
    const finalBarcode = await ensureUniqueBarcode(barcode, finalAccession);
    await supabase.from("copies").insert({ book_id: bookId, accession_number: finalAccession, barcode: finalBarcode, status: "available", condition: "good" });
  }

  if (tags) {
    const tagNames = [...new Set(tags.split(",").map((t) => t.trim()).filter(Boolean))];
    const colors = ["#FEE2E2", "#FEF3C7", "#D1FAE5", "#DBEAFE", "#E0E7FF", "#F3E8FF", "#FCE7F3"];
    for (const tagName of tagNames) {
      const tagId = await upsertByName("tags", tagName, { color: colors[Math.floor(Math.random() * colors.length)] });
      await supabase.from("book_tags").upsert({ book_id: bookId, tag_id: tagId });
    }
  }

  await audit("create", "book", bookId, { title });
}

export async function updateBook(bookId: string, input: Partial<Book> & { author?: string }): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = cleanText(input.title);
  if (input.item_type !== undefined) patch.item_type = cleanText(String(input.item_type));
  if (input.subtitle !== undefined) patch.subtitle = input.subtitle ? cleanText(input.subtitle) : null;
  if (input.arabic_title !== undefined) patch.arabic_title = input.arabic_title ? cleanText(input.arabic_title) : null;
  if (input.description !== undefined) patch.description = input.description ? cleanText(input.description) : null;
  if (input.language !== undefined) patch.language = cleanText(input.language);
  if (input.publication_year !== undefined) patch.publication_year = input.publication_year;
  if (input.call_number !== undefined) patch.call_number = input.call_number ? cleanText(input.call_number) : null;
  if (input.dewey_code !== undefined) patch.dewey_code = input.dewey_code ? cleanText(input.dewey_code) : null;
  if (input.isbn10 !== undefined) patch.isbn10 = input.isbn10 ? normalizeIsbn(input.isbn10) : null;
  if (input.isbn13 !== undefined) patch.isbn13 = input.isbn13 ? normalizeIsbn(input.isbn13) : null;
  if (input.cover_path !== undefined) patch.cover_path = input.cover_path;
  if (input.metadata !== undefined) patch.metadata = input.metadata;
  if (input.publisher !== undefined) patch.publisher_id = input.publisher?.trim() ? await upsertByName("publishers", cleanText(input.publisher)) : null;
  if (input.category !== undefined) patch.category_id = input.category?.trim() ? await upsertByName("categories", cleanText(input.category)) : null;

  if (Object.keys(patch).length > 0) {
    unwrap(await supabase.from("books").update(patch).eq("id", bookId).select().single());
  }

  if (input.author !== undefined) {
    await supabase.from("book_authors").delete().eq("book_id", bookId);
    if (input.author.trim()) {
      const cleanAuth = cleanText(input.author);
      const authorId = await upsertByName("authors", cleanAuth, { normalized_name: cleanAuth.toLowerCase() });
      await supabase.from("book_authors").insert({ book_id: bookId, author_id: authorId, author_order: 0 });
    }
  }

  if (input.tags !== undefined) {
    await supabase.from("book_tags").delete().eq("book_id", bookId);
    if (input.tags?.trim()) {
      const tagNames = [...new Set(cleanText(input.tags).split(",").map((t) => t.trim()).filter(Boolean))];
      const colors = ["#FEE2E2", "#FEF3C7", "#D1FAE5", "#DBEAFE", "#E0E7FF", "#F3E8FF", "#FCE7F3"];
      for (const tagName of tagNames) {
        const tagId = await upsertByName("tags", tagName, { color: colors[Math.floor(Math.random() * colors.length)] });
        await supabase.from("book_tags").upsert({ book_id: bookId, tag_id: tagId });
      }
    }
  }

  await audit("update", "book", bookId, input);
}

export async function deleteBook(bookId: string): Promise<void> {
  const book = unwrap(await supabase.from("books").select("title").eq("id", bookId).single()) as { title: string };
  const { count } = await supabase.from("loans").select("id, copies!inner(book_id)", { count: "exact", head: true }).eq("copies.book_id", bookId).is("returned_at", null);
  if ((count ?? 0) > 0) {
    throw new Error("This title has copies currently on loan. All copies must be returned before it can be archived.");
  }
  const now = timestamp();
  unwrap(await supabase.from("books").update({ archived_at: now }).eq("id", bookId).select().single());
  await supabase.from("copies").update({ status: "archived" }).eq("book_id", bookId).neq("status", "archived");
  await audit("archive_book", "book", bookId, { title: book.title });
}

export async function getCopiesForBook(bookId: string): Promise<Copy[]> {
  const rows = unwrap(await supabase.from("copy_catalog").select("*").eq("book_id", bookId).neq("status", "archived"));
  return rows as Copy[];
}

async function ensureUniqueBarcode(inputBarcode?: string | null, accessionNumber?: string | null, excludeCopyId?: string): Promise<string> {
  const cleanB = inputBarcode ? cleanBarcode(inputBarcode) : "";
  if (cleanB) {
    let q = supabase.from("copies").select("id").eq("barcode", cleanB);
    if (excludeCopyId) q = q.neq("id", excludeCopyId);
    const existing = unwrap(await q);
    if ((existing as unknown[]).length > 0) {
      throw new Error(`A copy with barcode "${cleanB}" already exists in the system. Please use a unique barcode.`);
    }
    return cleanB;
  }

  const baseAccession = accessionNumber ? cleanAccession(accessionNumber) : "";
  let baseBarcode = baseAccession ? `BAR-${baseAccession}` : `BAR-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
  let existing = unwrap(await supabase.from("copies").select("id").eq("barcode", baseBarcode)) as unknown[];
  if (existing.length === 0) return baseBarcode;

  let attempt = 0;
  while (existing.length > 0 && attempt < 10) {
    baseBarcode = `BAR-${baseAccession || "CPY"}-${crypto.randomUUID().substring(0, 6).toUpperCase()}`;
    existing = unwrap(await supabase.from("copies").select("id").eq("barcode", baseBarcode)) as unknown[];
    attempt++;
  }
  return baseBarcode;
}

async function ensureUniqueAccession(inputAccession?: string | null, excludeCopyId?: string): Promise<string> {
  const cleanA = inputAccession ? cleanAccession(inputAccession) : "";
  if (cleanA) {
    let q = supabase.from("copies").select("id").eq("accession_number", cleanA);
    if (excludeCopyId) q = q.neq("id", excludeCopyId);
    const existing = unwrap(await q);
    if ((existing as unknown[]).length > 0) {
      throw new Error(`A copy with index/accession "${cleanA}" already exists in the system. Please use a unique index.`);
    }
    return cleanA;
  }

  let baseAccession = `ACC-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
  let existing = unwrap(await supabase.from("copies").select("id").eq("accession_number", baseAccession)) as unknown[];
  let attempt = 0;
  while (existing.length > 0 && attempt < 10) {
    baseAccession = `ACC-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
    existing = unwrap(await supabase.from("copies").select("id").eq("accession_number", baseAccession)) as unknown[];
    attempt++;
  }
  return baseAccession;
}

export async function addCopy(bookId: string, barcode: string, accessionNumber: string, condition: string, shelfId?: string | null): Promise<void> {
  const finalAccession = await ensureUniqueAccession(accessionNumber);
  const finalBarcode = await ensureUniqueBarcode(barcode, finalAccession);

  const copy = unwrap<{ id: string }>(await supabase.from("copies").insert({
    book_id: bookId, accession_number: finalAccession, barcode: finalBarcode, shelf_id: shelfId ?? null, status: "available", condition,
  }).select("id").single());
  const copyId = copy.id;

  const book = unwrap<{ title: string }>(await supabase.from("books").select("title").eq("id", bookId).single());
  await audit("add_copy", "copy", copyId, { book_title: book.title, barcode: finalBarcode, accession: finalAccession, condition });
}

export async function updateCopy(copyId: string, updates: Partial<Copy> & { shelfId?: string | null }): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.condition !== undefined) patch.condition = updates.condition;
  if (updates.barcode) patch.barcode = await ensureUniqueBarcode(updates.barcode, undefined, copyId);
  if (updates.accession_number) patch.accession_number = await ensureUniqueAccession(updates.accession_number, copyId);
  if (updates.shelfId !== undefined) patch.shelf_id = updates.shelfId;

  unwrap(await supabase.from("copies").update(patch).eq("id", copyId).select().single());
  await audit("update_copy", "copy", copyId, updates);
}

export async function deleteCopy(copyId: string): Promise<void> {
  const copy = unwrap(await supabase.from("copies").select("barcode, accession_number").eq("id", copyId).single()) as { barcode: string; accession_number: string };
  const { count } = await supabase.from("loans").select("id", { count: "exact", head: true }).eq("copy_id", copyId).is("returned_at", null);
  if ((count ?? 0) > 0) {
    throw new Error("This copy is currently on loan. It must be returned before it can be archived.");
  }
  await supabase.from("copies").update({ status: "archived" }).eq("id", copyId);
  await audit("delete_copy", "copy", copyId, { barcode: copy.barcode, accession: copy.accession_number });
}

export async function members(query = ""): Promise<Member[]> {
  let q = supabase.from("members").select("*").is("archived_at", null);
  const term = query.trim();
  if (term) {
    const like = `%${term}%`;
    q = q.or(`full_name.ilike.${like},member_number.ilike.${like},email.ilike.${like},department.ilike.${like}`);
  }
  return unwrap(await q.order("full_name")) as Member[];
}

export async function saveMember(input: Omit<Member, "id" | "member_number" | "joined_at"> & { member_number?: string }): Promise<Member> {
  const memberNumber = input.member_number?.trim() ? cleanMemberNumber(input.member_number) : generateRandomMemberNumber(6);
  const fullName = cleanText(input.full_name);
  const email = input.email ? cleanText(input.email) : null;
  const phone = input.phone ? cleanPhone(input.phone) : null;
  const department = input.department ? cleanText(input.department) : null;
  const role = input.role ? cleanText(String(input.role)) : "visitor";

  const row = unwrap(await supabase.from("members").insert({
    member_number: memberNumber, full_name: fullName, email, phone, department, role,
    status: input.status, expiry_date: input.expiry_date ?? null, avatar_path: input.avatar_path ?? null,
  }).select().single()) as Member;

  await audit("create_member", "member", row.id, { full_name: fullName, member_number: memberNumber, role, department });
  return row;
}

export async function updateMember(memberId: string, updates: Partial<Member>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (updates.full_name !== undefined) patch.full_name = cleanText(updates.full_name);
  if (updates.email !== undefined) patch.email = updates.email ? cleanText(updates.email) : null;
  if (updates.phone !== undefined) patch.phone = updates.phone ? cleanPhone(updates.phone) : null;
  if (updates.department !== undefined) patch.department = updates.department ? cleanText(updates.department) : null;
  if (updates.role !== undefined) patch.role = updates.role ? cleanText(String(updates.role)) : null;
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.expiry_date !== undefined) patch.expiry_date = updates.expiry_date;
  if (updates.avatar_path !== undefined) patch.avatar_path = updates.avatar_path;

  unwrap(await supabase.from("members").update(patch).eq("id", memberId).select().single());
  await audit("update_member", "member", memberId, updates);
}

export async function deleteMember(memberId: string): Promise<void> {
  const member = unwrap(await supabase.from("members").select("full_name, member_number").eq("id", memberId).single()) as { full_name: string; member_number: string };
  const { count } = await supabase.from("loans").select("id", { count: "exact", head: true }).eq("member_id", memberId).is("returned_at", null);
  if ((count ?? 0) > 0) {
    throw new Error("This member has copies currently on loan. All copies must be returned before the member can be archived.");
  }
  await supabase.from("reservations").update({ status: "cancelled" }).eq("member_id", memberId).in("status", ["queued", "ready", "pending"]);
  await supabase.from("members").update({ archived_at: timestamp(), status: "archived" }).eq("id", memberId);
  await audit("archive_member", "member", memberId, { full_name: member.full_name, member_number: member.member_number });
}

/**
 * Permanently deletes a member and wipes their reservation history. Refuses to run if the
 * member has ever borrowed anything, since that would destroy circulation history the
 * library must be able to account for — use deleteMember() (archive) instead.
 */
export async function hardDeleteMember(memberId: string): Promise<void> {
  const member = unwrap(await supabase.from("members").select("full_name, member_number").eq("id", memberId).single()) as { full_name: string; member_number: string };
  const { count } = await supabase.from("loans").select("id", { count: "exact", head: true }).eq("member_id", memberId);
  if ((count ?? 0) > 0) {
    throw new Error("This member has borrowing history and cannot be permanently deleted. Archive the member instead.");
  }
  await supabase.from("reservations").delete().eq("member_id", memberId);
  await supabase.from("members").delete().eq("id", memberId);
  await audit("delete_member_permanent", "member", memberId, { full_name: member.full_name, member_number: member.member_number });
}

export async function banMember(memberId: string, reason: string): Promise<void> {
  unwrap(await supabase.rpc("ban_member", { p_member_id: memberId, p_reason: reason }));
}

export async function unbanMember(memberId: string): Promise<void> {
  unwrap(await supabase.rpc("unban_member", { p_member_id: memberId }));
}

export async function copies(query = ""): Promise<(Copy & { title: string; item_type?: string; metadata?: string | null; cover_path?: string | null; author?: string | null })[]> {
  return unwrap(await supabase.rpc("search_copies", { p_query: query.trim() })) as (Copy & { title: string })[];
}

export async function loans(openOnly = false): Promise<Loan[]> {
  let q = supabase.from("loan_details").select("*");
  if (openOnly) q = q.is("returned_at", null);
  return unwrap(await q.order("borrowed_at", { ascending: false })) as Loan[];
}

export async function getLoansForMember(memberId: string): Promise<Loan[]> {
  return unwrap(await supabase.from("loan_details").select("*").eq("member_id", memberId).order("borrowed_at", { ascending: false })) as Loan[];
}

export async function getReservationsForMember(memberId: string): Promise<Reservation[]> {
  return unwrap(await supabase.from("reservation_details").select("*").eq("member_id", memberId).order("requested_at", { ascending: false })) as Reservation[];
}

/** Direct-desk checkout (no reservation involved). Loan duration is derived server-side from `scope` + library_settings. */
export async function checkout(memberId: string, copyIds: string[], limit: number, scope: ReservationScope = "external"): Promise<void> {
  if (copyIds.length === 0) return;
  const { count } = await supabase.from("loans").select("id", { count: "exact", head: true }).eq("member_id", memberId).is("returned_at", null);
  if ((count ?? 0) + copyIds.length > limit) throw new Error(`Loan limit of ${limit} would be exceeded.`);

  for (const copyId of copyIds) {
    unwrap(await supabase.rpc("checkout", { p_copy_id: copyId, p_member_id: memberId, p_scope: scope }));
  }
}

export async function returnCopies(copyIds: string[]): Promise<void> {
  if (copyIds.length === 0) return;
  unwrap(await supabase.rpc("return_copies", { p_copy_ids: copyIds }));
}

export async function renewLoan(loanId: string, days: number): Promise<void> {
  const loan = unwrap(await supabase.from("loans").select("*").eq("id", loanId).single()) as Loan;
  if (loan.returned_at) throw new Error("This loan has already been returned.");

  const currentDueDate = new Date(loan.due_at);
  const baseDate = currentDueDate > new Date() ? currentDueDate : new Date();
  baseDate.setDate(baseDate.getDate() + days);
  const newDueDate = baseDate.toISOString();

  unwrap(await supabase.from("loans").update({ due_at: newDueDate, renewed_count: loan.renewed_count + 1 }).eq("id", loanId).select().single());
  await audit("renew", "loan", loanId, { old_due: loan.due_at, new_due: newDueDate });
}

export async function cancelReservation(reservationId: string): Promise<void> {
  unwrap(await supabase.from("reservations").update({ status: "cancelled" }).eq("id", reservationId).select().single());
  await audit("cancel_reservation", "reservation", reservationId, { status: "cancelled" });
}

export async function deleteReservation(reservationId: string): Promise<void> {
  await supabase.from("reservations").delete().eq("id", reservationId);
  await audit("delete_reservation", "reservation", reservationId, { status: "deleted" });
}

export async function acceptReservation(reservationId: string, reason?: string | null): Promise<Reservation> {
  return unwrap(await supabase.rpc("accept_reservation", { p_reservation_id: reservationId, p_reason: reason ?? null })) as Reservation;
}

export async function declineReservation(reservationId: string, reason?: string | null): Promise<Reservation> {
  return unwrap(await supabase.rpc("decline_reservation", { p_reservation_id: reservationId, p_reason: reason ?? null })) as Reservation;
}

export async function fulfilReservation(reservationId: string): Promise<Loan> {
  return unwrap(await supabase.rpc("fulfil_reservation", { p_reservation_id: reservationId })) as Loan;
}

export async function extendReservation(reservationId: string, days = 7): Promise<void> {
  const res = unwrap(await supabase.from("reservations").select("expires_at").eq("id", reservationId).single()) as { expires_at: string | null };
  const current = res.expires_at ? new Date(res.expires_at) : new Date();
  const baseDate = current > new Date() ? current : new Date();
  baseDate.setDate(baseDate.getDate() + days);
  const newExpires = baseDate.toISOString();
  await supabase.from("reservations").update({ expires_at: newExpires }).eq("id", reservationId);
  await audit("extend_reservation", "reservation", reservationId, { extended_days: days, new_expires: newExpires });
}

export async function updateReservation(reservationId: string, patch: { expiresAt?: string | null; scope?: ReservationScope }): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.expiresAt !== undefined) update.expires_at = patch.expiresAt;
  if (patch.scope !== undefined) update.scope = patch.scope;
  if (Object.keys(update).length === 0) return;
  await supabase.from("reservations").update(update).eq("id", reservationId);
  await audit("update_reservation", "reservation", reservationId, update);
}

export async function reservations(): Promise<Reservation[]> {
  return unwrap(await supabase.from("reservation_details").select("*").order("requested_at", { ascending: false })) as Reservation[];
}

/** Creates a reservation request in `pending` status — an admin must accept or decline it (see acceptReservation/declineReservation). */
export async function addReservation(bookId: string, memberId: string, scope: ReservationScope, expiresAt?: string | null): Promise<void> {
  const inserted = unwrap(await supabase.from("reservations").insert({
    book_id: bookId, member_id: memberId, scope, status: "pending", requested_at: timestamp(), expires_at: expiresAt ?? null,
  }).select("id").single()) as { id: string };

  const book = unwrap(await supabase.from("books").select("title").eq("id", bookId).single()) as { title: string };
  const member = unwrap(await supabase.from("members").select("full_name").eq("id", memberId).single()) as { full_name: string };
  await audit("create_reservation", "reservation", inserted.id, { book_title: book.title, member_name: member.full_name, scope });
}

export async function auditLog(limit = 500) {
  return unwrap(await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(limit));
}

export async function getRooms(): Promise<Room[]> {
  return unwrap(await supabase.from("rooms").select("*").order("name")) as Room[];
}

export async function createRoom(name: string, notes?: string | null): Promise<Room> {
  const room = unwrap(await supabase.from("rooms").insert({ name: cleanText(name), notes: notes ? cleanText(notes) : null }).select().single()) as Room;
  await audit("create_room", "room", room.id, { name });
  return room;
}

export async function renameRoom(roomId: string, newName: string): Promise<void> {
  if (!newName.trim()) throw new Error("Room name cannot be empty.");
  await supabase.from("rooms").update({ name: cleanText(newName) }).eq("id", roomId);
  await audit("rename_room", "room", roomId, { name: newName });
}

export async function deleteRoom(roomId: string): Promise<void> {
  const shelfIds = (unwrap(await supabase.from("shelf_overview").select("id").eq("room_id", roomId)) as { id: string }[]).map(s => s.id);
  if (shelfIds.length > 0) {
    const { count } = await supabase.from("copies").select("id", { count: "exact", head: true }).in("shelf_id", shelfIds).neq("status", "archived");
    if ((count ?? 0) > 0) {
      throw new Error("Cannot delete this room because it still has shelved copies. Relocate or archive the copies first.");
    }
  }
  await supabase.from("rooms").delete().eq("id", roomId);
  await audit("delete_room", "room", roomId, {});
}

export async function getColumns(): Promise<Column[]> {
  return unwrap(await supabase.from("columns").select("*").order("room_id").order("number")) as Column[];
}

export async function createColumn(roomId: string, rows: string[]): Promise<string> {
  const columnId = unwrap(await supabase.rpc("create_column", { p_room_id: roomId, p_rows: rows })) as string;
  await audit("create_column", "column", columnId, { room_id: roomId, rows });
  return columnId;
}

export async function deleteColumn(columnId: string): Promise<void> {
  const shelfIds = (unwrap(await supabase.from("shelves").select("id").eq("column_id", columnId)) as { id: string }[]).map(s => s.id);
  if (shelfIds.length > 0) {
    const { count } = await supabase.from("copies").select("id", { count: "exact", head: true }).in("shelf_id", shelfIds).neq("status", "archived");
    if ((count ?? 0) > 0) {
      throw new Error("Cannot delete this column because it still has shelved copies. Relocate or archive the copies first.");
    }
  }
  await supabase.from("columns").delete().eq("id", columnId);
  await audit("delete_column", "column", columnId, {});
}

export async function getShelves(): Promise<Shelf[]> {
  return unwrap(await supabase.from("shelf_overview").select("*").order("room").order("column_number").order("shelf_type", { ascending: false }).order("code")) as Shelf[];
}

export async function updateShelf(shelfId: string, updates: { capacity?: number; notes?: string | null }): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (updates.capacity !== undefined) patch.capacity = updates.capacity;
  if (updates.notes !== undefined) patch.notes = updates.notes ? cleanText(updates.notes) : null;
  if (Object.keys(patch).length === 0) return;
  await supabase.from("shelves").update(patch).eq("id", shelfId);
  await audit("update_shelf", "shelf", shelfId, updates);
}
