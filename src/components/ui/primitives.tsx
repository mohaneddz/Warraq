import type { ButtonHTMLAttributes, InputHTMLAttributes, PropsWithChildren } from "react";
import { cn } from "../../utils/cn";
import { X } from "lucide-react";

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
  const color = value === "available" || value === "active" || value === "ready" 
    ? "bg-emerald/15 text-emerald" 
    : value === "on-loan" || value === "queued" 
      ? "bg-copper/15 text-copper" 
      : "bg-ink/10 text-ink dark:bg-parchment/10 dark:text-parchment"; 
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize", color)}>{value.replace("-", " ")}</span>; 
}

export function EmptyState({ title, description, action, icon: Icon }: { title: string; description: string; action?: React.ReactNode; icon?: React.ElementType }) { 
  return (
    <Card className="flex min-h-48 flex-col items-center justify-center text-center">
      {Icon && <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-emerald/10 text-emerald"><Icon size={24}/></div>}
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
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-card border border-ink/10 bg-white p-6 shadow-2xl dark:border-parchment/10 dark:bg-[#1d2926] dark:text-parchment flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-ink/10 pb-3 mb-4 dark:border-parchment/10">
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-control text-ink/60 hover:bg-ink/5 dark:text-parchment/60 dark:hover:bg-parchment/5 transition" 
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
}
