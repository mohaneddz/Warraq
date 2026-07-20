import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { 
  ArrowRight, BellRing, BookCopy, BookOpen, BookPlus, Check, Clock3, RotateCcw, 
  ScanLine, ShieldCheck, UserPlus, UsersRound, Trash2, Edit, Plus, Trash, 
  RotateCw, MapPin
} from "lucide-react";
import type { Book, Copy, Member } from "../types";
import { toast } from "sonner";
import { 
  auditLog, books, checkout, copies, dashboard, loans, members, 
  reservations, returnCopies, saveBook, saveMember, updateBook, 
  deleteBook, getCopiesForBook, addCopy, updateCopy, deleteCopy, 
  updateMember, deleteMember, getLoansForMember, getReservationsForMember, 
  renewLoan, cancelReservation
} from "../data/repositories/library";
import { seedDummyData } from "../data/seed";
import { queryClient } from "../app/providers";
import { Button, Card, EmptyState, Input, StatusBadge, Modal } from "../components/ui/primitives";
import { daysLate, formatDisplayDate } from "../utils/dates";
import { isValidIsbn, normalizeIsbn } from "../utils/isbn";
import { useUiStore } from "../store/uiStore";
import { cn } from "../utils/cn";

const invalidate = () => queryClient.invalidateQueries();

const PageTitle = ({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 className="font-display text-3xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-ink/60 dark:text-parchment/60">{detail}</p>
    </div>
    {action}
  </div>
);

const Table = ({ headers, children }: { headers: string[]; children: React.ReactNode }) => (
  <div className="overflow-x-auto rounded-card border border-ink/10 bg-white shadow-card dark:border-parchment/10 dark:bg-[#1d2926]">
    <table className="w-full min-w-[650px] text-left text-sm">
      <thead className="border-b border-ink/10 bg-parchment/65 text-xs uppercase tracking-wider text-ink/55 dark:border-parchment/10 dark:bg-ink/30 dark:text-parchment/55">
        <tr>
          {headers.map((header) => <th className="px-4 py-3 font-semibold" key={header}>{header}</th>)}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);

const Cell = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <td className={cn("border-b border-ink/7 px-4 py-3 last:border-0 dark:border-parchment/7", className)}>{children}</td>
);

// Custom Searchable Dropdown / Autocomplete Component
function SearchableSelect<T>({
  options = [],
  labelKey,
  valueKey,
  placeholder,
  value,
  onChange,
  subLabelKey,
}: {
  options: T[];
  labelKey: keyof T;
  valueKey: keyof T;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
  subLabelKey?: keyof T;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    return options.filter((opt) =>
      String(opt[labelKey]).toLowerCase().includes(search.toLowerCase()) ||
      (subLabelKey && String(opt[subLabelKey]).toLowerCase().includes(search.toLowerCase()))
    );
  }, [options, labelKey, subLabelKey, search]);

  const selectedOpt = options.find((o) => String(o[valueKey]) === value);

  return (
    <div className="relative">
      <div
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full rounded-control border border-ink/15 bg-white px-3 py-2 text-sm text-ink cursor-pointer dark:border-parchment/20 dark:bg-ink/30 dark:text-parchment hover:border-emerald transition"
      >
        <span className="truncate">
          {selectedOpt ? (
            <span>
              {String(selectedOpt[labelKey])}
              {subLabelKey && <span className="text-xs text-ink/45 dark:text-parchment/45 ml-2">({String(selectedOpt[subLabelKey])})</span>}
            </span>
          ) : placeholder}
        </span>
        <span className="text-xs text-ink/40 dark:text-parchment/40">▼</span>
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute z-40 mt-1 w-full max-h-60 overflow-y-auto rounded-control border border-ink/15 bg-white p-2 shadow-lg dark:border-parchment/20 dark:bg-[#1c2825] border-t-0">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type to filter..."
              className="mb-2"
              autoFocus
            />
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {filtered.length ? (
                filtered.map((opt) => (
                  <div
                    key={String(opt[valueKey])}
                    onClick={() => {
                      onChange(String(opt[valueKey]));
                      setOpen(false);
                      setSearch("");
                    }}
                    className={cn(
                      "px-3 py-1.5 text-sm rounded-control cursor-pointer hover:bg-emerald/10 hover:text-emerald dark:hover:bg-emerald/20 transition flex justify-between items-center",
                      String(opt[valueKey]) === value && "bg-emerald text-white hover:bg-emerald/90 dark:text-white"
                    )}
                  >
                    <span className="truncate">{String(opt[labelKey])}</span>
                    {subLabelKey && (
                      <span className={cn(
                        "text-xs text-ink/45 ml-2 truncate",
                        String(opt[valueKey]) === value ? "text-white/80" : "dark:text-parchment/45"
                      )}>
                        {String(opt[subLabelKey])}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="px-3 py-2 text-xs text-ink/50 dark:text-parchment/50">No results found</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function DashboardPage() {
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: dashboard });
  const metrics = data ?? { titles: 0, copies: 0, onLoan: 0, members: 0, overdue: 0, readyReservations: 0, recentLoans: [], overdueLoans: [], activity: [] };
  const cards = [
    { label: "Total books", value: metrics.titles, note: "Catalogued titles", Icon: BookOpen, tone: "emerald" },
    { label: "Borrowed", value: metrics.onLoan, note: "Copies currently out", Icon: BookCopy, tone: "copper" },
    { label: "Members", value: metrics.members, note: "Active library members", Icon: UsersRound, tone: "emerald" },
    { label: "Overdue", value: metrics.overdue, note: "Require follow-up", Icon: Clock3, tone: "copper" }
  ];
  return (
    <div className="dashboard-page">
      <PageTitle title="Dashboard" detail="A live overview of your library's activity."/>
      <section className="metric-grid">
        {cards.map(({ label, value, note, Icon, tone }) => (
          <Card className="metric-card" key={label}>
            <span className={"metric-icon " + tone}><Icon size={23}/></span>
            <div>
              <p>{label}</p>
              <strong>{value.toLocaleString()}</strong>
              <small>{note}</small>
            </div>
          </Card>
        ))}
      </section>
      <section className="dashboard-panels">
        <Card className="dashboard-panel">
          <header>
            <div>
              <h2>Recent borrowings</h2>
              <p>Latest active loans</p>
            </div>
          </header>
          {metrics.recentLoans.length ? (
            <div className="dashboard-list">
              {metrics.recentLoans.map((loan) => (
                <div className="dashboard-row" key={loan.id}>
                  <span className="book-glyph"><BookOpen size={18}/></span>
                  <div>
                    <strong>{loan.title}</strong>
                    <small>Borrowed by {loan.member_name}</small>
                  </div>
                  <span className="row-meta">Due {formatDisplayDate(loan.due_at)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="panel-empty">
              <BookCopy size={24}/>
              <span>No active loans yet.</span>
            </div>
          )}
          <button className="panel-link" onClick={() => location.assign("#/members")}>
            View circulation <ArrowRight size={16}/>
          </button>
        </Card>
        <Card className="dashboard-panel">
          <header>
            <div>
              <h2>Overdue alerts</h2>
              <p>Items needing attention</p>
            </div>
            <BellRing size={17} className="text-copper"/>
          </header>
          {metrics.overdueLoans.length ? (
            <div className="dashboard-list">
              {metrics.overdueLoans.map((loan) => (
                <div className="dashboard-row" key={loan.id}>
                  <span className="book-glyph copper"><Clock3 size={18}/></span>
                  <div>
                    <strong>{loan.title}</strong>
                    <small>{loan.member_name}</small>
                  </div>
                  <span className="row-meta overdue">{daysLate(loan.due_at)} days late</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="panel-empty">
              <Clock3 size={24}/>
              <span>No overdue loans. Great work.</span>
            </div>
          )}
          <button className="panel-link" onClick={() => location.assign("#/members")}>
            View overdue items <ArrowRight size={16}/>
          </button>
        </Card>
        <Card className="dashboard-panel activity-panel">
          <header>
            <div>
              <h2>Activity overview</h2>
              <p>Loans over the past 7 days</p>
            </div>
          </header>
          <div className="flex-1 mt-4 min-h-[200px]">
            {metrics.activity.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.activity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#176B57" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#176B57" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { weekday: 'short' })} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8f9a96' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8f9a96' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px' }}
                    labelFormatter={(val) => new Date(val).toLocaleDateString()}
                  />
                  <Area type="monotone" dataKey="count" stroke="#176B57" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="panel-empty">
                <BellRing size={24}/>
                <span>Activity will appear as you work.</span>
              </div>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}

const bookSchema = z.object({ 
  title: z.string().min(2, "A title is required"), 
  author: z.string().optional(), 
  isbn: z.string().optional(), 
  language: z.string().min(2), 
  publisher: z.string().optional(), 
  category: z.string().optional(), 
  barcode: z.string().optional(), 
  accession: z.string().optional() 
});
type BookValues = z.infer<typeof bookSchema>;

export function CatalogPage() {
  const [term, setTerm] = useState(""); 
  const [adding, setAdding] = useState(false); 
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const result = useQuery({ queryKey: ["books", term], queryFn: () => books(term) }); 
  const form = useForm<BookValues>({ 
    resolver: zodResolver(bookSchema), 
    defaultValues: { title: "", author: "", isbn: "", language: "English", publisher: "", category: "", barcode: "", accession: "" } 
  });

  const mutation = useMutation({ 
    mutationFn: async (values: BookValues) => { 
      const isbn = normalizeIsbn(values.isbn ?? ""); 
      if (isbn && !isValidIsbn(isbn)) throw new Error("Enter a valid ISBN-10 or ISBN-13."); 
      return saveBook({ 
        title: values.title, 
        language: values.language, 
        isbn10: isbn.length === 10 ? isbn : null, 
        isbn13: isbn.length === 13 ? isbn : null, 
        publisher: values.publisher, 
        category: values.category, 
        author: values.author, 
        barcode: values.barcode, 
        accession: values.accession 
      }); 
    }, 
    onSuccess: () => { 
      invalidate(); 
      toast.success("Book saved to the catalog."); 
      form.reset(); 
      setAdding(false); 
    }, 
    onError: (error) => toast.error(error.message) 
  });

  return (
    <>
      <PageTitle 
        title="Catalog" 
        detail="Search titles, ISBNs, authors, accessions, and copy barcodes." 
        action={<Button onClick={() => setAdding(!adding)}><BookPlus size={17}/> Add book</Button>}
      />
      
      {adding && (
        <Card className="mb-6">
          <form className="grid gap-3 md:grid-cols-2" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <label>Title<Input {...form.register("title")}/>{form.formState.errors.title && <small className="text-red-700">{form.formState.errors.title.message}</small>}</label>
            <label>Author<Input {...form.register("author")}/></label>
            <label>ISBN<Input {...form.register("isbn")} placeholder="ISBN-10 or ISBN-13"/></label>
            <label>Language<Input {...form.register("language")}/></label>
            <label>Publisher<Input {...form.register("publisher")}/></label>
            <label>Category<Input {...form.register("category")}/></label>
            <label>Barcode (optional copy)<Input {...form.register("barcode")}/></label>
            <label>Accession number<Input {...form.register("accession")}/></label>
            <div className="md:col-span-2 flex gap-2">
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : "Save book"}</Button>
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search the catalog…" className="mb-4 max-w-xl"/>
      
      {result.data?.length ? (
        <Table headers={["Title", "Author", "ISBN", "Publisher / category", "Added"]}>
          {result.data.map((book) => (
            <tr 
              key={book.id} 
              onClick={() => setSelectedBook(book)}
              className="cursor-pointer hover:bg-emerald/5 dark:hover:bg-emerald/10 transition-colors"
            >
              <Cell>
                <strong>{book.title}</strong>
                {book.subtitle && <p className="text-xs text-ink/55">{book.subtitle}</p>}
              </Cell>
              <Cell>{book.author || "—"}</Cell>
              <Cell>{book.isbn13 || book.isbn10 || "—"}</Cell>
              <Cell>
                {book.publisher || "—"}
                <p className="text-xs text-ink/55">{book.category || "Uncategorized"}</p>
              </Cell>
              <Cell>{new Date(book.created_at).toLocaleDateString()}</Cell>
            </tr>
          ))}
        </Table>
      ) : (
        <EmptyState 
          icon={BookOpen}
          title="No catalog matches" 
          description="Add your first title or broaden the current search." 
          action={<Button onClick={() => setAdding(true)}>Add book</Button>}
        />
      )}

      {selectedBook && (
        <BookDetailsModal 
          book={selectedBook} 
          onClose={() => {
            setSelectedBook(null);
            invalidate();
          }} 
        />
      )}
    </>
  );
}

// Book Details Modal Component
function BookDetailsModal({ book, onClose }: { book: Book; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"details" | "copies">("details");
  const [isEditing, setIsEditing] = useState(false);
  const [addCopyOpen, setAddCopyOpen] = useState(false);

  // Queries
  const { data: copiesList, refetch: refetchCopies } = useQuery({
    queryKey: ["book-copies", book.id],
    queryFn: () => getCopiesForBook(book.id)
  });


  // Book edit form
  const editForm = useForm({
    defaultValues: {
      title: book.title,
      subtitle: book.subtitle || "",
      author: book.author || "",
      isbn: book.isbn13 || book.isbn10 || "",
      publisher: book.publisher || "",
      category: book.category || "",
      language: book.language,
      publication_year: book.publication_year ? String(book.publication_year) : "",
      call_number: book.call_number || ""
    }
  });

  // Copy add form
  const copyForm = useForm({
    defaultValues: { barcode: "", accession: "", condition: "good", shelf: "" }
  });



  // Mutations
  const updateBookMutation = useMutation({
    mutationFn: (values: any) => {
      const isbn = normalizeIsbn(values.isbn);
      return updateBook(book.id, {
        title: values.title,
        subtitle: values.subtitle || null,
        author: values.author,
        isbn10: isbn.length === 10 ? isbn : null,
        isbn13: isbn.length === 13 ? isbn : null,
        publisher: values.publisher,
        category: values.category,
        language: values.language,
        publication_year: values.publication_year ? Number(values.publication_year) : null,
        call_number: values.call_number || null
      });
    },
    onSuccess: () => {
      toast.success("Book metadata updated.");
      setIsEditing(false);
      invalidate();
      onClose();
    },
    onError: (err: any) => toast.error(err.message)
  });

  const deleteBookMutation = useMutation({
    mutationFn: () => deleteBook(book.id),
    onSuccess: () => {
      toast.success("Book and all copies archived.");
      invalidate();
      onClose();
    },
    onError: (err: any) => toast.error(err.message)
  });

  const addCopyMutation = useMutation({
    mutationFn: (values: any) => addCopy(book.id, values.barcode, values.accession, values.condition, values.shelf),
    onSuccess: () => {
      toast.success("Copy added.");
      copyForm.reset();
      setAddCopyOpen(false);
      refetchCopies();
      invalidate();
    },
    onError: (err: any) => toast.error(err.message)
  });

  const deleteCopyMutation = useMutation({
    mutationFn: (copyId: string) => deleteCopy(copyId),
    onSuccess: () => {
      toast.success("Copy archived.");
      refetchCopies();
      invalidate();
    },
    onError: (err: any) => toast.error(err.message)
  });



  return (
    <Modal isOpen={true} onClose={onClose} title={book.title}>
      <div className="flex border-b border-ink/10 mb-4 dark:border-parchment/10">
        <button 
          onClick={() => setActiveTab("details")} 
          className={cn("px-4 py-2 text-sm font-semibold border-b-2 transition-all", activeTab === "details" ? "border-emerald text-emerald" : "border-transparent text-ink/60 dark:text-parchment/60")}
        >
          Details
        </button>
        <button 
          onClick={() => setActiveTab("copies")} 
          className={cn("px-4 py-2 text-sm font-semibold border-b-2 transition-all", activeTab === "copies" ? "border-emerald text-emerald" : "border-transparent text-ink/60 dark:text-parchment/60")}
        >
          Copies ({copiesList?.length ?? 0})
        </button>
      </div>

      {activeTab === "details" && (
        <div className="space-y-4">
          {!isEditing ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-ink/40 dark:text-parchment/40 uppercase tracking-wider font-semibold">Author</p>
                <p className="text-sm font-medium">{book.author || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-ink/40 dark:text-parchment/40 uppercase tracking-wider font-semibold">Publisher</p>
                <p className="text-sm font-medium">{book.publisher || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-ink/40 dark:text-parchment/40 uppercase tracking-wider font-semibold">Category</p>
                <p className="text-sm font-medium">{book.category || "Uncategorized"}</p>
              </div>
              <div>
                <p className="text-xs text-ink/40 dark:text-parchment/40 uppercase tracking-wider font-semibold">Language</p>
                <p className="text-sm font-medium">{book.language}</p>
              </div>
              <div>
                <p className="text-xs text-ink/40 dark:text-parchment/40 uppercase tracking-wider font-semibold">Publication Year</p>
                <p className="text-sm font-medium">{book.publication_year || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-ink/40 dark:text-parchment/40 uppercase tracking-wider font-semibold">Call Number</p>
                <p className="text-sm font-medium font-mono">{book.call_number || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-ink/40 dark:text-parchment/40 uppercase tracking-wider font-semibold">ISBN-10</p>
                <p className="text-sm font-medium font-mono">{book.isbn10 || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-ink/40 dark:text-parchment/40 uppercase tracking-wider font-semibold">ISBN-13</p>
                <p className="text-sm font-medium font-mono">{book.isbn13 || "—"}</p>
              </div>
              {book.description && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-ink/40 dark:text-parchment/40 uppercase tracking-wider font-semibold">Description</p>
                  <p className="text-sm mt-1 leading-relaxed text-ink/80 dark:text-parchment/80">{book.description}</p>
                </div>
              )}
              <div className="sm:col-span-2 flex justify-between pt-4 border-t border-ink/10 dark:border-parchment/10">
                <Button variant="secondary" onClick={() => setIsEditing(true)}>
                  <Edit size={16} /> Edit Details
                </Button>
                <Button 
                  variant="danger" 
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this book? This will archive all of its copies.")) {
                      deleteBookMutation.mutate();
                    }
                  }}
                >
                  <Trash2 size={16} /> Archive Book
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={editForm.handleSubmit((v) => updateBookMutation.mutate(v))} className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">Title<Input {...editForm.register("title")}/></label>
              <label className="sm:col-span-2">Subtitle<Input {...editForm.register("subtitle")}/></label>
              <label>Author<Input {...editForm.register("author")}/></label>
              <label>ISBN<Input {...editForm.register("isbn")}/></label>
              <label>Publisher<Input {...editForm.register("publisher")}/></label>
              <label>Category<Input {...editForm.register("category")}/></label>
              <label>Language<Input {...editForm.register("language")}/></label>
              <label>Publication Year<Input {...editForm.register("publication_year")}/></label>
              <label className="sm:col-span-2">Call Number<Input {...editForm.register("call_number")}/></label>
              <div className="sm:col-span-2 flex gap-2 pt-2">
                <Button type="submit" disabled={updateBookMutation.isPending}>Save Changes</Button>
                <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
              </div>
            </form>
          )}
        </div>
      )}

      {activeTab === "copies" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-bold text-ink/75 dark:text-parchment/75">Active Copies</h4>
            <Button onClick={() => {
              if (!addCopyOpen) {
                copyForm.reset({
                  barcode: "",
                  accession: crypto.randomUUID(),
                  condition: "good",
                  shelf: ""
                });
              }
              setAddCopyOpen(!addCopyOpen);
            }}>
              <Plus size={16} /> {addCopyOpen ? "Hide Form" : "Add Copy"}
            </Button>
          </div>

          {addCopyOpen && (
            <Card className="p-4 bg-parchment/20 dark:bg-ink/20 border border-emerald/20">
              <form onSubmit={copyForm.handleSubmit((v) => addCopyMutation.mutate(v))} className="grid gap-3 sm:grid-cols-2">
                <label>Barcode<Input {...copyForm.register("barcode")} required/></label>
                <label>Accession Number<Input {...copyForm.register("accession")} placeholder="Leave blank to auto-generate"/></label>
                <label>Shelf Location (Code)<Input {...copyForm.register("shelf")} placeholder="e.g. A-12"/></label>
                <label>Condition
                  <select {...copyForm.register("condition")} className="field-select">
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                    <option value="damaged">Damaged</option>
                  </select>
                </label>
                <div className="sm:col-span-2 flex gap-2 justify-end">
                  <Button type="submit" disabled={addCopyMutation.isPending}>Save Copy</Button>
                  <Button type="button" variant="ghost" onClick={() => setAddCopyOpen(false)}>Cancel</Button>
                </div>
              </form>
            </Card>
          )}

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {copiesList?.length ? (
              copiesList.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-control border border-ink/10 dark:border-parchment/10 bg-parchment/10 dark:bg-ink/10">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{c.barcode} <span className="text-xs text-ink/55 dark:text-parchment/55">({c.accession_number})</span></p>
                    <p className="text-xs text-ink/60 dark:text-parchment/60 mt-0.5">
                      <MapPin size={11} className="inline mr-1" />
                      Shelf: {c.shelf || "Unassigned"} · Condition: <span className="underline">{c.condition}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge value={c.status} />
                    <button 
                      onClick={() => {
                        if (confirm(`Archive copy ${c.barcode}?`)) deleteCopyMutation.mutate(c.id);
                      }} 
                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition"
                      title="Archive Copy"
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-sm text-ink/50 dark:text-parchment/50">No copies registered for this book.</div>
            )}
          </div>
        </div>
      )}


    </Modal>
  );
}

const memberSchema = z.object({ 
  full_name: z.string().min(2, "A full name is required"), 
  email: z.string().email().or(z.literal("")).optional(), 
  phone: z.string().optional(), 
  department: z.string().optional(), 
  role: z.string().optional(),
  status: z.enum(["active", "suspended", "expired", "archived"]).optional()
});
type MemberValues = z.infer<typeof memberSchema>;

export function MembersPage() {
  const [term, setTerm] = useState(""); 
  const [adding, setAdding] = useState(false); 
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  const result = useQuery({ queryKey: ["members", term], queryFn: () => members(term) }); 
  const form = useForm<MemberValues>({ 
    resolver: zodResolver(memberSchema), 
    defaultValues: { full_name: "", email: "", phone: "", department: "", role: "", status: "active" } 
  });

  const mutation = useMutation({ 
    mutationFn: (values: MemberValues) => saveMember({ 
      full_name: values.full_name,
      email: values.email || null, 
      phone: values.phone || null, 
      department: values.department || null, 
      role: values.role || null, 
      status: values.status || "active", 
      expiry_date: null 
    }), 
    onSuccess: () => { 
      invalidate(); 
      toast.success("Member added."); 
      form.reset(); 
      setAdding(false); 
    }, 
    onError: (error) => toast.error(error.message) 
  });

  return (
    <>
      <PageTitle 
        title="Members" 
        detail="Manage borrowing eligibility, contact information, and membership." 
        action={<Button onClick={() => setAdding(!adding)}><UserPlus size={17}/> Add member</Button>}
      />
      
      {adding && (
        <Card className="mb-6">
          <form className="grid gap-3 md:grid-cols-2" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <label>Full name<Input {...form.register("full_name")}/>{form.formState.errors.full_name && <small className="text-red-700">{form.formState.errors.full_name.message}</small>}</label>
            <label>Email<Input type="email" {...form.register("email")}/></label>
            <label>Phone<Input {...form.register("phone")}/></label>
            <label>Department<Input {...form.register("department")}/></label>
            <label>Role / job title<Input {...form.register("role")}/></label>
            <div className="flex items-end pt-3">
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : "Save member"}</Button>
            </div>
          </form>
        </Card>
      )}

      <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search member name, number, contact, or department…" className="mb-4 max-w-xl"/>
      
      {result.data?.length ? (
        <Table headers={["Member", "Department", "Contact", "Status"]}>
          {result.data.map((member) => (
            <tr 
              key={member.id} 
              onClick={() => setSelectedMember(member)}
              className="cursor-pointer hover:bg-emerald/5 dark:hover:bg-emerald/10 transition-colors"
            >
              <Cell>
                <strong>{member.full_name}</strong>
                <p className="text-xs text-ink/55">{member.member_number}</p>
              </Cell>
              <Cell>{member.department || "—"}</Cell>
              <Cell>{member.email || member.phone || "—"}</Cell>
              <Cell><StatusBadge value={member.status}/></Cell>
            </tr>
          ))}
        </Table>
      ) : (
        <EmptyState 
          icon={UsersRound}
          title="No members found" 
          description="Register library patrons to start issuing loans." 
          action={<Button onClick={() => setAdding(true)}>Register member</Button>}
        />
      )}

      {selectedMember && (
        <MemberDetailsModal 
          member={selectedMember} 
          onClose={() => {
            setSelectedMember(null);
            invalidate();
          }} 
        />
      )}
    </>
  );
}

// Member Details Modal Component
function MemberDetailsModal({ member, onClose }: { member: Member; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"profile" | "loans" | "reservations">("profile");
  const [isEditing, setIsEditing] = useState(false);

  // Queries
  const { data: memberLoans, refetch: refetchLoans } = useQuery({
    queryKey: ["member-loans", member.id],
    queryFn: () => getLoansForMember(member.id)
  });
  const { data: memberReservations, refetch: refetchReservations } = useQuery({
    queryKey: ["member-reservations", member.id],
    queryFn: () => getReservationsForMember(member.id)
  });

  const { preferences } = useUiStore();

  const editForm = useForm({
    defaultValues: {
      full_name: member.full_name,
      email: member.email || "",
      phone: member.phone || "",
      department: member.department || "",
      role: member.role || "",
      status: member.status
    }
  });

  // Mutations
  const updateMemberMutation = useMutation({
    mutationFn: (values: any) => updateMember(member.id, values),
    onSuccess: () => {
      toast.success("Member profile updated.");
      setIsEditing(false);
      invalidate();
      onClose();
    },
    onError: (err: any) => toast.error(err.message)
  });

  const deleteMemberMutation = useMutation({
    mutationFn: () => deleteMember(member.id),
    onSuccess: () => {
      toast.success("Member archived.");
      invalidate();
      onClose();
    },
    onError: (err: any) => toast.error(err.message)
  });

  const renewLoanMutation = useMutation({
    mutationFn: (loanId: string) => renewLoan(loanId, preferences.loanDays),
    onSuccess: () => {
      toast.success("Loan renewed.");
      refetchLoans();
      invalidate();
    },
    onError: (err: any) => toast.error(err.message)
  });

  const returnCopyMutation = useMutation({
    mutationFn: (copyId: string) => returnCopies([copyId]),
    onSuccess: () => {
      toast.success("Item returned.");
      refetchLoans();
      invalidate();
    },
    onError: (err: any) => toast.error(err.message)
  });

  const cancelReservationMutation = useMutation({
    mutationFn: (resId: string) => cancelReservation(resId),
    onSuccess: () => {
      toast.success("Reservation cancelled.");
      refetchReservations();
      invalidate();
    },
    onError: (err: any) => toast.error(err.message)
  });

  return (
    <Modal isOpen={true} onClose={onClose} title={member.full_name}>
      <div className="flex border-b border-ink/10 mb-4 dark:border-parchment/10">
        <button 
          onClick={() => setActiveTab("profile")} 
          className={cn("px-4 py-2 text-sm font-semibold border-b-2 transition-all", activeTab === "profile" ? "border-emerald text-emerald" : "border-transparent text-ink/60 dark:text-parchment/60")}
        >
          Profile
        </button>
        <button 
          onClick={() => setActiveTab("loans")} 
          className={cn("px-4 py-2 text-sm font-semibold border-b-2 transition-all", activeTab === "loans" ? "border-emerald text-emerald" : "border-transparent text-ink/60 dark:text-parchment/60")}
        >
          Active Loans ({memberLoans?.filter(l => !l.returned_at).length ?? 0})
        </button>
        <button 
          onClick={() => setActiveTab("reservations")} 
          className={cn("px-4 py-2 text-sm font-semibold border-b-2 transition-all", activeTab === "reservations" ? "border-emerald text-emerald" : "border-transparent text-ink/60 dark:text-parchment/60")}
        >
          Reservations ({memberReservations?.filter(r => r.status === "queued" || r.status === "ready").length ?? 0})
        </button>
      </div>

      {activeTab === "profile" && (
        <div className="space-y-4">
          {!isEditing ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-ink/40 dark:text-parchment/40 uppercase tracking-wider font-semibold">Member Number</p>
                <p className="text-sm font-mono font-medium">{member.member_number}</p>
              </div>
              <div>
                <p className="text-xs text-ink/40 dark:text-parchment/40 uppercase tracking-wider font-semibold">Status</p>
                <p className="text-sm mt-0.5"><StatusBadge value={member.status}/></p>
              </div>
              <div>
                <p className="text-xs text-ink/40 dark:text-parchment/40 uppercase tracking-wider font-semibold">Email</p>
                <p className="text-sm font-medium">{member.email || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-ink/40 dark:text-parchment/40 uppercase tracking-wider font-semibold">Phone</p>
                <p className="text-sm font-medium">{member.phone || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-ink/40 dark:text-parchment/40 uppercase tracking-wider font-semibold">Department</p>
                <p className="text-sm font-medium">{member.department || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-ink/40 dark:text-parchment/40 uppercase tracking-wider font-semibold">Role / Job Title</p>
                <p className="text-sm font-medium">{member.role || "—"}</p>
              </div>
              <div className="sm:col-span-2 flex justify-between pt-4 border-t border-ink/10 dark:border-parchment/10">
                <Button variant="secondary" onClick={() => setIsEditing(true)}>
                  <Edit size={16} /> Edit Profile
                </Button>
                <Button 
                  variant="danger" 
                  onClick={() => {
                    if (confirm("Are you sure you want to archive this member?")) {
                      deleteMemberMutation.mutate();
                    }
                  }}
                >
                  <Trash2 size={16} /> Archive Member
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={editForm.handleSubmit((v) => updateMemberMutation.mutate(v))} className="grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">Full Name<Input {...editForm.register("full_name")}/></label>
              <label>Email<Input type="email" {...editForm.register("email")}/></label>
              <label>Phone<Input {...editForm.register("phone")}/></label>
              <label>Department<Input {...editForm.register("department")}/></label>
              <label>Role<Input {...editForm.register("role")}/></label>
              <label className="sm:col-span-2">Status
                <select {...editForm.register("status")} className="field-select">
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="expired">Expired</option>
                </select>
              </label>
              <div className="sm:col-span-2 flex gap-2 pt-2">
                <Button type="submit" disabled={updateMemberMutation.isPending}>Save Changes</Button>
                <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
              </div>
            </form>
          )}
        </div>
      )}

      {activeTab === "loans" && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-ink/75 dark:text-parchment/75">Current Active Loans</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {memberLoans?.filter(l => !l.returned_at).length ? (
              memberLoans.filter(l => !l.returned_at).map((loan) => {
                const lateDays = daysLate(loan.due_at);
                return (
                  <div key={loan.id} className="flex items-center justify-between p-3 rounded-control border border-ink/10 dark:border-parchment/10 bg-parchment/10 dark:bg-ink/10">
                    <div className="min-w-0 flex-1 mr-3">
                      <p className="font-semibold text-sm truncate">{loan.title}</p>
                      <p className="text-xs text-ink/65 dark:text-parchment/65 mt-0.5">
                        Barcode: <span className="font-mono">{loan.barcode}</span> · Due: {formatDisplayDate(loan.due_at)} 
                        {loan.renewed_count > 0 && ` (Renewed ${loan.renewed_count}x)`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {lateDays > 0 ? (
                        <span className="text-xs text-copper font-bold px-2 py-0.5 bg-copper/10 rounded">{lateDays}d late</span>
                      ) : (
                        <span className="text-xs text-emerald font-bold px-2 py-0.5 bg-emerald/10 rounded">On Time</span>
                      )}
                      <Button 
                        variant="secondary" 
                        onClick={() => renewLoanMutation.mutate(loan.id)}
                        disabled={renewLoanMutation.isPending}
                        title="Renew loan"
                      >
                        <RotateCw size={13} /> Renew
                      </Button>
                      <Button 
                        variant="primary" 
                        onClick={() => returnCopyMutation.mutate(loan.copy_id)}
                        disabled={returnCopyMutation.isPending}
                      >
                        Return
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6 text-sm text-ink/50 dark:text-parchment/50">No active loans.</div>
            )}
          </div>
        </div>
      )}

      {activeTab === "reservations" && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-ink/75 dark:text-parchment/75">Active Reservations</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {memberReservations?.filter(r => r.status === "queued" || r.status === "ready").length ? (
              memberReservations.filter(r => r.status === "queued" || r.status === "ready").map((res) => (
                <div key={res.id} className="flex items-center justify-between p-3 rounded-control border border-ink/10 dark:border-parchment/10 bg-parchment/10 dark:bg-ink/10">
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="font-semibold text-sm truncate">{res.title}</p>
                    <p className="text-xs text-ink/55 dark:text-parchment/55 mt-0.5">
                      Reserved: {new Date(res.reserved_at).toLocaleDateString()} · Queue: #{res.position}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge value={res.status} />
                    <Button 
                      variant="danger" 
                      onClick={() => {
                        if (confirm("Cancel this reservation?")) {
                          cancelReservationMutation.mutate(res.id);
                        }
                      }}
                      disabled={cancelReservationMutation.isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-sm text-ink/50 dark:text-parchment/50">No active reservations.</div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export function CirculationPage() {
  const prefs = useUiStore((state) => state.preferences); 
  const memberQuery = useQuery({ queryKey: ["members", "all"], queryFn: () => members() }); 
  const copyQuery = useQuery({ queryKey: ["copies", "all"], queryFn: () => copies() }); 
  const loanQuery = useQuery({ queryKey: ["loans", "open"], queryFn: () => loans(true) });

  const [memberId, setMemberId] = useState(""); 
  const [copyId, setCopyId] = useState(""); 
  const [returns, setReturns] = useState<string[]>([]);
  const [barcodeInput, setBarcodeInput] = useState("");

  const checkoutMutation = useMutation({ 
    mutationFn: () => checkout(memberId, copyId ? [copyId] : [], prefs.loanLimit, prefs.loanDays), 
    onSuccess: () => { 
      invalidate(); 
      toast.success("Checkout recorded."); 
      setCopyId(""); 
    }, 
    onError: (error) => toast.error(error.message) 
  });

  const returnMutation = useMutation({ 
    mutationFn: (targetIds?: string[]) => returnCopies(targetIds || returns), 
    onSuccess: () => { 
      invalidate(); 
      toast.success("Return recorded and reservations advanced."); 
      setReturns([]); 
    }, 
    onError: (error) => toast.error(error.message) 
  });

  const renewMutation = useMutation({
    mutationFn: (loanId: string) => renewLoan(loanId, prefs.loanDays),
    onSuccess: () => {
      invalidate();
      toast.success("Loan renewed.");
    },
    onError: (error) => toast.error(error.message)
  });

  // Quick Barcode Scan Logic
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const barcode = barcodeInput.trim();
    if (!barcode) return;

    // 1. Check if the copy is currently loaned out
    const activeLoan = loanQuery.data?.find(l => l.barcode === barcode);
    if (activeLoan) {
      // Return it immediately!
      returnMutation.mutate([activeLoan.copy_id]);
      toast.success(`Automatically returned: "${activeLoan.title}" (borrower: ${activeLoan.member_name})`);
      setBarcodeInput("");
      return;
    }

    // 2. Check if the copy is available
    const existingCopy = copyQuery.data?.find(c => c.barcode === barcode || c.accession_number === barcode);
    if (existingCopy) {
      if (existingCopy.status === "available") {
        setCopyId(existingCopy.id);
        toast.info(`Copy found: "${existingCopy.title}". Select a member to complete checkout.`);
        setBarcodeInput("");
      } else {
        toast.error(`Copy is not available for checkout. Current status: ${existingCopy.status}`);
      }
    } else {
      toast.error(`Barcode/Accession "${barcode}" not found in system.`);
    }
  };

  return (
    <>
      <PageTitle title="Circulation" detail="Scanner-friendly checkout, returns, renewals, and overdue follow-up."/>
      
      {/* Quick Barcode Action Banner */}
      <Card className="mb-6 border-emerald/20 bg-emerald/5 dark:bg-emerald/10">
        <form onSubmit={handleBarcodeSubmit} className="flex gap-3 items-center">
          <div className="flex-1 relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-emerald font-semibold">
              <ScanLine size={18} />
            </span>
            <input 
              type="text" 
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Quick Scan: enter barcode or accession number to return or select copy..." 
              className="w-full rounded-control border border-emerald/30 bg-white pl-10 pr-3 py-2 text-sm text-ink outline-none placeholder:text-ink/40 focus:border-emerald focus:ring-2 focus:ring-emerald/20 dark:border-emerald/40 dark:bg-ink/30 dark:text-parchment"
              autoFocus
            />
          </div>
          <Button type="submit">Submit</Button>
        </form>
        <p className="text-xs text-ink/50 dark:text-parchment/50 mt-2">
          Tip: Scanning a borrowed copy immediately returns it. Scanning an available copy selects it for checkout.
        </p>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="font-display text-xl font-bold">Checkout</h2>
          <p className="mt-1 text-sm text-ink/60 dark:text-parchment/60">Select an active member and an available barcode or accession.</p>
          <div className="mt-4 grid gap-3">
            <label>Member
              <SearchableSelect
                options={memberQuery.data?.filter((m) => m.status === "active") || []}
                labelKey="full_name"
                valueKey="id"
                subLabelKey="member_number"
                placeholder="Select or search member"
                value={memberId}
                onChange={setMemberId}
              />
            </label>
            <label>Available copy
              <SearchableSelect
                options={copyQuery.data?.filter((copy) => copy.status === "available") || []}
                labelKey="title"
                valueKey="id"
                subLabelKey="barcode"
                placeholder="Scan or select copy"
                value={copyId}
                onChange={setCopyId}
              />
            </label>
            <Button disabled={!memberId || !copyId || checkoutMutation.isPending} onClick={() => checkoutMutation.mutate()}>
              <ScanLine size={17}/>{checkoutMutation.isPending ? "Checking out…" : "Confirm checkout"}
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-xl font-bold">Return</h2>
          <p className="mt-1 text-sm text-ink/60 dark:text-parchment/60">Select open loans; returns may make the next reservation ready.</p>
          <div className="mt-4 max-h-52 space-y-2 overflow-auto pr-1">
            {loanQuery.data?.length ? (
              loanQuery.data.map((loan) => (
                <label className="flex cursor-pointer items-center gap-3 rounded-control border border-ink/10 p-3 bg-parchment/5 hover:bg-parchment/10 dark:border-parchment/10 dark:bg-ink/5 dark:hover:bg-ink/10" key={loan.id}>
                  <input 
                    type="checkbox" 
                    checked={returns.includes(loan.copy_id)} 
                    onChange={(e) => setReturns((current) => e.target.checked ? [...current, loan.copy_id] : current.filter((id) => id !== loan.copy_id))}
                  />
                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm truncate">{loan.title}</strong>
                    <small className="block text-xs text-ink/55 dark:text-parchment/55 mt-0.5">{loan.member_name} · {loan.barcode}</small>
                  </span>
                  {daysLate(loan.due_at) > 0 && <StatusBadge value="overdue"/>}
                </label>
              ))
            ) : (
              <p className="text-sm text-ink/60 dark:text-parchment/60 py-4 text-center">No open loans.</p>
            )}
          </div>
          <Button className="mt-4" variant="secondary" disabled={!returns.length || returnMutation.isPending} onClick={() => returnMutation.mutate(undefined)}>
            <RotateCcw size={17}/>{returnMutation.isPending ? "Returning…" : "Confirm return"}
          </Button>
        </Card>
      </div>

      <div className="mt-6">
        {loanQuery.data?.length ? (
          <Table headers={["Title / barcode", "Borrower", "Due", "Actions", "Status"]}>
            {loanQuery.data.map((loan) => (
              <tr key={loan.id}>
                <Cell>
                  <strong>{loan.title}</strong>
                  <p className="text-xs text-ink/55 dark:text-parchment/55">{loan.barcode}</p>
                </Cell>
                <Cell>{loan.member_name}</Cell>
                <Cell>{formatDisplayDate(loan.due_at)}</Cell>
                <Cell>
                  <div className="flex gap-2">
                    <Button 
                      variant="secondary" 
                      className="py-1 px-2.5 text-xs" 
                      onClick={() => renewMutation.mutate(loan.id)}
                      disabled={renewMutation.isPending}
                    >
                      Renew
                    </Button>
                    <Button 
                      variant="primary" 
                      className="py-1 px-2.5 text-xs"
                      onClick={() => returnMutation.mutate([loan.copy_id])}
                      disabled={returnMutation.isPending}
                    >
                      Return
                    </Button>
                  </div>
                </Cell>
                <Cell><StatusBadge value={daysLate(loan.due_at) > 0 ? "overdue" : "on-loan"}/></Cell>
              </tr>
            ))}
          </Table>
        ) : null}
      </div>
    </>
  );
}

export function ReservationsPage() { 
  const result = useQuery({ queryKey: ["reservations"], queryFn: reservations }); 
  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelReservation(id),
    onSuccess: () => {
      invalidate();
      toast.success("Reservation cancelled.");
    },
    onError: (err) => toast.error(err.message)
  });

  return (
    <>
      <PageTitle title="Reservations" detail="Queued requests advance automatically when copies are returned."/>
      {result.data?.length ? (
        <Table headers={["Title", "Member", "Queue", "Status", "Reserved", "Action"]}>
          {result.data.map((reservation) => (
            <tr key={reservation.id}>
              <Cell><strong>{reservation.title}</strong></Cell>
              <Cell>{reservation.member_name}</Cell>
              <Cell>#{reservation.position}</Cell>
              <Cell><StatusBadge value={reservation.status}/></Cell>
              <Cell>{new Date(reservation.reserved_at).toLocaleDateString()}</Cell>
              <Cell>
                {(reservation.status === "queued" || reservation.status === "ready") && (
                  <Button 
                    variant="danger" 
                    className="py-1 px-2 text-xs" 
                    onClick={() => {
                      if (confirm("Cancel this reservation?")) cancelMutation.mutate(reservation.id);
                    }}
                    disabled={cancelMutation.isPending}
                  >
                    Cancel
                  </Button>
                )}
              </Cell>
            </tr>
          ))}
        </Table>
      ) : (
        <EmptyState icon={Clock3} title="No reservations" description="Reservations become available from each title’s catalog details."/>
      )}
    </>
  ); 
}

export function InventoryPage() { 
  const result = useQuery({ queryKey: ["copies", "inventory"], queryFn: () => copies() }); 
  const [selectedCopy, setSelectedCopy] = useState<(Copy & { title: string }) | null>(null);

  const counts = useMemo(() => result.data?.reduce<Record<string, number>>((all, copy) => { 
    all[copy.status] = (all[copy.status] ?? 0) + 1; 
    return all; 
  }, {}) ?? {}, [result.data]); 

  return (
    <>
      <PageTitle title="Inventory & shelves" detail="Review copy condition and status before running a shelf-scanning session."/>
      <div className="grid gap-4 md:grid-cols-3">
        {Object.entries(counts).map(([status, count]) => (
          <Card key={status}>
            <StatusBadge value={status}/>
            <p className="mt-3 font-display text-3xl font-bold">{count}</p>
          </Card>
        ))}
      </div>
      
      {result.data?.length ? (
        <div className="mt-6">
          <Table headers={["Copy", "Title", "Shelf", "Condition", "Status"]}>
            {result.data.map((copy) => (
              <tr 
                key={copy.id} 
                className="cursor-pointer hover:bg-emerald/5 dark:hover:bg-emerald/10 transition-colors"
                onClick={() => setSelectedCopy(copy)}
              >
                <Cell>
                  <strong>{copy.accession_number}</strong>
                  <p className="text-xs text-ink/55 dark:text-parchment/55">{copy.barcode}</p>
                </Cell>
                <Cell>{copy.title}</Cell>
                <Cell>{copy.shelf || "Unassigned"}</Cell>
                <Cell>{copy.condition}</Cell>
                <Cell><StatusBadge value={copy.status}/></Cell>
              </tr>
            ))}
          </Table>
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState icon={BookCopy} title="No copies to inventory" description="Add a barcode when cataloguing a title to create its first copy."/>
        </div>
      )}

      {selectedCopy && (
        <CopyEditModal 
          copy={selectedCopy} 
          onClose={() => {
            setSelectedCopy(null);
            invalidate();
          }}
        />
      )}
    </>
  ); 
}

// Copy Editing Modal Component
function CopyEditModal({ copy, onClose }: { copy: Copy & { title: string }; onClose: () => void }) {
  const form = useForm({
    defaultValues: {
      shelf: copy.shelf || "",
      condition: copy.condition,
      status: copy.status
    }
  });

  const mutation = useMutation({
    mutationFn: (values: any) => updateCopy(copy.id, values),
    onSuccess: () => {
      toast.success("Copy details updated.");
      onClose();
    },
    onError: (err: any) => toast.error(err.message)
  });

  return (
    <Modal isOpen={true} onClose={onClose} title={`Edit Copy: ${copy.barcode}`}>
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        <div>
          <p className="text-xs text-ink/40 dark:text-parchment/40 uppercase tracking-wider font-semibold">Title</p>
          <p className="text-sm font-medium">{copy.title}</p>
        </div>
        
        <label>Shelf Location (Code)
          <Input {...form.register("shelf")} placeholder="e.g. A-12" />
        </label>

        <label>Condition
          <select {...form.register("condition")} className="field-select">
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="poor">Poor</option>
            <option value="damaged">Damaged</option>
          </select>
        </label>

        <label>Status
          <select {...form.register("status")} className="field-select">
            <option value="available">Available</option>
            <option value="on-loan">On Loan</option>
            <option value="reserved">Reserved</option>
            <option value="repair">In Repair</option>
            <option value="lost">Lost</option>
          </select>
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="submit" disabled={mutation.isPending}>Save changes</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}

export function ReportsPage() { 
  const metrics = useQuery({ queryKey: ["dashboard"], queryFn: dashboard }); 
  const loansQuery = useQuery({ queryKey: ["loans", "all"], queryFn: () => loans() }); 
  const overdue = loansQuery.data?.filter((loan) => !loan.returned_at && daysLate(loan.due_at) > 0) ?? []; 
  return (
    <>
      <PageTitle title="Reports" detail="Local, filterable reporting with accessible tabular results."/>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-ink/60 dark:text-parchment/60">Titles in catalog</p>
          <p className="font-display text-3xl font-bold">{metrics.data?.titles ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-ink/60 dark:text-parchment/60">Circulation records</p>
          <p className="font-display text-3xl font-bold">{loansQuery.data?.length ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-ink/60 dark:text-parchment/60">Overdue loans</p>
          <p className="font-display text-3xl font-bold">{overdue.length}</p>
        </Card>
      </div>
      <div className="mt-6">
        {overdue.length ? (
          <Table headers={["Title", "Member", "Due", "Days overdue"]}>
            {overdue.map((loan) => (
              <tr key={loan.id}>
                <Cell>{loan.title}</Cell>
                <Cell>{loan.member_name}</Cell>
                <Cell>{formatDisplayDate(loan.due_at)}</Cell>
                <Cell>{daysLate(loan.due_at)}</Cell>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState icon={ShieldCheck} title="No overdue loans" description="The overdue aging report is clear"/>
        )}
      </div>
    </>
  ); 
}

export function ActivityPage() { 
  const result = useQuery({ queryKey: ["activity"], queryFn: auditLog }); 
  return (
    <>
      <PageTitle title="Activity" detail="Immutable local audit history for important library actions."/>
      <Table headers={["When", "Actor", "Action", "Entity"]}>
        {result.data?.map((item) => (
          <tr key={item.id}>
            <Cell>{formatDisplayDate(item.created_at)}</Cell>
            <Cell>{item.actor}</Cell>
            <Cell>{item.action}</Cell>
            <Cell>{item.entity_type} · <span className="font-mono text-xs">{item.entity_id.slice(0, 8)}</span></Cell>
          </tr>
        ))}
      </Table>
    </>
  ); 
}

export function SettingsPage() {
  const { preferences, updatePreferences } = useUiStore();
  const [name, setName] = useState(preferences.libraryName);
  const [operator, setOperator] = useState(preferences.operatorName);
  const save = () => {
    updatePreferences({ libraryName: name, operatorName: operator });
    toast.success("Settings saved.");
  };

  return (
    <>
      <PageTitle title="Settings" detail="Preferences are stored locally; integration secrets are isolated in Stronghold." />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 items-start w-full">
        <Card className="flex flex-col h-full justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">General</h2>
            <div className="mt-4 grid gap-3">
              <label>Library name<Input value={name} onChange={(e) => setName(e.target.value)}/></label>
              <label>Operator name<Input value={operator} onChange={(e) => setOperator(e.target.value)}/></label>
              <label>Language
                <select value={preferences.locale} className="field-select" onChange={(e) => {
                  const locale = e.target.value as "en" | "fr" | "ar";
                  updatePreferences({ locale });
                  document.documentElement.lang = locale;
                  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
                }}>
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                  <option value="ar">العربية</option>
                </select>
              </label>
              <label>Theme
                <select value={preferences.theme} className="field-select" onChange={(e) => {
                  const theme = e.target.value as "light" | "dark" | "system";
                  updatePreferences({ theme });
                  document.documentElement.classList.toggle("dark", theme === "dark");
                }}>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </label>
            </div>
          </div>
          <Button className="mt-6 w-full" onClick={save}>Save general settings</Button>
        </Card>

        <Card className="h-full">
          <h2 className="font-display text-xl font-bold">Circulation rules</h2>
          <div className="mt-4 grid gap-3">
            <label>Loan duration<Input type="number" min="1" value={preferences.loanDays} onChange={(e) => updatePreferences({ loanDays: Number(e.target.value) || 1 })}/></label>
            <label>Loan limit<Input type="number" min="1" value={preferences.loanLimit} onChange={(e) => updatePreferences({ loanLimit: Number(e.target.value) || 1 })}/></label>
            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={preferences.finesEnabled} onChange={(e) => updatePreferences({ finesEnabled: e.target.checked })}/>
                <span>Enable fines</span>
              </label>
            </div>
          </div>
        </Card>

        <Card className="h-full">
          <h2 className="font-display text-xl font-bold">Desktop & data</h2>
          <p className="mt-2 text-sm text-ink/65 dark:text-parchment/65 leading-relaxed">
            Close-to-tray, autostart, secret management, provider settings, backup, restore, and database health are managed by the native desktop service.
          </p>
          <div className="mt-6">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={preferences.closeToTray} onChange={(e) => updatePreferences({ closeToTray: e.target.checked })}/>
              <span>Hide to tray when closing</span>
            </label>
          </div>
          <div className="mt-8 pt-6 border-t border-ink/10 dark:border-parchment/10">
            <h3 className="font-semibold text-sm mb-2">Development Tools</h3>
            <Button 
              variant="secondary" 
              onClick={async () => {
                const toastId = toast.loading("Seeding dummy data...");
                try {
                  await seedDummyData();
                  toast.success("Database seeded successfully!", { id: toastId });
                  invalidate();
                } catch (e: any) {
                  toast.error("Failed to seed: " + e.message, { id: toastId });
                }
              }}
            >
              Seed Dummy Data
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}

export function OnboardingPage() {
  const { preferences, updatePreferences } = useUiStore();
  const [name, setName] = useState(preferences.libraryName);
  const [operator, setOperator] = useState("");
  const navigate = () => location.assign("#/dashboard");
  return (
    <main className="onboarding-screen">
      <section className="onboarding-panel" aria-labelledby="onboarding-title">
        <div className="onboarding-brand">
          <span className="onboarding-mark"><img src="/brand/warraq-symbol-cream.png" alt=""/></span>
          <div><strong>WARRAQ</strong><span>Library management system</span></div>
        </div>
        <div className="onboarding-heading"><p className="eyebrow">FIRST-RUN SETUP</p><h1 id="onboarding-title">Welcome to Warraq</h1><p>Set up your local library workspace. You can change these choices any time in Settings.</p></div>
        <div className="onboarding-form">
          <label>Library name<Input value={name} onChange={(e) => setName(e.target.value)} autoFocus/></label>
          <label>Administrator / librarian<Input value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="Your name"/></label>
          <label>Default loan duration <span className="label-hint">days</span><Input type="number" min="1" value={preferences.loanDays} onChange={(e) => updatePreferences({ loanDays: Number(e.target.value) || 21 })}/></label>
          <label className="fine-toggle"><input className="sr-only" type="checkbox" checked={preferences.finesEnabled} onChange={(e) => updatePreferences({ finesEnabled: e.target.checked })}/><span className="custom-checkbox" aria-hidden="true"><Check size={13}/></span><span><strong>Enable optional fines</strong><small>Keep overdue fine records for your library.</small></span></label>
          <Button className="onboarding-submit" disabled={!name.trim() || !operator.trim()} onClick={() => { updatePreferences({ libraryName: name.trim(), operatorName: operator.trim(), onboardingComplete: true }); navigate(); }}>Start using Warraq <span aria-hidden="true">→</span></Button>
        </div>
        <p className="onboarding-security"><ShieldCheck size={15}/> Your library data stays securely on this device.</p>
      </section>
    </main>
  );
}
