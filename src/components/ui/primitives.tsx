import type { ButtonHTMLAttributes, InputHTMLAttributes, PropsWithChildren } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../utils/cn";
import { X, BookOpen, GraduationCap, Newspaper, FileQuestion, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useThemedAsset } from "../../utils/useThemedAsset";

/** A small inline loading spinner. Size in pixels. */
export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={cn("animate-spin text-emerald", className)} aria-hidden="true" />;
}

/**
 * Full-height centered loading state for a page/panel while its data is being fetched.
 * Keeps the spinner + label visually consistent across Catalog, Members, Reservations, etc.
 */
export function PageLoader({ label, className }: { label?: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <div className={cn("flex flex-1 flex-col items-center justify-center gap-3 py-20 text-ink/50 dark:text-parchment/50", className)}>
      <Spinner size={32} />
      <p className="text-sm font-medium">{label ?? t("common.loading", "Loading…")}</p>
    </div>
  );
}

/** Icon per item type — reused by the type selector on the book form and by ItemTypeBadge. */
export const ITEM_TYPE_ICONS: Record<string, React.ElementType> = {
  book: BookOpen,
  fyp: GraduationCap,
  journal: Newspaper,
  other: FileQuestion,
};
export const ITEM_TYPE_VALUES = ["book", "fyp", "journal", "other"] as const;

export function Button({ className, variant = "primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const variants = { 
    primary: "bg-emerald text-white hover:bg-emerald/90", 
    secondary: "bg-parchment text-ink hover:bg-copper/15 dark:bg-ink/50 dark:text-parchment dark:hover:bg-ink/40", 
    danger: "bg-red-700 text-white hover:bg-red-800", 
    ghost: "bg-transparent text-ink hover:bg-ink/5 dark:text-parchment" 
  };
  return <button className={cn("inline-flex items-center justify-center gap-2 rounded-control px-3 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper disabled:cursor-not-allowed disabled:opacity-50", variants[variant], className)} {...props} />;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) { 
  return <input className={cn("w-full rounded-control border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-ink/45 focus:border-emerald focus:ring-2 focus:ring-emerald/20 dark:border-parchment/20 dark:bg-ink/30 dark:text-parchment", className)} {...props} />; 
}

export function Card({ children, className }: PropsWithChildren<{ className?: string }>) { 
  return <section className={cn("rounded-card border border-ink/10 bg-white p-5 shadow-card dark:border-parchment/10 dark:bg-[#1d2926] dark:text-parchment", className)}>{children}</section>; 
}

export function StatusBadge({ value }: { value: string }) { 
  const { t } = useTranslation();
  const color = value === "available" || value === "active" || value === "ready" 
    ? "bg-emerald/15 text-emerald" 
    : value === "on-loan" || value === "queued" 
      ? "bg-copper/15 text-copper" 
      : "bg-red-700/15 text-red-700"; 
  return <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-bold capitalize", color)}>{t(value, value)}</span>; 
}

export function ItemTypeBadge({ type, className }: { type?: string; className?: string }) {
  const { t } = useTranslation();
  const normalized = (type || "book").toLowerCase();
  const label = t(`itemTypes.${normalized}`, normalized);
  const Icon = ITEM_TYPE_ICONS[normalized] || ITEM_TYPE_ICONS.other;

  const styleMap: Record<string, string> = {
    book: "bg-emerald/10 text-emerald dark:text-emerald-light border-emerald/20",
    fyp: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    journal: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    other: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
  };

  return (
    <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold border", styleMap[normalized] || styleMap.other, className)}>
      <Icon size={11} />
      {label}
    </span>
  );
}

/**
 * A placeholder "cover" for catalogue items that have no cover image — shows an icon tinted per
 * item type (book / FYP / journal / other) so journals and equipment don't all fall back to a
 * generic book box. Use anywhere a cover thumbnail is rendered with `cover_path` as the fallback.
 */
export function DefaultCover({ type, className, iconSize = 18 }: { type?: string | null; className?: string; iconSize?: number }) {
  const normalized = (type || "book").toLowerCase();
  const Icon = ITEM_TYPE_ICONS[normalized] || ITEM_TYPE_ICONS.other;
  const tint: Record<string, string> = {
    book: "text-emerald bg-emerald/10",
    fyp: "text-purple-500 bg-purple-500/10",
    journal: "text-blue-500 bg-blue-500/10",
    other: "text-slate-500 bg-slate-500/10",
  };
  return (
    <div className={cn("flex items-center justify-center overflow-hidden rounded border border-black/10 dark:border-white/10", tint[normalized] || tint.other, className)}>
      <Icon size={iconSize} strokeWidth={1.75} />
    </div>
  );
}

/** Item-type selector with an icon per option, used on the book add/edit forms. */
export function ItemTypeSelect({ value, onChange, className }: { value: string; onChange: (value: string) => void; className?: string }) {
  const { t } = useTranslation();
  return (
    <div className={cn("grid grid-cols-4 gap-2", className)}>
      {ITEM_TYPE_VALUES.map((type) => {
        const Icon = ITEM_TYPE_ICONS[type];
        const active = value === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-xl border py-2.5 text-[11px] font-bold transition-all cursor-pointer",
              active
                ? "border-emerald bg-emerald/10 text-emerald dark:text-emerald-light ring-2 ring-emerald/20"
                : "border-ink/10 dark:border-parchment/10 text-ink/60 dark:text-parchment/60 hover:bg-ink/5 dark:hover:bg-parchment/5"
            )}
          >
            <Icon size={16} />
            {t(`itemTypes.${type}`, type)}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({ title, description, action, icon: Icon, image }: { title: string; description: string; action?: React.ReactNode; icon?: React.ElementType; image?: string }) {
  const illustration = useThemedAsset(image || "");
  return (
    <Card className="flex min-h-48 flex-col items-center justify-center text-center">
      {image ? (
        <img src={illustration} alt="" aria-hidden="true" className="mb-3 h-28 w-auto object-contain" />
      ) : Icon ? (
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-emerald/10 text-emerald"><Icon size={24}/></div>
      ) : null}
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink/65 dark:text-parchment/65">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "md" | "lg" | "xl" | "2xl";
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, size = "lg", className }: ModalProps) {
  const { t } = useTranslation();
  if (!isOpen) return null;

  const sizeClasses = {
    md: "max-w-xl",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    "2xl": "max-w-5xl"
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-all duration-200"
      onClick={onClose}
    >
      <div 
        className={cn("relative w-full max-h-[88vh] overflow-hidden rounded-card border border-ink/10 bg-white p-6 shadow-2xl dark:border-parchment/10 dark:bg-[#1d2926] dark:text-parchment flex flex-col animate-in fade-in zoom-in-95 duration-150", sizeClasses[size], className)}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-ink/10 pb-3 mb-4 dark:border-parchment/10 shrink-0">
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-control text-ink/60 hover:bg-ink/5 dark:text-parchment/60 dark:hover:bg-parchment/5 transition cursor-pointer" 
            aria-label={t("common.closeDialog") || "Close dialog"}
          >
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto px-3 py-2">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
