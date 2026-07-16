import { useState, useMemo } from "react";
import { Input } from "./primitives";
import { cn } from "../../utils/cn";

export const PageTitle = ({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 className="font-display text-3xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-ink/60 dark:text-parchment/60">{detail}</p>
    </div>
    {action}
  </div>
);

export const Table = ({ headers, children }: { headers: string[]; children: React.ReactNode }) => (
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

export const Cell = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <td className={cn("border-b border-ink/7 px-4 py-3 last:border-0 dark:border-parchment/7", className)}>{children}</td>
);

export function SearchableSelect<T>({
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
