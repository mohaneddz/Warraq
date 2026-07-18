import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  BookOpen, Plus, Search,
  MoreHorizontal, ChevronLeft, ChevronRight, X, Clock, Edit2, Trash2, MapPin, Sparkles
} from "lucide-react";
import {
  books, saveBook, updateBook, deleteBook, getCopiesForBook,
  addCopy, deleteCopy, addReservation, members, auditLog
} from "../data/repositories/library";
import type { Book } from "../types";
import { Modal, Input, Button, StatusBadge } from "../components/ui/primitives";
import { SearchableSelect } from "../components/ui/shared";
import { toast } from "sonner";
import { 
  isValidIsbn, normalizeIsbn, cleanBarcode, 
  cleanAccession, cleanText, formatIsbn 
} from "../utils/isbn";
import { queryClient } from "../app/providers";
import { fetchBookMetadata, enrichMetadataWithGroq } from "../utils/metadata";
import { useUiStore } from "../store/uiStore";
import { useLocation } from "react-router-dom";
import { ImageUpload } from "../components/ui/ImageUpload";
import { useTranslation } from "react-i18next";
import { formatDisplayDate } from "../utils/dates";

const invalidate = () => queryClient.invalidateQueries();

const bookSchema = z.object({
  title: z.string().min(2, "A title is required"),
  subtitle: z.string().optional(),
  arabic_title: z.string().optional(),
  tags: z.string().optional(),
  author: z.string().optional(),
  isbn: z.string().optional(),
  language: z.string().min(2, "Language must be at least 2 characters"),
  publisher: z.string().optional(),
  category: z.string().optional(),
  barcode: z.string().optional(),
  accession: z.string().optional(),
  description: z.string().optional(),
  cover_path: z.string().nullable().optional()
});
type BookValues = z.infer<typeof bookSchema>;

export function CatalogPage() {
  const { t } = useTranslation();
  const location = useLocation();

  const [term, setTerm] = useState("");
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [adding, setAdding] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  // Sorting, Filtering & Pagination State
  const [sortBy, setSortBy] = useState<"title" | "author" | "category" | "isbn" | "created_at" | "available_copies">("title");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [savedView, setSavedView] = useState("All Books");
  const [langFilter, setLangFilter] = useState("All Languages");
  const [catFilter, setCatFilter] = useState("All Categories");
  const [page, setPage] = useState(1);
  const itemsPerPage = useUiStore((state) => state.preferences.pageSize) || 10;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Handle query parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get("q");
    if (q) setTerm(q);

    const action = params.get("action");
    if (action === "add-book") {
      setAdding(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const focus = params.get("focus");
    if (focus === "search") {
      setTimeout(() => {
        document.getElementById("catalog-page-search")?.focus();
      }, 100);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location.search]);

  // Quick fetch
  const result = useQuery({ queryKey: ["books", term], queryFn: () => books(term) });

  const addForm = useForm<BookValues>({
    resolver: zodResolver(bookSchema),
    defaultValues: { title: "", subtitle: "", arabic_title: "", tags: "", author: "", isbn: "", language: "English", publisher: "", category: "", barcode: "", accession: "", description: "", cover_path: null }
  });
  const watchedTags = addForm.watch("tags");

  // Form input standardizer helper
  const registerClean = (form: any, name: any, cleaner: (val: string) => string) => {
    const reg = form.register(name);
    return {
      ...reg,
      onBlur: (e: any) => {
        form.setValue(name, cleaner(e.target.value));
        reg.onBlur(e);
      }
    };
  };

  const addMutation = useMutation({
    mutationFn: async (values: BookValues) => {
      const isbn = normalizeIsbn(values.isbn ?? "");
      if (isbn && !isValidIsbn(isbn)) throw new Error(t("catalog.alerts.invalidIsbn") || "Enter a valid ISBN-10 or ISBN-13.");
      return saveBook({
        title: cleanText(values.title),
        language: cleanText(values.language),
        subtitle: values.subtitle ? cleanText(values.subtitle) : null,
        arabic_title: values.arabic_title ? cleanText(values.arabic_title) : null,
        tags: values.tags ? cleanText(values.tags) : null,
        isbn10: isbn.length === 10 ? isbn : null,
        isbn13: isbn.length === 13 ? isbn : null,
        publisher: values.publisher ? cleanText(values.publisher) : "",
        category: values.category ? cleanText(values.category) : "",
        author: values.author ? cleanText(values.author) : "",
        barcode: values.barcode ? cleanBarcode(values.barcode) : "",
        accession: values.accession ? cleanAccession(values.accession) : "",
        description: values.description ? cleanText(values.description) : null,
        cover_path: values.cover_path || null
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success(t("catalog.alerts.bookSaved") || "Book saved to the catalog.");
      addForm.reset();
      setAdding(false);
    },
    onError: (error: any) => {
      console.error("Save book error detail:", error);
      toast.error(error?.message || String(error) || t("catalog.alerts.saveError") || "An unknown error occurred while saving the book.");
    }
  });

  const bulkArchiveMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(selectedIds.map(id => deleteBook(id)));
    },
    onSuccess: () => {
      invalidate();
      toast.success(t("catalog.alerts.bulkArchived") || "Selected books archived.");
      setSelectedIds([]);
    },
    onError: (error: any) => {
      toast.error(error?.message || t("catalog.alerts.bulkArchiveFailed") || "Failed to archive books.");
    }
  });

  const handleBulkArchive = () => {
    if (confirm(t("catalog.alerts.confirmBulkArchive", { count: selectedIds.length }) || `Are you sure you want to archive ${selectedIds.length} selected book(s)? This will archive all of their copies.`)) {
      bulkArchiveMutation.mutate();
    }
  };

  const handleIsbnLookup = async () => {
    const isbnVal = addForm.getValues("isbn");
    const titleVal = addForm.getValues("title");
    const queryVal = isbnVal?.trim() || titleVal?.trim();
    if (!queryVal) {
      toast.warning(t("catalog.alerts.typeQuery") || "Please type an ISBN or book title to fetch details.");
      return;
    }
    setLookupLoading(true);
    const toastId = toast.loading(t("catalog.alerts.querying") || "Querying metadata provider...");

    let meta: any = null;
    let queryError: any = null;

    try {
      meta = await fetchBookMetadata(queryVal);
    } catch (err: any) {
      queryError = err;
    }

    const apiKey = useUiStore.getState().preferences.groqApiKey;

    if (!meta && !apiKey) {
      toast.error(queryError?.message || t("catalog.alerts.notFound") || "Could not find any metadata matches for this query.", { id: toastId });
      setLookupLoading(false);
      return;
    }

    try {
      if (apiKey) {
        toast.loading(t("catalog.alerts.enriching") || "Enriching metadata with Groq AI...", { id: toastId });
        meta = await enrichMetadataWithGroq(queryVal, meta || {}, apiKey);
        toast.success(t("catalog.alerts.enriched") || "Book metadata auto-filled & enriched with Groq AI!", { id: toastId });
      } else {
        toast.success(t("catalog.alerts.autofilled") || "Book metadata auto-filled!", { id: toastId });
        toast.info(t("catalog.alerts.groqTip") || "Tip: Configure your Groq API Key in Settings to get auto-translated Arabic titles, detailed descriptions, and targeted tags.", {
          duration: 8000
        });
      }

      if (meta) {
        addForm.setValue("title", cleanText(meta.title));
        addForm.setValue("subtitle", meta.subtitle ? cleanText(meta.subtitle) : "");
        addForm.setValue("arabic_title", meta.arabic_title ? cleanText(meta.arabic_title) : "");
        addForm.setValue("tags", meta.tags ? cleanText(meta.tags) : "");
        if (meta.author) addForm.setValue("author", cleanText(meta.author));
        if (meta.publisher) addForm.setValue("publisher", cleanText(meta.publisher));
        if (meta.category) addForm.setValue("category", cleanText(meta.category));
        if (meta.language) addForm.setValue("language", cleanText(meta.language));
        if (meta.description) addForm.setValue("description", cleanText(meta.description));

        // Autofill retrieved ISBN if not already entered by the user
        const retrievedIsbn = meta.isbn13 || meta.isbn10 || "";
        if (retrievedIsbn) {
          addForm.setValue("isbn", formatIsbn(retrievedIsbn));
        }

        // Download cover url and convert to base64
        if (meta.cover_url) {
          try {
            toast.loading(t("catalog.alerts.downloadingCover") || "Downloading book cover image...", { id: toastId });
            const response = await fetch(meta.cover_url);
            if (response.ok) {
              const blob = await response.blob();
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64data = reader.result as string;
                addForm.setValue("cover_path", base64data);
                toast.success(t("catalog.alerts.coverDownloaded") || "Book cover downloaded!", { id: toastId });
              };
              reader.readAsDataURL(blob);
            } else {
              addForm.setValue("cover_path", meta.cover_url);
            }
          } catch (e) {
            console.error("Cover image download failed", e);
            addForm.setValue("cover_path", meta.cover_url);
          }
        }
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setLookupLoading(false);
    }
  };

  // Extract categories dynamically
  const categoriesList = useMemo(() => {
    if (!result.data) return [];
    const set = new Set(result.data.map(b => b.category).filter(Boolean));
    return Array.from(set) as string[];
  }, [result.data]);

  // Combine filters
  const filteredBooks = useMemo(() => {
    if (!result.data) return [];
    return result.data.filter(b => {
      // Saved views
      if (savedView === "Recent Additions") {
        const addedDate = new Date(b.created_at);
        const diff = Date.now() - addedDate.getTime();
        if (diff > 7 * 24 * 60 * 60 * 1000) return false;
      } else if (savedView === "Available Now") {
        if ((b.available_copies ?? 0) === 0) return false;
      } else if (savedView === "Out of Stock") {
        if ((b.available_copies ?? 0) > 0) return false;
      }

      // Language filter
      if (langFilter !== "All Languages") {
        if ((b.language || "").toLowerCase() !== langFilter.toLowerCase()) return false;
      }

      // Category filter
      if (catFilter !== "All Categories") {
        if (b.category !== catFilter) return false;
      }

      return true;
    });
  }, [result.data, savedView, langFilter, catFilter]);

  // Sort Books
  const sortedBooks = useMemo(() => {
    const list = [...filteredBooks];
    return list.sort((a, b) => {
      let valA: any = "";
      let valB: any = "";
      if (sortBy === "title") { valA = a.title || ""; valB = b.title || ""; }
      else if (sortBy === "author") { valA = a.author || ""; valB = b.author || ""; }
      else if (sortBy === "category") { valA = a.category || ""; valB = b.category || ""; }
      else if (sortBy === "isbn") { valA = a.isbn13 || a.isbn10 || ""; valB = b.isbn13 || b.isbn10 || ""; }
      else if (sortBy === "created_at") { valA = a.created_at || ""; valB = b.created_at || ""; }
      else if (sortBy === "available_copies") { valA = a.available_copies ?? 0; valB = b.available_copies ?? 0; }

      if (typeof valA === "number" && typeof valB === "number") {
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }

      return sortOrder === "asc"
        ? String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' })
        : String(valB).localeCompare(String(valA), undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [filteredBooks, sortBy, sortOrder]);

  // Paginated Books
  const paginatedBooks = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return sortedBooks.slice(start, start + itemsPerPage);
  }, [sortedBooks, page, itemsPerPage]);

  const totalPages = Math.ceil(sortedBooks.length / itemsPerPage) || 1;

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  return (
    <div className="flex h-full w-full relative">
      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${selectedBook ? "pr-6 border-r border-black/5 dark:border-white/5 mr-6" : ""}`}>

        {/* Header */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="font-display text-[28px] font-bold text-[#122222] dark:text-white leading-tight">{t("catalog.title")}</h1>
            <p className="text-[13px] text-[#122222]/60 dark:text-white/60">{t("catalog.subtitle", { count: sortedBooks.length })}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-2 bg-emerald text-white px-4 py-2 rounded-lg font-bold text-[13px] hover:bg-emerald/90 transition-colors shadow-sm shadow-emerald/20 cursor-pointer"
            >
              <Plus size={16} /> {t("catalog.addBook")}
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#122222]/40" />
            <input
              id="catalog-page-search"
              type="text"
              placeholder={t("catalog.searchPlaceholder")}
              value={term}
              onChange={(e) => { setTerm(e.target.value); setPage(1); }}
              className="w-full bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-lg py-2 pl-9 pr-3 text-[13px] text-[#122222] dark:text-[#f0ebe1] outline-none focus:border-emerald focus:ring-1 focus:ring-emerald"
            />
          </div>

          {/* Category Filter Select */}
          <select
            value={catFilter}
            onChange={(e) => { setCatFilter(e.target.value); setPage(1); }}
            className="bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-lg py-2 px-4 text-[13px] font-semibold text-[#122222]/70 dark:text-white/70 outline-none cursor-pointer hover:border-emerald/30 transition-colors"
          >
            <option value="All Categories">{t("catalog.allCategories")}</option>
            {categoriesList.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Language Filter Select */}
          <select
            value={langFilter}
            onChange={(e) => { setLangFilter(e.target.value); setPage(1); }}
            className="bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-lg py-2 px-4 text-[13px] font-semibold text-[#122222]/70 dark:text-white/70 outline-none cursor-pointer hover:border-emerald/30 transition-colors"
          >
            <option value="All Languages">{t("catalog.allLanguages")}</option>
            <option value="English">{t("languages.english") || "English"}</option>
            <option value="Arabic">{t("languages.arabic") || "Arabic"}</option>
            <option value="French">{t("languages.french") || "French"}</option>
          </select>
        </div>

        {/* Saved Views */}
        <div className="flex items-center justify-between bg-white dark:bg-[#1d2926] p-1.5 rounded-lg border border-black/5 dark:border-white/5 mb-4 shadow-card">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-semibold text-[#122222]/40 dark:text-white/40 uppercase tracking-wider pl-2 pr-3">{t("catalog.savedViews")}:</span>
            <button
              onClick={() => { setSavedView("All Books"); setPage(1); }}
              className={`px-4 py-1.5 text-[13px] font-bold rounded-md transition-colors ${savedView === "All Books" ? "bg-emerald text-white" : "text-[#122222]/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5"}`}
            >
              {t("catalog.allBooks")}
            </button>
            <button
              onClick={() => { setSavedView("Recent Additions"); setPage(1); }}
              className={`px-4 py-1.5 text-[13px] font-bold rounded-md transition-colors ${savedView === "Recent Additions" ? "bg-emerald text-white" : "text-[#122222]/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5"}`}
            >
              {t("catalog.recentAdditions")}
            </button>
            <button
              onClick={() => { setSavedView("Available Now"); setPage(1); }}
              className={`px-4 py-1.5 text-[13px] font-bold rounded-md transition-colors ${savedView === "Available Now" ? "bg-emerald text-white" : "text-[#122222]/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5"}`}
            >
              {t("catalog.availableNow", "Available Now")}
            </button>
            <button
              onClick={() => { setSavedView("Out of Stock"); setPage(1); }}
              className={`px-4 py-1.5 text-[13px] font-bold rounded-md transition-colors ${savedView === "Out of Stock" ? "bg-emerald text-white" : "text-[#122222]/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5"}`}
            >
              {t("catalog.outOfStock", "Out of Stock")}
            </button>
          </div>
        </div>

        {/* Table Area */}
        <div className="flex-1 bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-xl overflow-hidden flex flex-col shadow-card">
          <div className="flex-1 overflow-auto">
            {paginatedBooks.length ? (
              <table className="w-full text-left text-[13px]">
                <thead className="bg-[#fcfbf8] dark:bg-[#111d1a] sticky top-0 border-b border-black/5 dark:border-white/5 text-[11px] font-bold text-[#122222]/50 dark:text-white/50 uppercase tracking-wider select-none">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={sortedBooks.length > 0 && selectedIds.length === sortedBooks.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(sortedBooks.map(b => b.id));
                          } else {
                            setSelectedIds([]);
                          }
                        }}
                        className="cursor-pointer rounded border-black/25 dark:border-white/25 text-emerald focus:ring-emerald h-4 w-4"
                      />
                    </th>
                    <th className="px-4 py-3 cursor-pointer hover:text-emerald dark:hover:text-emerald-light" onClick={() => handleSort("title")}>
                      {t("catalog.headers.title")} {sortBy === "title" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                    </th>
                    <th className="px-4 py-3 cursor-pointer hover:text-emerald dark:hover:text-emerald-light" onClick={() => handleSort("author")}>
                      {t("catalog.headers.author")} {sortBy === "author" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                    </th>
                    <th className="px-4 py-3 cursor-pointer hover:text-emerald dark:hover:text-emerald-light" onClick={() => handleSort("category")}>
                      {t("catalog.headers.category")} {sortBy === "category" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                    </th>
                    <th className="px-4 py-3 cursor-pointer hover:text-emerald dark:hover:text-emerald-light" onClick={() => handleSort("isbn")}>
                      {t("catalog.headers.isbn")} {sortBy === "isbn" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                    </th>
                    <th className="px-4 py-3 cursor-pointer hover:text-emerald dark:hover:text-emerald-light" onClick={() => handleSort("created_at")}>
                      {t("catalog.headers.dateAdded", "Date Added")} {sortBy === "created_at" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                    </th>
                    <th className="px-4 py-3 cursor-pointer hover:text-emerald dark:hover:text-emerald-light" onClick={() => handleSort("available_copies")}>
                      {t("catalog.headers.availability", "Availability")} {sortBy === "available_copies" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                    </th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {paginatedBooks.map((book) => (
                    <tr
                      key={book.id}
                      onClick={() => setSelectedBook(book)}
                      className={`cursor-pointer transition-colors ${
                        selectedIds.includes(book.id) 
                          ? 'bg-emerald/5 dark:bg-emerald-light/5' 
                          : selectedBook?.id === book.id 
                            ? 'bg-black/5 dark:bg-white/5' 
                            : 'hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(book.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds(prev => [...prev, book.id]);
                            } else {
                              setSelectedIds(prev => prev.filter(id => id !== book.id));
                            }
                          }}
                          className="cursor-pointer rounded border-black/25 dark:border-white/25 text-emerald focus:ring-emerald h-4 w-4"
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#122222] dark:text-white">
                        <div className="flex items-center gap-3">
                          {book.cover_path ? (
                            <img src={book.cover_path} alt="" className="w-8 h-12 rounded object-cover shadow-sm border border-black/10 shrink-0" />
                          ) : (
                            <div className="w-8 h-12 bg-[#f4ebdd] dark:bg-[#1a2522] rounded border border-black/10 flex items-center justify-center shrink-0">
                              <BookOpen size={14} className="text-[#b96f3e]/40" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-[#122222] dark:text-white truncate">{book.title}</div>
                            {book.subtitle && <div className="text-[11px] text-[#122222]/50 dark:text-white/50 font-arabic mt-0.5 truncate">{book.subtitle}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#122222]/70 dark:text-white/70">{book.author || "—"}</td>
                      <td className="px-4 py-3 text-[#122222]/70 dark:text-white/70">{book.category || t("catalog.uncategorized") || "Uncategorized"}</td>
                      <td className="px-4 py-3 text-[#122222]/70 dark:text-white/70 font-mono text-[12px]">{formatIsbn(book.isbn13 || book.isbn10) || "—"}</td>
                      <td className="px-4 py-3 text-[#122222]/70 dark:text-white/70 whitespace-nowrap">{formatDisplayDate(book.created_at)}</td>
                      <td className="px-4 py-3 text-[#122222]/70 dark:text-white/70 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          (book.available_copies ?? 0) > 0 
                            ? 'bg-emerald/10 text-emerald dark:text-emerald-light' 
                            : 'bg-red-500/10 text-red-500'
                        }`}>
                          {book.available_copies ?? 0} / {book.total_copies ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#122222]/40 hover:text-[#122222]"><MoreHorizontal size={16} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-[#122222]/50 dark:text-white/50">
                <BookOpen size={48} className="mb-4 text-[#122222]/30" />
                <p className="text-[14px]">{t("catalog.noBooks")}</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="p-3 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[12px] text-[#122222]/60 dark:text-white/60 font-semibold bg-[#fcfbf8] dark:bg-[#111d1a]">
            <div>{t("catalog.showing", { start: Math.min(sortedBooks.length, (page - 1) * itemsPerPage + 1), end: Math.min(sortedBooks.length, page * itemsPerPage), total: sortedBooks.length })}</div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-7 h-7 rounded flex items-center justify-center hover:bg-black/5 disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-2">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-7 h-7 rounded flex items-center justify-center hover:bg-black/5 disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar (Details Panel) */}
      {selectedBook && (
        <BookSidebar
          book={selectedBook}
          onClose={() => {
            setSelectedBook(null);
            invalidate();
          }}
          registerClean={registerClean}
        />
      )}

      {adding && (
        <Modal isOpen={adding} onClose={() => setAdding(false)} title={t("catalog.addModal.title")}>
          <form className="grid gap-4 md:grid-cols-2 text-[13px]" onSubmit={addForm.handleSubmit((values) => addMutation.mutate(values))}>
            <div className="md:col-span-2 flex justify-center py-2">
              <ImageUpload
                value={addForm.watch("cover_path")}
                onChange={(val) => addForm.setValue("cover_path", val)}
                shape="cover"
                label={t("catalog.addModal.cover")}
              />
            </div>
            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 md:col-span-2">{t("catalog.addModal.isbnLabel")}
              <div className="flex gap-2 mt-1">
                <Input {...registerClean(addForm, "isbn", normalizeIsbn)} placeholder="Type ISBN-10 or ISBN-13..." />
                <Button type="button" variant="secondary" onClick={handleIsbnLookup} disabled={lookupLoading} className="flex gap-1 items-center">
                  <Sparkles size={14} /> {lookupLoading ? t("catalog.addModal.autofilling") : t("catalog.addModal.autofill")}
                </Button>
              </div>
            </label>
            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 md:col-span-2"><span>{t("catalog.addModal.titleLabel")} <span className="text-red-500">*</span></span>
              <Input {...registerClean(addForm, "title", cleanText)} placeholder="e.g. The Canon of Medicine" />
              {addForm.formState.errors.title && <small className="text-red-500">{addForm.formState.errors.title.message}</small>}
            </label>
            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60">{t("catalog.addModal.subtitleLabel")}
              <Input {...registerClean(addForm, "subtitle", cleanText)} placeholder="e.g. A Novel of Regency England" />
            </label>
            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60">{t("catalog.addModal.arabicTitleLabel")}
              <Input {...registerClean(addForm, "arabic_title", cleanText)} placeholder="e.g. كبرياء وتحامل" />
            </label>
            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60">{t("catalog.addModal.authorLabel")}
              <Input {...registerClean(addForm, "author", cleanText)} placeholder="e.g. Ibn Sina" />
            </label>
            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60"><span>{t("catalog.addModal.langLabel")} <span className="text-red-500">*</span></span>
              <Input {...registerClean(addForm, "language", cleanText)} />
              {addForm.formState.errors.language && <small className="text-red-500">{addForm.formState.errors.language.message}</small>}
            </label>
            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60">{t("catalog.addModal.publisherLabel")}
              <Input {...registerClean(addForm, "publisher", cleanText)} placeholder="e.g. Dar al-Ma'rifa" />
            </label>
            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60">{t("catalog.addModal.categoryLabel")}
              <Input {...registerClean(addForm, "category", cleanText)} placeholder="e.g. Classical Medicine" />
            </label>
            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 md:col-span-2">{t("catalog.addModal.tagsLabel")}
              <Input {...registerClean(addForm, "tags", cleanText)} placeholder="e.g. classic, fiction, romance" />
              {watchedTags && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {watchedTags.split(",").map((t, idx) => {
                    const clean = t.trim();
                    if (!clean) return null;
                    return (
                      <span key={idx} className="px-2 py-0.5 bg-emerald/10 dark:bg-emerald-light/20 text-emerald dark:text-emerald-light rounded text-[10px] font-bold">
                        {clean}
                      </span>
                    );
                  })}
                </div>
              )}
            </label>
            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60">{t("catalog.addModal.accessionLabel")}
              <Input {...registerClean(addForm, "accession", cleanAccession)} placeholder="Auto-generated if blank" />
            </label>
            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60">{t("catalog.addModal.barcodeLabel")}
              <Input {...registerClean(addForm, "barcode", cleanBarcode)} placeholder="Scan or enter barcode" />
            </label>
            <label className="md:col-span-2 text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">{t("catalog.addModal.descLabel")}
              <textarea
                {...registerClean(addForm, "description", cleanText)}
                placeholder="Write summary description of the book..."
                className="w-full bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-lg py-2 px-3 text-[13px] text-[#122222] dark:text-white outline-none focus:border-emerald min-h-[60px] mt-1"
              />
            </label>
            <div className="md:col-span-2 flex gap-2 justify-end pt-4 pb-4 border-t border-black/5 dark:border-white/5">
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>{t("catalog.addModal.cancel")}</Button>
              <Button type="submit" disabled={addMutation.isPending}>{addMutation.isPending ? "Saving…" : t("catalog.addModal.save")}</Button>
            </div>
          </form>
        </Modal>
      )}

      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-[#1d2926]/90 backdrop-blur-md px-6 py-3 rounded-full border border-black/10 dark:border-white/10 shadow-lg flex items-center gap-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <span className="text-[13px] font-semibold text-[#122222] dark:text-white">
            {t("catalog.bulk.selectedCount", { count: selectedIds.length }) || `${selectedIds.length} book(s) selected`}
          </span>
          <div className="h-4 w-px bg-black/10 dark:bg-white/10" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(sortedBooks.map(b => b.id))}
              className="text-[12px] font-bold text-emerald dark:text-emerald-light hover:underline px-2 py-1 cursor-pointer"
            >
              {t("catalog.bulk.selectAll") || "Select All"}
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="text-[12px] font-bold text-[#122222]/60 dark:text-white/60 hover:underline px-2 py-1 cursor-pointer"
            >
              {t("catalog.bulk.deselectAll") || "Deselect All"}
            </button>
            <button
              onClick={handleBulkArchive}
              className="flex items-center gap-1.5 text-[12px] font-bold bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-full shadow transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
              {t("catalog.bulk.archiveSelected") || "Archive Selected"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BookSidebar({ book, onClose, registerClean }: { book: Book; onClose: () => void; registerClean: any }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"details" | "copies" | "reserve">("details");
  const [isEditing, setIsEditing] = useState(false);
  const [addCopyOpen, setAddCopyOpen] = useState(false);
  const [reservingMemberId, setReservingMemberId] = useState("");

  // Queries
  const { data: copiesList, refetch: refetchCopies } = useQuery({
    queryKey: ["book-copies", book.id],
    queryFn: () => getCopiesForBook(book.id)
  });

  const membersQuery = useQuery({ queryKey: ["members-all-catalog"], queryFn: () => members() });
  const auditQuery = useQuery({ queryKey: ["book-audit-logs", book.id], queryFn: () => auditLog() });

  const bookAudits = useMemo(() => {
    return auditQuery.data?.filter(l => l.entity_id === book.id).slice(0, 5) ?? [];
  }, [auditQuery.data, book.id]);

  // Edit Book Form
  const editForm = useForm({
    defaultValues: {
      title: book.title,
      subtitle: book.subtitle || "",
      arabic_title: book.arabic_title || "",
      tags: book.tags || "",
      author: book.author || "",
      isbn: formatIsbn(book.isbn13 || book.isbn10 || ""),
      publisher: book.publisher || "",
      category: book.category || "",
      language: book.language,
      publication_year: book.publication_year ? String(book.publication_year) : "",
      call_number: book.call_number || "",
      description: book.description || "",
      cover_path: book.cover_path || ""
    }
  });
  const watchedEditTags = editForm.watch("tags");

  // Add Copy Form
  const copyForm = useForm({
    defaultValues: { barcode: "", accession: "", condition: "good", shelf: "" }
  });

  // Mutations
  const updateBookMutation = useMutation({
    mutationFn: (values: any) => {
      const isbn = normalizeIsbn(values.isbn);
      return updateBook(book.id, {
        title: cleanText(values.title),
        subtitle: values.subtitle ? cleanText(values.subtitle) : null,
        arabic_title: values.arabic_title ? cleanText(values.arabic_title) : null,
        tags: values.tags ? cleanText(values.tags) : null,
        author: values.author ? cleanText(values.author) : "",
        isbn10: isbn.length === 10 ? isbn : null,
        isbn13: isbn.length === 13 ? isbn : null,
        publisher: values.publisher ? cleanText(values.publisher) : "",
        category: values.category ? cleanText(values.category) : "",
        language: cleanText(values.language),
        publication_year: values.publication_year ? Number(values.publication_year) : null,
        call_number: values.call_number ? cleanText(values.call_number) : null,
        description: values.description ? cleanText(values.description) : null,
        cover_path: values.cover_path || null
      });
    },
    onSuccess: () => {
      toast.success(t("catalog.alerts.updated") || "Book metadata updated.");
      setIsEditing(false);
      invalidate();
      onClose();
    },
    onError: (err: any) => {
      console.error("Update book error detail:", err);
      toast.error(err?.message || String(err) || t("catalog.alerts.updateError") || "An unknown error occurred while updating the book.");
    }
  });

  const deleteBookMutation = useMutation({
    mutationFn: () => deleteBook(book.id),
    onSuccess: () => {
      toast.success(t("catalog.alerts.archived") || "Book and all copies archived.");
      invalidate();
      onClose();
    },
    onError: (err: any) => toast.error(err.message)
  });

  const addCopyMutation = useMutation({
    mutationFn: (values: any) => addCopy(book.id, cleanBarcode(values.barcode), cleanAccession(values.accession), values.condition, cleanText(values.shelf)),
    onSuccess: () => {
      toast.success(t("catalog.alerts.copyAdded") || "Copy added.");
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
      toast.success(t("catalog.alerts.copyArchived") || "Copy archived.");
      refetchCopies();
      invalidate();
    },
    onError: (err: any) => toast.error(err.message)
  });

  const reserveMutation = useMutation({
    mutationFn: () => addReservation(book.id, reservingMemberId),
    onSuccess: () => {
      toast.success(t("catalog.alerts.reservationPlaced") || "Reservation placed.");
      setReservingMemberId("");
      invalidate();
    },
    onError: (err: any) => toast.error(err.message)
  });

  return (
    <div className="w-[340px] shrink-0 bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-2xl shadow-card flex flex-col h-full overflow-hidden relative transition-transform">
      {/* Header */}
      <div className="p-4 border-b border-black/5 dark:border-white/5 flex justify-between items-center bg-[#fcfbf8] dark:bg-[#111d1a]">
        <button onClick={onClose} className="text-emerald dark:text-emerald-light hover:bg-emerald/5 p-1 rounded-md transition-colors flex items-center gap-1 text-[13px] font-bold cursor-pointer">
          <ChevronLeft size={16} /> {t("catalog.details.back")}
        </button>
        <button onClick={onClose} className="text-[#122222]/40 hover:text-[#122222] transition-colors cursor-pointer"><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-auto p-6 flex flex-col items-start space-y-6">
        {/* Book Cover */}
        <div className="w-full aspect-[2/3] bg-[#f4ebdd] dark:bg-[#1a2522] rounded-xl border border-black/10 flex items-center justify-center shadow-md relative overflow-hidden shrink-0">
          <div className="absolute left-2 top-0 bottom-0 w-1 bg-black/10" />
          {book.cover_path ? (
            <img src={book.cover_path} alt={book.title} className="w-full h-full object-cover" />
          ) : (
            <BookOpen size={48} className="text-[#b96f3e]/20" />
          )}
        </div>

        {/* Tab Buttons */}
        <div className="flex w-full border-b border-black/5 dark:border-white/5 shrink-0">
          <button
            onClick={() => { setActiveTab("details"); setIsEditing(false); }}
            className={`flex-1 pb-2 text-[12px] font-bold border-b-2 text-center transition-all cursor-pointer ${activeTab === "details" ? "border-emerald text-emerald dark:border-emerald-light dark:text-emerald-light" : "border-transparent text-[#122222]/50 dark:text-white/50"
              }`}
          >
            {t("catalog.details.title")}
          </button>
          <button
            onClick={() => setActiveTab("copies")}
            className={`flex-1 pb-2 text-[12px] font-bold border-b-2 text-center transition-all cursor-pointer ${activeTab === "copies" ? "border-emerald text-emerald dark:border-emerald-light dark:text-emerald-light" : "border-transparent text-[#122222]/50 dark:text-white/50"
              }`}
          >
            {t("catalog.details.copies", { count: copiesList?.length ?? 0 })}
          </button>
          <button
            onClick={() => setActiveTab("reserve")}
            className={`flex-1 pb-2 text-[12px] font-bold border-b-2 text-center transition-all cursor-pointer ${activeTab === "reserve" ? "border-emerald text-emerald dark:border-emerald-light dark:text-emerald-light" : "border-transparent text-[#122222]/50 dark:text-white/50"
              }`}
          >
            {t("catalog.details.reserve")}
          </button>
        </div>

        {activeTab === "details" && (
          <div className="w-full space-y-4">
            {!isEditing ? (
              <>
                <div>
                  <h2 className="text-[18px] font-bold text-[#122222] dark:text-white leading-tight mb-1">{book.title}</h2>
                  {book.subtitle && <p className="text-[13px] text-[#122222]/60 dark:text-white/60 mb-1">{book.subtitle}</p>}
                  {book.arabic_title && <p className="text-[13px] font-arabic text-[#122222]/60 dark:text-white/60 mb-2 font-medium">{book.arabic_title}</p>}
                  {book.tags && (
                    <div className="flex flex-wrap gap-1 mt-2 mb-2">
                      {book.tags.split(",").map((t, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-emerald/10 dark:bg-emerald-light/20 text-emerald dark:text-emerald-light rounded text-[10px] font-bold">
                          {t.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <InfoRow label={t("catalog.details.author")} value={book.author || "—"} />
                  <InfoRow label={t("catalog.details.category")} value={book.category || t("catalog.uncategorized") || "Uncategorized"} />
                  <InfoRow label={t("catalog.details.language")} value={book.language} />
                  <InfoRow label={t("catalog.details.publisher")} value={book.publisher || "—"} />
                  <div className="grid grid-cols-2 gap-4">
                    <InfoRow label={t("catalog.details.pubYear")} value={book.publication_year ? String(book.publication_year) : "—"} />
                    <InfoRow label={t("catalog.details.callNumber")} value={book.call_number || "—"} />
                  </div>
                  <InfoRow label={t("catalog.details.isbn10")} value={formatIsbn(book.isbn10) || "—"} />
                  <InfoRow label={t("catalog.details.isbn13")} value={formatIsbn(book.isbn13) || "—"} />
                  {book.description && (
                    <div className="pt-2">
                      <div className="text-[11px] font-bold text-[#122222]/50 dark:text-white/50 uppercase tracking-wider mb-1">{t("catalog.details.description")}</div>
                      <p className="text-[12px] text-[#122222]/70 dark:text-white/70 leading-relaxed bg-[#fcfbf8] dark:bg-[#111d1a] p-3 rounded-lg border border-black/5 dark:border-white/5 max-h-40 overflow-y-auto">{book.description}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4 border-t border-black/5 dark:border-white/5 w-full">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#fcfbf8] dark:bg-[#111d1a] border border-black/10 dark:border-white/10 text-[12px] font-bold text-[#122222] dark:text-white py-2 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
                  >
                    <Edit2 size={14} /> {t("catalog.details.edit")}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(t("catalog.alerts.confirmDelete") || "Are you sure you want to delete this book? This will archive all of its copies.")) {
                        deleteBookMutation.mutate();
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 text-red-500 text-[12px] font-bold py-2 rounded-lg hover:bg-red-500/20 transition-colors cursor-pointer"
                  >
                    <Trash2 size={14} /> {t("catalog.details.archive")}
                  </button>
                </div>

                {bookAudits.length > 0 && (
                  <div className="w-full pt-6 border-t border-black/5 dark:border-white/5">
                    <h3 className="font-bold text-[13px] text-[#122222] dark:text-white flex items-center gap-2 mb-3"><Clock size={12} strokeWidth={2.5} /> {t("catalog.details.recentActivity")}</h3>
                    <div className="space-y-3">
                      {bookAudits.map((item) => (
                        <ActivityRow key={item.id} date={formatDisplayDate(item.created_at)} action={item.action} actor={item.actor} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <form onSubmit={editForm.handleSubmit((v) => updateBookMutation.mutate(v))} className="space-y-3 w-full text-[13px]">
                <div className="flex justify-center py-1">
                  <ImageUpload
                    value={editForm.watch("cover_path")}
                    onChange={(val) => editForm.setValue("cover_path", val || "")}
                    shape="cover"
                    label={t("catalog.addModal.cover")}
                  />
                </div>
                <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">{t("catalog.addModal.titleLabel")}
                  <Input {...registerClean(editForm, "title", cleanText)} className="py-1 px-2.5 text-[13px]" />
                </label>
                <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">{t("catalog.addModal.subtitleLabel")}
                  <Input {...registerClean(editForm, "subtitle", cleanText)} className="py-1 px-2.5 text-[13px]" />
                </label>
                <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">{t("catalog.addModal.arabicTitleLabel")}
                  <Input {...registerClean(editForm, "arabic_title", cleanText)} className="py-1 px-2.5 text-[13px]" />
                </label>
                <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block font-semibold">{t("catalog.addModal.tagsLabel")}
                  <Input {...registerClean(editForm, "tags", cleanText)} className="py-1 px-2.5 text-[13px]" />
                  {watchedEditTags && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {watchedEditTags.split(",").map((t, idx) => {
                        const clean = t.trim();
                        if (!clean) return null;
                        return (
                          <span key={idx} className="px-2 py-0.5 bg-emerald/10 dark:bg-emerald-light/20 text-emerald dark:text-emerald-light rounded text-[10px] font-bold">
                            {clean}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </label>
                <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">{t("catalog.addModal.authorLabel")}
                  <Input {...registerClean(editForm, "author", cleanText)} className="py-1 px-2.5 text-[13px]" />
                </label>
                <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">{t("catalog.addModal.isbnLabel")}
                  <Input {...registerClean(editForm, "isbn", normalizeIsbn)} className="py-1 px-2.5 text-[13px]" />
                </label>
                <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">{t("catalog.addModal.publisherLabel")}
                  <Input {...registerClean(editForm, "publisher", cleanText)} className="py-1 px-2.5 text-[13px]" />
                </label>
                <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">{t("catalog.addModal.categoryLabel")}
                  <Input {...registerClean(editForm, "category", cleanText)} className="py-1 px-2.5 text-[13px]" />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">{t("catalog.details.pubYear")}
                    <Input {...editForm.register("publication_year")} className="py-1 px-2.5 text-[13px]" type="number" />
                  </label>
                  <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">{t("catalog.details.callNumber")}
                    <Input {...registerClean(editForm, "call_number", cleanText)} className="py-1 px-2.5 text-[13px]" />
                  </label>
                </div>
                <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">{t("catalog.addModal.langLabel")}
                  <Input {...registerClean(editForm, "language", cleanText)} className="py-1 px-2.5 text-[13px]" />
                </label>
                <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">{t("catalog.addModal.descLabel")}
                  <textarea
                    {...registerClean(editForm, "description", cleanText)}
                    className="w-full bg-[#fcfbf8] dark:bg-[#111d1a] border border-black/10 dark:border-white/10 rounded-lg py-1.5 px-2.5 text-[13px] text-[#122222] dark:text-white outline-none focus:border-emerald min-h-[60px] mt-1"
                  />
                </label>
                <div className="flex gap-2 justify-end pt-3 border-t border-black/5 dark:border-white/5">
                  <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>{t("catalog.addModal.cancel")}</Button>
                  <Button type="submit" disabled={updateBookMutation.isPending}>{updateBookMutation.isPending ? "Saving..." : t("save")}</Button>
                </div>
              </form>
            )}
          </div>
        )}

        {activeTab === "copies" && (
          <div className="w-full space-y-4">
            <div className="flex justify-between items-center shrink-0">
              <h3 className="font-bold text-[14px] text-[#122222] dark:text-white">{t("catalog.details.physicalCopies") || "Physical copies"}</h3>
              <button
                onClick={() => setAddCopyOpen(true)}
                className="flex items-center gap-1 text-[11px] font-bold text-emerald hover:underline cursor-pointer"
              >
                <Plus size={12} /> {t("catalog.details.addCopy") || "Add copy"}
              </button>
            </div>

            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
              {copiesList?.map((copy) => (
                <div key={copy.id} className="p-3 bg-[#fcfbf8] dark:bg-[#111d1a] border border-black/5 dark:border-white/5 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="font-mono text-[12px] font-bold text-[#122222] dark:text-white">{copy.barcode}</div>
                    <div className="text-[10px] text-[#122222]/50 dark:text-white/50 mt-0.5">Accession: {copy.accession_number}</div>
                    {copy.shelf && (
                      <div className="flex items-center gap-1 text-[10px] text-emerald font-semibold mt-1">
                        <MapPin size={10} /> Shelf {copy.shelf}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge value={copy.status} />
                    <button
                      onClick={() => {
                        if (confirm(t("catalog.alerts.confirmArchiveCopy") || "Are you sure you want to archive this copy?")) {
                          deleteCopyMutation.mutate(copy.id);
                        }
                      }}
                      className="text-red-500 hover:text-red-700 cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {addCopyOpen && (
              <Modal isOpen={addCopyOpen} onClose={() => setAddCopyOpen(false)} title={t("catalog.details.addCopyTitle") || "Add Physical Copy"}>
                <form onSubmit={copyForm.handleSubmit((v) => addCopyMutation.mutate(v))} className="space-y-4 text-[13px]">
                  <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">{t("catalog.details.copyBarcode") || "Barcode"}
                    <Input {...registerClean(copyForm, "barcode", cleanBarcode)} placeholder={t("catalog.details.copyBarcodePlaceholder") || "Scan or enter copy barcode"} required />
                  </label>
                  <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">{t("catalog.details.copyAccession") || "Accession number"}
                    <Input {...registerClean(copyForm, "accession", cleanAccession)} placeholder={t("catalog.details.copyAccessionPlaceholder") || "Auto-generated if blank"} />
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">{t("catalog.details.copyShelf") || "Shelf location"}
                      <Input {...registerClean(copyForm, "shelf", cleanText)} placeholder={t("catalog.details.copyShelfPlaceholder") || "e.g. A-12"} />
                    </label>
                    <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">{t("catalog.details.copyCondition") || "Condition"}
                      <select {...copyForm.register("condition")} className="field-select mt-1 text-[13px] py-2 px-3">
                        <option value="mint">{t("catalog.condition.mint") || "Mint"}</option>
                        <option value="good">{t("catalog.condition.good") || "Good"}</option>
                        <option value="worn">{t("catalog.condition.worn") || "Worn"}</option>
                        <option value="damaged">{t("catalog.condition.damaged") || "Damaged"}</option>
                      </select>
                    </label>
                  </div>
                  <div className="flex gap-2 justify-end pt-3 border-t border-black/5 dark:border-white/5">
                    <Button type="button" variant="ghost" onClick={() => setAddCopyOpen(false)}>{t("catalog.addModal.cancel")}</Button>
                    <Button type="submit" disabled={addCopyMutation.isPending}>{t("catalog.details.addCopyBtn") || "Add copy"}</Button>
                  </div>
                </form>
              </Modal>
            )}
          </div>
        )}

        {activeTab === "reserve" && (
          <div className="w-full space-y-4">
            <h3 className="font-bold text-[14px] text-[#122222] dark:text-white mb-1">{t("catalog.details.reserveTitle") || "Place reservation hold"}</h3>
            <p className="text-[12px] text-[#122222]/65 dark:text-parchment/65">{t("catalog.details.reserveDesc") || "If all copies are checked out, you can place a reservation hold for a member. They will be notified when a copy is returned."}</p>

            <label className="text-[11px] font-bold text-[#122222]/50 dark:text-white/50 uppercase tracking-wider block">
              {t("catalog.details.searchMember") || "Search member"}
              <div className="mt-1">
                <SearchableSelect
                  options={membersQuery.data ?? []}
                  labelKey="full_name"
                  valueKey="id"
                  subLabelKey="member_number"
                  placeholder={t("catalog.details.searchMemberPlaceholder") || "Type name or membership number..."}
                  value={reservingMemberId}
                  onChange={(val) => setReservingMemberId(val)}
                />
              </div>
            </label>

            <button
              onClick={() => reserveMutation.mutate()}
              disabled={!reservingMemberId || reserveMutation.isPending}
              className="w-full bg-[#1a4d40] text-white py-2.5 rounded-lg font-bold text-[13px] hover:bg-[#1a4d40]/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {t("catalog.details.confirmReserve") || "Confirm Reservation Hold"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[10px] font-bold text-[#122222]/40 dark:text-white/40 uppercase tracking-wider block">{label}</span>
      <span className="text-[13px] font-semibold text-[#122222] dark:text-white block mt-0.5">{value}</span>
    </div>
  );
}

function ActivityRow({ date, action, actor }: { date: string; action: string; actor: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-between text-[11px] border-b border-black/5 dark:border-white/5 pb-2 last:border-b-0 last:pb-0">
      <div>
        <span className="font-semibold capitalize text-[#122222] dark:text-white">{action}</span>
        <span className="text-[#122222]/50 dark:text-white/50 ml-1">{t("catalog.details.byActor", { actor: actor }) || `by ${actor}`}</span>
      </div>
      <span className="text-[#122222]/40 dark:text-white/40">{date}</span>
    </div>
  );
}
