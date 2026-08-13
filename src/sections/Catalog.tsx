import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Plus, Search,
  ChevronLeft, ChevronRight, X, Clock, Edit2, Trash2, MapPin, Sparkles,
  Eye, Copy, CalendarClock, Pencil
} from "lucide-react";
import { useContextMenu } from "../components/ui/ContextMenu";
import { CopyEditModal } from "../components/CopyEditModal";

import {
  books, saveBook, updateBook, deleteBook, getCopiesForBook,
  addCopy, deleteCopy, auditLog,
  getShelves
} from "../data/repositories/library";
import type { Book, Copy as BookCopy } from "../types";
import { FLOOR_SHELF_CODE } from "../types";
import { Modal, Input, Button, StatusBadge, ItemTypeBadge, ItemTypeSelect, PageLoader, DefaultCover } from "../components/ui/primitives";
import { toast } from "sonner";
import {
  isValidIsbn, normalizeIsbn, cleanBarcode,
  cleanAccession, cleanText, formatIsbn
} from "../utils/isbn";
import { queryClient } from "../app/providers";
import { fetchBookMetadata, enrichMetadataWithGroq, downloadCoverAsBase64 } from "../utils/metadata";
import { useUiStore } from "../store/uiStore";
import { useLocation, useNavigate } from "react-router-dom";

import { ImageUpload } from "../components/ui/ImageUpload";
import { useTranslation } from "react-i18next";
import { formatDisplayDate } from "../utils/dates";
import { useThemedAsset } from "../utils/useThemedAsset";
import { getDisplayTitle } from "../utils/titles";

const invalidate = () => queryClient.invalidateQueries();

export function getItemTypeIcon(_type?: string) {
  return null;
}

export { ItemTypeBadge };

const bookSchema = z.object({
  title: z.string().min(2, "A title is required"),
  item_type: z.string().optional(),
  subtitle: z.string().optional(),
  arabic_title: z.string().optional(),
  tags: z.string().optional(),
  author: z.string().optional(),
  isbn: z.string().optional(),
  language: z.string().min(2, "Language must be at least 2 characters"),
  publisher: z.string().optional(),
  category: z.string().optional(),
  publication_year: z.union([z.string(), z.number()]).optional().nullable(),
  call_number: z.string().optional(),
  dewey_code: z.string().optional(),
  barcode: z.string().optional(),
  accession: z.string().optional(),
  description: z.string().optional(),
  cover_path: z.string().nullable().optional(),
  issue_number: z.string().optional(),
  frequency: z.string().optional(),
  issn: z.string().optional(),
  pub_date: z.string().optional(),
  issue_date: z.string().optional(),
  press: z.string().optional(),
  region: z.string().optional(),
  editor: z.string().optional(),
  ruling_type: z.string().optional(),
  page_count: z.string().optional(),
  paper_size: z.string().optional(),
  brand: z.string().optional(),
  media_format: z.string().optional(),
  duration: z.string().optional(),
  model_number: z.string().optional(),
  specifications: z.string().optional(),
  artist: z.string().optional(),
  studio: z.string().optional(),
  owner: z.string().optional(),
});
type BookValues = z.infer<typeof bookSchema>;

function buildMetadataAndItemFields(values: BookValues) {
  const itemType = values.item_type || "book";
  const metaObj: Record<string, any> = {};

  if (values.issue_number) metaObj.issue_number = cleanText(values.issue_number);
  if (values.frequency) metaObj.frequency = cleanText(values.frequency);
  if (values.issn) metaObj.issn = cleanText(values.issn);
  if (values.pub_date) metaObj.pub_date = cleanText(values.pub_date);
  if (values.issue_date) metaObj.issue_date = cleanText(values.issue_date);
  if (values.press) metaObj.press = cleanText(values.press);
  if (values.region) metaObj.region = cleanText(values.region);
  if (values.editor) metaObj.editor = cleanText(values.editor);
  if (values.ruling_type) metaObj.ruling_type = cleanText(values.ruling_type);
  if (values.page_count) metaObj.page_count = cleanText(values.page_count);
  if (values.paper_size) metaObj.paper_size = cleanText(values.paper_size);
  if (values.brand) metaObj.brand = cleanText(values.brand);
  if (values.media_format) metaObj.media_format = cleanText(values.media_format);
  if (values.duration) metaObj.duration = cleanText(values.duration);
  if (values.model_number) metaObj.model_number = cleanText(values.model_number);
  if (values.specifications) metaObj.specifications = cleanText(values.specifications);
  if (values.artist) metaObj.artist = cleanText(values.artist);
  if (values.studio) metaObj.studio = cleanText(values.studio);
  if (values.owner) metaObj.owner = cleanText(values.owner);

  let author = values.author ? cleanText(values.author) : "";
  let publisher = values.publisher ? cleanText(values.publisher) : "";
  let callNumber = values.call_number ? cleanText(values.call_number) : null;

  if (itemType === "journal") {
    if (!author && values.editor) author = cleanText(values.editor);
  } else if (itemType === "fyp") {
    if (!author && values.editor) author = cleanText(values.editor); // supervisor, reusing the editor field
  } else if (itemType === "other") {
    if (!publisher && values.brand) publisher = cleanText(values.brand);
  }

  const metadataJson = Object.keys(metaObj).length > 0 ? JSON.stringify(metaObj) : null;
  return { author, publisher, callNumber, metadataJson };
}

/** Shown under a field the lookup couldn't fill, so a blank input reads as "needs your
 * input" rather than looking like the autofill silently failed. */
function AutofillGapHint({ field, unresolvedFields, t }: { field: string; unresolvedFields?: string[]; t: any }) {
  if (!unresolvedFields?.includes(field)) return null;
  return (
    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
      {t("catalog.addModal.autofillGap", "Not found automatically. Add a Groq API key in Settings for auto-translation, or fill this in by hand.")}
    </p>
  );
}

function TypeSpecificFields({
  itemType,
  form,
  registerClean,
  lookupLoading,
  handleIsbnLookup,
  unresolvedFields,
  t
}: {
  itemType: string;
  form: any;
  registerClean: any;
  lookupLoading?: boolean;
  handleIsbnLookup?: () => void;
  unresolvedFields?: string[];
  t: any;
}) {
  switch (itemType) {
    case "fyp":
      return (
        <>
          <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 md:col-span-2 block">
            <span>{t("catalog.addModal.subtitleLabel", "Subtitle")}</span>
            <Input {...registerClean(form, "subtitle", cleanText)} placeholder="e.g. Étude rétrospective sur..." className="mt-1" />
          </label>
          <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">
            <span>{t("itemFields.supervisor", "Supervisor")}</span>
            <Input {...registerClean(form, "editor", cleanText)} placeholder="e.g. Pr. H. Vance" className="mt-1" />
          </label>
          <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">
            <span>{t("catalog.details.pubYear", "Defense Year")}</span>
            <Input {...form.register("publication_year")} type="number" placeholder="e.g. 2026" className="mt-1" />
          </label>
          <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">
            <span>{t("itemFields.registrationNumber", "Registration Number")}</span>
            <Input {...registerClean(form, "issue_number", cleanText)} placeholder="e.g. PFE-2026-014" className="mt-1" />
          </label>
          <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">
            <span>{t("itemFields.department", "Department / Specialty")}</span>
            <Input {...registerClean(form, "category", cleanText)} placeholder="e.g. Cardiologie" className="mt-1" />
          </label>
          <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">
            <span>{t("catalog.addModal.langLabel", "Language")} <span className="text-red-500">*</span></span>
            <Input {...registerClean(form, "language", cleanText)} className="mt-1" />
          </label>
        </>
      );
    case "journal":
      return (
        <>
          <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">
            <span>{t("catalog.addModal.subtitleLabel", "Field / Subtitle")}</span>
            <Input {...registerClean(form, "subtitle", cleanText)} placeholder="e.g. Cardiology & Vascular Science" className="mt-1" />
          </label>
          <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">
            <span>{t("itemFields.issueNumber", "Volume & Issue Number")}</span>
            <Input {...registerClean(form, "issue_number", cleanText)} placeholder="e.g. Volume 48, Issue 3" className="mt-1" />
          </label>
          <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">
            <span>{t("itemFields.editor", "Chief Editor / Society")}</span>
            <Input {...registerClean(form, "editor", cleanText)} placeholder="e.g. Dr. H. Vance / Medical Assoc." className="mt-1" />
          </label>
          <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">
            <span>{t("catalog.addModal.publisherLabel", "Academic Publisher")}</span>
            <Input {...registerClean(form, "publisher", cleanText)} placeholder="e.g. Elsevier / Oxford Univ Press" className="mt-1" />
          </label>
          <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">
            <span>{t("itemFields.issn", "ISSN")}</span>
            <Input {...registerClean(form, "issn", cleanText)} placeholder="e.g. 1549-3962" className="mt-1" />
          </label>
          <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">
            <span>{t("catalog.details.pubYear", "Publication Year")}</span>
            <Input {...form.register("publication_year")} type="number" placeholder="e.g. 2026" className="mt-1" />
          </label>
          <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">
            <span>{t("catalog.addModal.categoryLabel", "Discipline / Field")}</span>
            <Input {...registerClean(form, "category", cleanText)} placeholder="e.g. Clinical Medicine" className="mt-1" />
          </label>
          <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">
            <span>{t("catalog.addModal.langLabel", "Language")} <span className="text-red-500">*</span></span>
            <Input {...registerClean(form, "language", cleanText)} className="mt-1" />
          </label>
        </>
      );
    case "other":
      return (
        <>
          <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">
            <span>{t("itemFields.brand", "Brand / Manufacturer")}</span>
            <Input {...registerClean(form, "brand", cleanText)} placeholder="e.g. 3B Scientific" className="mt-1" />
          </label>
          <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">
            <span>{t("itemFields.modelNumber", "Model / Serial Number")}</span>
            <Input {...registerClean(form, "model_number", cleanText)} placeholder="e.g. Model A58/1" className="mt-1" />
          </label>
          <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block md:col-span-2">
            <span>{t("itemFields.specifications", "Specifications / Details")}</span>
            <Input {...registerClean(form, "specifications", cleanText)} placeholder="e.g. Life-size 170cm, detachable limbs" className="mt-1" />
          </label>
          <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">
            <span>{t("catalog.addModal.categoryLabel", "Category")}</span>
            <Input {...registerClean(form, "category", cleanText)} placeholder="e.g. Lab Equipment" className="mt-1" />
          </label>
          <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">
            <span>{t("catalog.addModal.langLabel", "Language")} <span className="text-red-500">*</span></span>
            <Input {...registerClean(form, "language", cleanText)} className="mt-1" />
          </label>
        </>
      );
    case "book":
    default:
      return (
        <>
          {handleIsbnLookup && (
            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 md:col-span-2 block">
              {t("catalog.addModal.isbnLabel")}
              <div className="flex gap-2 mt-1">
                <Input {...registerClean(form, "isbn", normalizeIsbn)} placeholder="Type ISBN-10 or ISBN-13..." />
                <Button type="button" variant="secondary" onClick={handleIsbnLookup} disabled={lookupLoading} className="flex gap-1 items-center">
                  <Sparkles size={14} /> {lookupLoading ? t("catalog.addModal.autofilling") : t("catalog.addModal.autofill")}
                </Button>
              </div>
            </label>
          )}
          <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">
            {t("catalog.addModal.subtitleLabel")}
            <Input {...registerClean(form, "subtitle", cleanText)} placeholder="e.g. A Novel of Regency England" className="mt-1" />
            <AutofillGapHint field="subtitle" unresolvedFields={unresolvedFields} t={t} />
          </label>
          <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">
            {t("catalog.addModal.arabicTitleLabel")}
            <Input {...registerClean(form, "arabic_title", cleanText)} placeholder="e.g. كبرياء وتحامل" className="mt-1" />
            <AutofillGapHint field="arabic_title" unresolvedFields={unresolvedFields} t={t} />
          </label>
          <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">
            {t("catalog.addModal.authorLabel")}
            <Input {...registerClean(form, "author", cleanText)} placeholder="e.g. Ibn Sina" className="mt-1" />
          </label>
          <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">
            <span>{t("catalog.addModal.langLabel")} <span className="text-red-500">*</span></span>
            <Input {...registerClean(form, "language", cleanText)} className="mt-1" />
          </label>
          <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">
            {t("catalog.addModal.publisherLabel")}
            <Input {...registerClean(form, "publisher", cleanText)} placeholder="e.g. Dar al-Ma'rifa" className="mt-1" />
          </label>
          <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">
            {t("catalog.addModal.categoryLabel")}
            <Input {...registerClean(form, "category", cleanText)} placeholder="e.g. Classical Medicine" className="mt-1" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">
              {t("catalog.details.pubYear")}
              <Input {...form.register("publication_year")} type="number" placeholder="e.g. 2024" className="mt-1" />
            </label>
            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">
              {t("catalog.details.callNumber")}
              <Input {...registerClean(form, "call_number", cleanText)} placeholder="e.g. Q123.A4" className="mt-1" />
            </label>
          </div>
          <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">
            {t("catalog.details.deweyCode")}
            <Input {...registerClean(form, "dewey_code", cleanText)} placeholder="e.g. 823.912" className="mt-1" />
          </label>
        </>
      );
  }
}

export function CatalogPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { showContextMenu } = useContextMenu();
  const catalogLibrarySrc = useThemedAsset("catalog-library");

  const [term, setTerm] = useState("");
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const handleBookContextMenu = (e: React.MouseEvent, book: Book) => {
    showContextMenu(e, [
      {
        id: "view-details",
        label: t("catalog.contextMenu.viewDetails", "View Book Details & Copies"),
        icon: Eye,
        onClick: () => setSelectedBook(book),
      },
      {
        id: "copy-isbn",
        label: t("catalog.contextMenu.copyIsbn", "Copy ISBN"),
        icon: Copy,
        hidden: !book.isbn13 && !book.isbn10,
        onClick: () => {
          const val = book.isbn13 || book.isbn10 || "";
          navigator.clipboard.writeText(val);
          toast.success(t("catalog.copiedIsbn", "ISBN copied to clipboard"));
        },
      },
      {
        id: "copy-title",
        label: t("catalog.contextMenu.copyTitle", "Copy Title"),
        icon: Copy,
        onClick: () => {
          navigator.clipboard.writeText(book.title);
          toast.success(t("catalog.copiedTitle", "Title copied to clipboard"));
        },
      },
      { divider: true },
      {
        id: "reserve-book",
        label: t("catalog.contextMenu.reserveBook", "Reserve Book"),
        icon: CalendarClock,
        onClick: () => {
          navigate(`/reservations?book_id=${book.id}`);
        },
      },
      { divider: true },
      {
        id: "delete-book",
        label: t("catalog.contextMenu.deleteBook", "Delete Item"),
        icon: Trash2,
        variant: "danger",
        onClick: async () => {
          if (confirm(t("catalog.alerts.confirmDelete", { title: book.title }) || `Are you sure you want to delete ${book.title}?`)) {
            await deleteBook(book.id);
            if (selectedBook?.id === book.id) setSelectedBook(null);
            invalidate();
            toast.success(t("catalog.alerts.bookDeleted", "Item deleted successfully"));
          }
        },
      },
    ], { title: book.title });
  };

  const [adding, setAdding] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [unresolvedFields, setUnresolvedFields] = useState<string[]>([]);

  // Sorting, Filtering & Pagination State
  const [sortBy, setSortBy] = useState<"title" | "author" | "category" | "isbn" | "created_at" | "available_copies">("title");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [savedView, setSavedView] = useState("All Books");
  const [langFilter, setLangFilter] = useState("All Languages");
  const [catFilter, setCatFilter] = useState("All Categories");
  const [typeFilter, setTypeFilter] = useState("All Items");
  const [page, setPage] = useState(1);
  const itemsPerPage = useUiStore((state) => state.preferences.pageSize) || 10;
  const titlePreference = useUiStore((state) => state.preferences.titlePreference);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Handle query parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get("q");
    if (q) setTerm(q);

    const action = params.get("action");
    if (action === "add-book") {
      setAdding(true);
      const cleanUrl = window.location.hash ? window.location.hash.split("?")[0] : window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }

    const focus = params.get("focus");
    if (focus === "search") {
      setTimeout(() => {
        document.getElementById("catalog-page-search")?.focus();
      }, 100);
      const cleanUrl = window.location.hash ? window.location.hash.split("?")[0] : window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, [location.search]);

  // Quick fetch
  const result = useQuery({ queryKey: ["books", term, typeFilter], queryFn: () => books(term, typeFilter) });

  const addForm = useForm<BookValues>({
    resolver: zodResolver(bookSchema),
    defaultValues: { title: "", item_type: "book", subtitle: "", arabic_title: "", tags: "", author: "", isbn: "", language: "English", publisher: "", category: "", call_number: "", dewey_code: "", barcode: "", accession: "", description: "", cover_path: null }
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
      const { author, publisher, callNumber, metadataJson } = buildMetadataAndItemFields(values);
      return saveBook({
        title: cleanText(values.title),
        item_type: values.item_type || "book",
        language: cleanText(values.language),
        subtitle: values.subtitle ? cleanText(values.subtitle) : null,
        arabic_title: values.arabic_title ? cleanText(values.arabic_title) : null,
        tags: values.tags ? cleanText(values.tags) : null,
        isbn10: isbn.length === 10 ? isbn : null,
        isbn13: isbn.length === 13 ? isbn : null,
        publisher: publisher,
        category: values.category ? cleanText(values.category) : "",
        author: author,
        publication_year: values.publication_year ? Number(values.publication_year) : null,
        call_number: callNumber,
        dewey_code: values.dewey_code ? cleanText(values.dewey_code) : null,
        barcode: values.barcode ? cleanBarcode(values.barcode) : "",
        accession: values.accession ? cleanAccession(values.accession) : "",
        description: values.description ? cleanText(values.description) : null,
        cover_path: values.cover_path || null,
        metadata: metadataJson
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success(t("catalog.alerts.bookSaved") || "Item saved to the catalog.");
      addForm.reset();
      setAdding(false);
    },
    onError: (error: any) => {
      console.error("Save book error detail:", error);
      toast.error(error?.message || String(error) || t("catalog.alerts.saveError") || "An unknown error occurred while saving.");
    }
  });

  const bulkArchiveMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(selectedIds.map(id => deleteBook(id)));
    },
    onSuccess: () => {
      invalidate();
      toast.success(t("catalog.alerts.bulkArchived") || "Selected books deleted.");
      setSelectedIds([]);
    },
    onError: (error: any) => {
      toast.error(error?.message || t("catalog.alerts.bulkArchiveFailed") || "Failed to delete books.");
    }
  });

  const handleBulkArchive = () => {
    if (confirm(t("catalog.alerts.confirmBulkArchive", { count: selectedIds.length }) || `Are you sure you want to delete ${selectedIds.length} selected book(s)? This will also delete all of their copies.`)) {
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
    setUnresolvedFields([]);
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
      }
      setUnresolvedFields(meta?.unresolvedFields ?? []);

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
        if (meta.dewey_code && !addForm.getValues("dewey_code")) {
          addForm.setValue("dewey_code", meta.dewey_code);
        }

        // Download cover url and convert to base64. Awaited so this can't land after the
        // lookup's `finally` clears the loading state and the rest of the form is already
        // considered settled — that race previously let the cover fall out of sync with
        // everything else that autofill just set.
        if (meta.cover_url) {
          toast.loading(t("catalog.alerts.downloadingCover") || "Downloading book cover image...", { id: toastId });
          const downloaded = await downloadCoverAsBase64(meta.cover_url);
          addForm.setValue("cover_path", downloaded);
          if (downloaded.startsWith("data:")) {
            toast.success(t("catalog.alerts.coverDownloaded") || "Book cover downloaded!", { id: toastId });
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

  // Dynamic count for saved view filter tabs
  const savedViewCounts = useMemo(() => {
    if (!result.data) return { all: 0, recent: 0, available: 0, lowStock: 0, outOfStock: 0, noCopies: 0, missingCover: 0, missingIsbn: 0 };

    const baseList = result.data.filter(b => {
      if (langFilter !== "All Languages" && (b.language || "").toLowerCase() !== langFilter.toLowerCase()) return false;
      if (catFilter !== "All Categories" && b.category !== catFilter) return false;
      return true;
    });

    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    let recent = 0;
    let available = 0;
    let lowStock = 0;
    let outOfStock = 0;
    let noCopies = 0;
    let missingCover = 0;
    let missingIsbn = 0;

    for (const b of baseList) {
      const addedDate = new Date(b.created_at).getTime();
      if (now - addedDate <= sevenDaysMs) recent++;

      const avail = b.available_copies ?? 0;
      const total = b.total_copies ?? 0;

      if (avail > 0) available++;
      if (avail > 0 && avail <= 2) lowStock++;
      if (total > 0 && avail === 0) outOfStock++;
      if (total === 0) noCopies++;

      if (!b.cover_path && !b.cover_url) missingCover++;
      if (!b.isbn13 && !b.isbn10) missingIsbn++;
    }

    return {
      all: baseList.length,
      recent,
      available,
      lowStock,
      outOfStock,
      noCopies,
      missingCover,
      missingIsbn
    };
  }, [result.data, langFilter, catFilter]);

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
      } else if (savedView === "Low Stock") {
        const avail = b.available_copies ?? 0;
        if (avail === 0 || avail > 2) return false;
      } else if (savedView === "Out of Stock") {
        const total = b.total_copies ?? 0;
        const avail = b.available_copies ?? 0;
        if (total === 0 || avail > 0) return false;
      } else if (savedView === "No Copies") {
        if ((b.total_copies ?? 0) > 0) return false;
      } else if (savedView === "Missing Cover") {
        if (b.cover_path || b.cover_url) return false;
      } else if (savedView === "Missing ISBN") {
        if (b.isbn13 || b.isbn10) return false;
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

  const savedViewTabs = [
    { id: "All Books", label: t("catalog.allBooks", "All Items"), count: savedViewCounts.all },
    { id: "Recent Additions", label: t("catalog.recentAdditions", "Recent Additions"), count: savedViewCounts.recent },
    { id: "Available Now", label: t("catalog.availableNow", "Available Now"), count: savedViewCounts.available },
    { id: "Low Stock", label: t("catalog.lowStock", "Low Stock"), count: savedViewCounts.lowStock },
    { id: "Out of Stock", label: t("catalog.outOfStock", "Out of Stock"), count: savedViewCounts.outOfStock },
    { id: "No Copies", label: t("catalog.noCopies", "No Copies"), count: savedViewCounts.noCopies },
    { id: "Missing Cover", label: t("catalog.missingCover", "Missing Cover"), count: savedViewCounts.missingCover },
    { id: "Missing ISBN", label: t("catalog.missingIsbn", "Missing ISBN"), count: savedViewCounts.missingIsbn },
  ];

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
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#122222]/40 dark:text-white/40" />
            <input
              id="catalog-page-search"
              type="text"
              placeholder={t("catalog.searchPlaceholder")}
              value={term}
              onChange={(e) => { setTerm(e.target.value); setPage(1); }}
              className="w-full bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-lg py-2 pl-9 pr-3 text-[13px] text-[#122222] dark:text-[#f0ebe1] outline-none focus:border-emerald focus:ring-1 focus:ring-emerald"
            />
          </div>

          {/* Item Type Filter Select */}
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-lg py-2 px-4 text-[13px] font-semibold text-[#122222]/70 dark:text-white/70 outline-none cursor-pointer hover:border-emerald/30 transition-colors"
          >
            <option value="All Items">{t("itemTypes.allItems", "All Item Types")}</option>
            <option value="book">{t("itemTypes.book", "Book")}</option>
            <option value="fyp">{t("itemTypes.fyp", "FYP / PFE")}</option>
            <option value="journal">{t("itemTypes.journal", "Journal")}</option>
            <option value="other">{t("itemTypes.other", "Other / Misc")}</option>
          </select>

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
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
            <span className="text-[11px] font-semibold text-[#122222]/40 dark:text-white/40 uppercase tracking-wider pl-2 pr-2 shrink-0 select-none">
              {t("catalog.savedViews")}:
            </span>
            {savedViewTabs.map((tab) => {
              const isActive = savedView === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setSavedView(tab.id); setPage(1); }}
                  className={`px-3 py-1.5 text-[12px] font-bold rounded-md transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer ${isActive
                    ? "bg-emerald text-white shadow-sm"
                    : "text-[#122222]/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold transition-colors ${isActive
                      ? "bg-white/20 text-white"
                      : "bg-black/5 dark:bg-white/10 text-[#122222]/70 dark:text-white/70"
                      }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Table Area */}
        <div className="flex-1 bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-xl overflow-hidden flex flex-col shadow-card">
          <div className="flex-1 overflow-auto">
            {result.isLoading ? (
              <PageLoader label={t("catalog.loading", "Loading catalog…")} />
            ) : paginatedBooks.length ? (
              <table className="min-w-[1100px] w-full text-left text-[13px]">
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
                    <th className="px-4 py-3 whitespace-nowrap cursor-pointer hover:text-emerald dark:hover:text-emerald-light" onClick={() => handleSort("title")}>
                      {t("catalog.headers.title")} {sortBy === "title" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                    </th>
                    <th className="px-4 py-3 whitespace-nowrap">
                      {t("catalog.headers.type", "TYPE")}
                    </th>
                    <th className="px-4 py-3 whitespace-nowrap cursor-pointer hover:text-emerald dark:hover:text-emerald-light" onClick={() => handleSort("author")}>
                      {t("catalog.headers.author")} {sortBy === "author" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                    </th>
                    <th className="px-4 py-3 whitespace-nowrap cursor-pointer hover:text-emerald dark:hover:text-emerald-light" onClick={() => handleSort("category")}>
                      {t("catalog.headers.category")} {sortBy === "category" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                    </th>
                    <th className="px-4 py-3 whitespace-nowrap cursor-pointer hover:text-emerald dark:hover:text-emerald-light" onClick={() => handleSort("isbn")}>
                      {t("catalog.headers.isbn")} {sortBy === "isbn" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                    </th>
                    <th className="px-4 py-3 whitespace-nowrap cursor-pointer hover:text-emerald dark:hover:text-emerald-light" onClick={() => handleSort("created_at")}>
                      {t("catalog.headers.dateAdded", "Date Added")} {sortBy === "created_at" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                    </th>
                    <th className="px-4 py-3 whitespace-nowrap cursor-pointer hover:text-emerald dark:hover:text-emerald-light" onClick={() => handleSort("available_copies")}>
                      {t("catalog.headers.availability", "Availability")} {sortBy === "available_copies" ? (sortOrder === "asc" ? "▲" : "▼") : "↕"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/5">
                  {paginatedBooks.map((book) => {
                    const displayTitle = getDisplayTitle(book, titlePreference);
                    return (
                      <tr
                        key={book.id}
                        onClick={() => setSelectedBook(book)}
                        onContextMenu={(e) => handleBookContextMenu(e, book)}
                        className={`cursor-pointer transition-colors ${selectedIds.includes(book.id)
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
                              <DefaultCover type={book.item_type} className="w-8 h-12 shrink-0" iconSize={15} />
                            )}
                            <div className="min-w-0 flex-1 max-w-[280px]">
                              <div className="font-bold text-[#122222] dark:text-white truncate" title={displayTitle.main}>{displayTitle.main}</div>
                              {displayTitle.sub && <div className="text-[11px] text-[#122222]/50 dark:text-white/50 mt-0.5 truncate" title={displayTitle.sub}>{displayTitle.sub}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <ItemTypeBadge type={book.item_type} />
                        </td>
                        <td className="px-4 py-3 text-[#122222]/70 dark:text-white/70 max-w-[160px]">
                          <div className="truncate" title={book.author || ""}>{book.author || "—"}</div>
                        </td>
                        <td className="px-4 py-3 text-[#122222]/70 dark:text-white/70 max-w-[140px]">
                          <div className="truncate" title={book.category || ""}>{book.category || t("catalog.uncategorized") || "Uncategorized"}</div>
                        </td>
                        <td className="px-4 py-3 text-[#122222]/70 dark:text-white/70 font-mono text-[12px] whitespace-nowrap">{formatIsbn(book.isbn13 || book.isbn10) || "—"}</td>
                        <td className="px-4 py-3 text-[#122222]/70 dark:text-white/70 whitespace-nowrap">{formatDisplayDate(book.created_at)}</td>
                        <td className="px-4 py-3 text-[#122222]/70 dark:text-white/70 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${(book.available_copies ?? 0) > 0
                            ? 'bg-emerald/10 text-emerald dark:text-emerald-light'
                            : 'bg-red-500/10 text-red-500'
                            }`}>
                            {book.available_copies ?? 0} / {book.total_copies ?? 0}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-[#122222]/50 dark:text-white/50">
                <img src={catalogLibrarySrc} alt="" aria-hidden="true" className="h-92 w-auto object-contain mb-2 opacity-90" />
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
          key={selectedBook.id}
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
            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 md:col-span-2">
              <span>{t("catalog.itemType", "Item Type")} <span className="text-red-500">*</span></span>
              <ItemTypeSelect
                value={addForm.watch("item_type") || "book"}
                onChange={(v) => addForm.setValue("item_type", v)}
                className="mt-1"
              />
            </label>
            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 md:col-span-2"><span>{t("catalog.addModal.titleLabel")} <span className="text-red-500">*</span></span>
              <Input {...registerClean(addForm, "title", cleanText)} placeholder="e.g. Title / Item Name" />
              {addForm.formState.errors.title && <small className="text-red-500">{addForm.formState.errors.title.message}</small>}
            </label>

            <TypeSpecificFields
              itemType={addForm.watch("item_type") || "book"}
              form={addForm}
              registerClean={registerClean}
              lookupLoading={lookupLoading}
              handleIsbnLookup={handleIsbnLookup}
              unresolvedFields={unresolvedFields}
              t={t}
            />

            <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 md:col-span-2">{t("catalog.addModal.tagsLabel")}
              <Input {...registerClean(addForm, "tags", cleanText)} placeholder="e.g. classic, medical, reference" />
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
                placeholder="Write summary description or notes..."
                className="w-full bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-lg py-2 px-3 text-[13px] text-[#122222] dark:text-white outline-none focus:border-emerald min-h-[60px] mt-1"
              />
              <AutofillGapHint field="description" unresolvedFields={unresolvedFields} t={t} />
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
              {t("catalog.bulk.archiveSelected") || "Delete Selected"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BookSidebar({ book, onClose, registerClean }: { book: Book; onClose: () => void; registerClean: any }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"details" | "copies">("details");
  const [isEditing, setIsEditing] = useState(false);
  const [addCopyOpen, setAddCopyOpen] = useState(false);
  const [editingCopy, setEditingCopy] = useState<BookCopy | null>(null);

  // Queries
  const { data: copiesList, refetch: refetchCopies } = useQuery({
    queryKey: ["book-copies", book.id],
    queryFn: () => getCopiesForBook(book.id)
  });


  const auditQuery = useQuery({ queryKey: ["book-audit-logs", book.id], queryFn: () => auditLog() });

  const bookAudits = useMemo(() => {
    return auditQuery.data?.filter(l => l.entity_id === book.id).slice(0, 5) ?? [];
  }, [auditQuery.data, book.id]);

  const parsedMetadata = useMemo(() => {
    if (!book.metadata) return {} as Record<string, string>;
    try {
      return JSON.parse(book.metadata) as Record<string, string>;
    } catch (_) {
      return {} as Record<string, string>;
    }
  }, [book.metadata]);

  // Edit Book Form
  const editForm = useForm<BookValues>({
    resolver: zodResolver(bookSchema),
    defaultValues: {
      title: book.title || "",
      item_type: book.item_type || "book",
      subtitle: book.subtitle || "",
      arabic_title: book.arabic_title || "",
      tags: book.tags || "",
      author: book.author || "",
      isbn: formatIsbn(book.isbn13 || book.isbn10 || ""),
      publisher: book.publisher || "",
      category: book.category || "",
      language: book.language || "English",
      publication_year: book.publication_year ? String(book.publication_year) : "",
      call_number: book.call_number || "",
      dewey_code: book.dewey_code || "",
      description: book.description || "",
      cover_path: book.cover_path || "",
      issue_number: parsedMetadata.issue_number || "",
      frequency: parsedMetadata.frequency || "",
      issn: parsedMetadata.issn || "",
      pub_date: parsedMetadata.pub_date || "",
      issue_date: parsedMetadata.issue_date || "",
      press: parsedMetadata.press || "",
      region: parsedMetadata.region || "",
      editor: parsedMetadata.editor || "",
      ruling_type: parsedMetadata.ruling_type || "",
      page_count: parsedMetadata.page_count || "",
      paper_size: parsedMetadata.paper_size || "",
      brand: parsedMetadata.brand || "",
      media_format: parsedMetadata.media_format || "",
      duration: parsedMetadata.duration || "",
      model_number: parsedMetadata.model_number || "",
      specifications: parsedMetadata.specifications || "",
      artist: parsedMetadata.artist || "",
      studio: parsedMetadata.studio || "",
      owner: parsedMetadata.owner || "",
    }
  });

  useEffect(() => {
    editForm.reset({
      title: book.title || "",
      item_type: book.item_type || "book",
      subtitle: book.subtitle || "",
      arabic_title: book.arabic_title || "",
      tags: book.tags || "",
      author: book.author || "",
      isbn: formatIsbn(book.isbn13 || book.isbn10 || ""),
      publisher: book.publisher || "",
      category: book.category || "",
      language: book.language || "English",
      publication_year: book.publication_year ? String(book.publication_year) : "",
      call_number: book.call_number || "",
      dewey_code: book.dewey_code || "",
      description: book.description || "",
      cover_path: book.cover_path || "",
      issue_number: parsedMetadata.issue_number || "",
      frequency: parsedMetadata.frequency || "",
      issn: parsedMetadata.issn || "",
      pub_date: parsedMetadata.pub_date || "",
      issue_date: parsedMetadata.issue_date || "",
      press: parsedMetadata.press || "",
      region: parsedMetadata.region || "",
      editor: parsedMetadata.editor || "",
      ruling_type: parsedMetadata.ruling_type || "",
      page_count: parsedMetadata.page_count || "",
      paper_size: parsedMetadata.paper_size || "",
      brand: parsedMetadata.brand || "",
      media_format: parsedMetadata.media_format || "",
      duration: parsedMetadata.duration || "",
      model_number: parsedMetadata.model_number || "",
      specifications: parsedMetadata.specifications || "",
      artist: parsedMetadata.artist || "",
      studio: parsedMetadata.studio || "",
      owner: parsedMetadata.owner || "",
    });
  }, [book, parsedMetadata, editForm]);

  const watchedEditTags = editForm.watch("tags");

  // Add Copy Form
  const copyForm = useForm({
    defaultValues: { barcode: "", accession: "", condition: "good", shelfId: "" }
  });

  // Fetch shelves for the location select — the fixed A-F + floor model per room.
  const shelvesQuery = useQuery({ queryKey: ["shelves-all-catalog"], queryFn: () => getShelves() });
  const allShelves = shelvesQuery.data ?? [];

  // Mutations
  const updateBookMutation = useMutation({
    mutationFn: (values: BookValues) => {
      const isbn = normalizeIsbn(values.isbn || "");
      const { author, publisher, callNumber, metadataJson } = buildMetadataAndItemFields(values);

      return updateBook(book.id, {
        title: cleanText(values.title),
        item_type: values.item_type || "book",
        subtitle: values.subtitle ? cleanText(values.subtitle) : null,
        arabic_title: values.arabic_title ? cleanText(values.arabic_title) : null,
        tags: values.tags ? cleanText(values.tags) : null,
        author: author,
        isbn10: isbn.length === 10 ? isbn : null,
        isbn13: isbn.length === 13 ? isbn : null,
        publisher: publisher,
        category: values.category ? cleanText(values.category) : "",
        language: cleanText(values.language),
        publication_year: values.publication_year ? Number(values.publication_year) : null,
        call_number: callNumber,
        dewey_code: values.dewey_code ? cleanText(values.dewey_code) : null,
        description: values.description ? cleanText(values.description) : null,
        cover_path: values.cover_path || null,
        metadata: metadataJson
      });
    },
    onSuccess: () => {
      toast.success(t("catalog.alerts.updated") || "Item metadata updated.");
      setIsEditing(false);
      invalidate();
      onClose();
    },
    onError: (err: any) => {
      console.error("Update book error detail:", err);
      toast.error(err?.message || String(err) || t("catalog.alerts.updateError") || "An unknown error occurred while updating.");
    }
  });

  const deleteBookMutation = useMutation({
    mutationFn: () => deleteBook(book.id),
    onSuccess: () => {
      toast.success(t("catalog.alerts.archived") || "Book and all copies deleted.");
      invalidate();
      onClose();
    },
    onError: (err: any) => toast.error(err.message)
  });

  const addCopyMutation = useMutation({
    mutationFn: (values: any) => addCopy(book.id, cleanBarcode(values.barcode), cleanAccession(values.accession), values.condition, values.shelfId || null),
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
      toast.success(t("catalog.alerts.copyArchived") || "Copy deleted.");
      refetchCopies();
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
        <button onClick={onClose} className="text-[#122222]/40 dark:text-white/40 hover:text-[#122222] dark:hover:text-white transition-colors cursor-pointer"><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-auto p-6 flex flex-col items-start space-y-6 [scrollbar-gutter:stable]">
        {/* Book Cover */}
        <div className="w-full aspect-[2/3] bg-[#f4ebdd] dark:bg-[#1a2522] rounded-xl border border-black/10 flex items-center justify-center shadow-md relative overflow-hidden shrink-0">
          <div className="absolute left-2 top-0 bottom-0 w-1 bg-black/10" />
          {book.cover_path ? (
            <img src={book.cover_path} alt={book.title} className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-[#122222]/40 dark:text-white/40">
              <DefaultCover type={book.item_type} className="w-20 h-20 rounded-2xl border-0 bg-transparent" iconSize={44} />
              <ItemTypeBadge type={book.item_type} />
            </div>
          )}
        </div>

        {/* Tab Buttons */}
        <div className="flex w-full border-b border-black/5 dark:border-white/5 shrink-0">
          <button
            onClick={() => { setActiveTab("details"); setIsEditing(false); }}
            className={`flex-1 pb-2 text-[12px] font-bold border-b-2 text-center transition-all cursor-pointer whitespace-nowrap px-1 ${activeTab === "details" ? "border-emerald text-emerald dark:border-emerald-light dark:text-emerald-light" : "border-transparent text-[#122222]/50 dark:text-white/50"
              }`}
          >
            {t("catalog.details.title")}
          </button>
          <button
            onClick={() => setActiveTab("copies")}
            className={`flex-1 pb-2 text-[12px] font-bold border-b-2 text-center transition-all cursor-pointer whitespace-nowrap px-1 ${activeTab === "copies" ? "border-emerald text-emerald dark:border-emerald-light dark:text-emerald-light" : "border-transparent text-[#122222]/50 dark:text-white/50"
              }`}
          >
            {t("catalog.details.copies", { count: copiesList?.length ?? 0 })}
          </button>
        </div>

        {activeTab === "details" && (
          <div className="w-full space-y-4">
            <div>
              {(() => {
                const titlePreference = useUiStore.getState().preferences.titlePreference;
                const displayTitle = getDisplayTitle(book, titlePreference);
                return (
                  <>
                    <h2 className="text-[18px] font-bold text-[#122222] dark:text-white leading-tight mb-1">{displayTitle.main}</h2>
                    {displayTitle.sub && <p className="text-[13px] text-[#122222]/60 dark:text-white/60 mb-2 font-medium">{displayTitle.sub}</p>}
                  </>
                );
              })()}
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
              <InfoRow label={t("catalog.itemType", "Item Type")} value={<ItemTypeBadge type={book.item_type} />} />
              <InfoRow label={t("catalog.details.author")} value={book.author || "—"} />
              <InfoRow label={t("catalog.details.category")} value={book.category || t("catalog.uncategorized") || "Uncategorized"} />
              <InfoRow label={t("catalog.details.language")} value={book.language} />
              <InfoRow label={t("catalog.details.publisher")} value={book.publisher || "—"} />
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label={t("catalog.details.pubYear")} value={book.publication_year ? String(book.publication_year) : "—"} />
                <InfoRow label={t("catalog.details.callNumber")} value={book.call_number || "—"} />
              </div>
              <InfoRow label={t("catalog.details.deweyCode")} value={book.dewey_code || "—"} />
              <InfoRow label={t("catalog.details.isbn10")} value={formatIsbn(book.isbn10) || "—"} />
              <InfoRow label={t("catalog.details.isbn13")} value={formatIsbn(book.isbn13) || "—"} />

              {Object.keys(parsedMetadata).length > 0 && (
                <div className="pt-3 border-t border-black/5 dark:border-white/5 space-y-2">
                  <div className="text-[11px] font-bold text-[#122222]/50 dark:text-white/50 uppercase tracking-wider mb-2">
                    {t("catalog.details.specifications", "Item Specifications")}
                  </div>
                  {parsedMetadata.issue_number && <InfoRow label={t("itemFields.issueNumber", "Issue / Volume")} value={parsedMetadata.issue_number} />}
                  {parsedMetadata.frequency && <InfoRow label={t("itemFields.frequency", "Frequency")} value={parsedMetadata.frequency} />}
                  {parsedMetadata.issn && <InfoRow label={t("itemFields.issn", "ISSN")} value={parsedMetadata.issn} />}
                  {parsedMetadata.pub_date && <InfoRow label={t("itemFields.pubDate", "Pub Date / Month")} value={parsedMetadata.pub_date} />}
                  {parsedMetadata.issue_date && <InfoRow label={t("itemFields.issueDate", "Edition / Issue Date")} value={parsedMetadata.issue_date} />}
                  {parsedMetadata.press && <InfoRow label={t("itemFields.press", "Press / Publisher")} value={parsedMetadata.press} />}
                  {parsedMetadata.region && <InfoRow label={t("itemFields.region", "Region / City")} value={parsedMetadata.region} />}
                  {parsedMetadata.editor && <InfoRow label={t("itemFields.editor", "Chief Editor / Society")} value={parsedMetadata.editor} />}
                  {parsedMetadata.ruling_type && <InfoRow label={t("itemFields.rulingType", "Ruling Type")} value={parsedMetadata.ruling_type} />}
                  {parsedMetadata.page_count && <InfoRow label={t("itemFields.pageCount", "Page Count")} value={parsedMetadata.page_count} />}
                  {parsedMetadata.paper_size && <InfoRow label={t("itemFields.paperSize", "Paper Size")} value={parsedMetadata.paper_size} />}
                  {parsedMetadata.brand && <InfoRow label={t("itemFields.brand", "Brand / Manufacturer")} value={parsedMetadata.brand} />}
                  {parsedMetadata.media_format && <InfoRow label={t("itemFields.mediaFormat", "Media Format")} value={parsedMetadata.media_format} />}
                  {parsedMetadata.duration && <InfoRow label={t("itemFields.duration", "Runtime / Duration")} value={parsedMetadata.duration} />}
                  {parsedMetadata.model_number && <InfoRow label={t("itemFields.modelNumber", "Model / Serial #")} value={parsedMetadata.model_number} />}
                  {parsedMetadata.artist && <InfoRow label={t("itemFields.artist", "Artist / Creator")} value={parsedMetadata.artist} />}
                  {parsedMetadata.studio && <InfoRow label={t("itemFields.studio", "Studio / Label")} value={parsedMetadata.studio} />}
                  {parsedMetadata.owner && <InfoRow label={t("itemFields.owner", "Owner / Department")} value={parsedMetadata.owner} />}
                  {parsedMetadata.specifications && <InfoRow label={t("itemFields.specifications", "Details")} value={parsedMetadata.specifications} />}
                </div>
              )}

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
                  if (confirm(t("catalog.alerts.confirmDelete") || "Are you sure you want to delete this item? This will also delete all of its copies.")) {
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
          </div>
        )}

        {activeTab === "copies" && (
          <div className="w-full space-y-4">
            <div className="flex justify-between items-center shrink-0">
              <h3 className="font-bold text-[14px] text-[#122222] dark:text-white">{t("catalog.details.physicalCopies") || "Physical copies"}</h3>
              <button
                onClick={() => {
                  copyForm.reset({
                    barcode: "",
                    accession: crypto.randomUUID(),
                    condition: "good",
                    shelfId: ""
                  });
                  setAddCopyOpen(true);
                }}
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
                        <MapPin size={10} />
                        {copy.room ? `${copy.room} · ` : ""}
                        {copy.column_number != null ? `${t("inventory.columnLabel", "Column {{number}}", { number: copy.column_number })} · ` : ""}
                        {copy.shelf === FLOOR_SHELF_CODE ? t("inventory.floorShelf", "Floor shelf") : t("inventory.shelfLetter", "Shelf {{code}}", { code: copy.shelf })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge value={copy.status} />
                    <button
                      onClick={() => setEditingCopy(copy)}
                      className="text-[#122222]/50 dark:text-white/50 hover:text-emerald cursor-pointer"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(t("catalog.alerts.confirmArchiveCopy") || "Are you sure you want to delete this copy?")) {
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
                  <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">
                    <span>{t("catalog.details.copyAccession") || "Index"} <span className="text-red-500">*</span></span>
                    <Input {...registerClean(copyForm, "accession", cleanAccession)} placeholder={t("catalog.details.copyAccessionPlaceholder") || "Enter copy index (e.g. 001)"} required />
                  </label>
                  <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">{t("catalog.details.copyBarcode") || "Barcode"}
                    <Input {...registerClean(copyForm, "barcode", cleanBarcode)} placeholder="Scan or enter copy barcode (optional)" />
                  </label>
                  <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">{t("catalog.details.shelfLabel", "Shelf")}
                    <select {...copyForm.register("shelfId")} className="field-select mt-1 text-[13px] py-2 px-3 bg-white dark:bg-[#1d2926]">
                      <option value="">{t("catalog.details.shelfUnassigned", "Unassigned")}</option>
                      {allShelves.map((s) => (
                        <option key={s.id} value={s.id}>{s.room} · {t("inventory.columnLabel", "Column {{number}}", { number: s.column_number })} · {s.shelf_type === "floor" ? `${FLOOR_SHELF_CODE} ${t("inventory.floorShelf", "Floor shelf")}` : `${t("inventory.shelfLetter", "Shelf {{code}}", { code: s.code })}`}</option>
                      ))}
                    </select>
                  </label>
                  <div>
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

            {editingCopy && (
              <CopyEditModal
                copy={editingCopy}
                onClose={() => { setEditingCopy(null); refetchCopies(); }}
                shelves={allShelves}
              />
            )}
          </div>
        )}

        {/* Edit Item Modal */}
        {isEditing && (
          <Modal isOpen={isEditing} onClose={() => setIsEditing(false)} title={t("catalog.addModal.editTitle") || "Edit Item"}>
            <form onSubmit={editForm.handleSubmit((v) => updateBookMutation.mutate(v))} className="grid gap-4 md:grid-cols-2 text-[13px]">
              <div className="md:col-span-2 flex justify-center py-1">
                <ImageUpload
                  value={editForm.watch("cover_path")}
                  onChange={(val) => editForm.setValue("cover_path", val || "")}
                  shape="cover"
                  label={t("catalog.addModal.cover")}
                />
              </div>
              <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 md:col-span-2">{t("catalog.itemType", "Item Type")}
                <ItemTypeSelect
                  value={editForm.watch("item_type") || "book"}
                  onChange={(v) => editForm.setValue("item_type", v)}
                  className="mt-1"
                />
              </label>
              <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 md:col-span-2">{t("catalog.addModal.titleLabel")}
                <Input {...registerClean(editForm, "title", cleanText)} />
              </label>

              <TypeSpecificFields
                itemType={editForm.watch("item_type") || "book"}
                form={editForm}
                registerClean={registerClean}
                t={t}
              />

              <label className="text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 md:col-span-2 block font-semibold">{t("catalog.addModal.tagsLabel")}
                <Input {...registerClean(editForm, "tags", cleanText)} />
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
              <label className="md:col-span-2 text-[11px] font-semibold text-[#122222]/60 dark:text-white/60 block">{t("catalog.addModal.descLabel")}
                <textarea
                  {...registerClean(editForm, "description", cleanText)}
                  className="w-full bg-[#fcfbf8] dark:bg-[#111d1a] border border-black/10 dark:border-white/10 rounded-lg py-2 px-3 text-[13px] text-[#122222] dark:text-white outline-none focus:border-emerald min-h-[60px] mt-1"
                />
              </label>
              <div className="md:col-span-2 flex gap-2 justify-end pt-4 border-t border-black/5 dark:border-white/5">
                <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>{t("catalog.addModal.cancel")}</Button>
                <Button type="submit" disabled={updateBookMutation.isPending}>{updateBookMutation.isPending ? "Saving..." : t("save")}</Button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
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
