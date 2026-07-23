import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { LucideIcon } from "lucide-react";

export interface ContextMenuItem {
  id?: string;
  label?: string;
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  shortcut?: string;
  variant?: "default" | "danger" | "warning" | "success" | "accent";
  disabled?: boolean;
  divider?: boolean;
  hidden?: boolean;
}

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  title?: string;
  items: ContextMenuItem[];
}

interface ContextMenuContextType {
  showContextMenu: (e: React.MouseEvent | MouseEvent, items: ContextMenuItem[], options?: { title?: string }) => void;
  hideContextMenu: () => void;
}

const ContextMenuContext = createContext<ContextMenuContextType | null>(null);

export function useContextMenu() {
  const ctx = useContext(ContextMenuContext);
  if (!ctx) {
    throw new Error("useContextMenu must be used within a ContextMenuProvider");
  }
  return ctx;
}

export function ContextMenuProvider({ children }: { children: React.ReactNode }) {
  const [menuState, setMenuState] = useState<ContextMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const hideContextMenu = useCallback(() => {
    setMenuState(null);
  }, []);

  const showContextMenu = useCallback((
    e: React.MouseEvent | MouseEvent,
    items: ContextMenuItem[],
    options?: { title?: string }
  ) => {
    e.preventDefault();
    e.stopPropagation();

    // Filter hidden items
    const visibleItems = items.filter((item) => !item.hidden);
    if (visibleItems.length === 0) return;

    // Initial position based on click coordinates
    const clientX = e.clientX;
    const clientY = e.clientY;

    setMenuState({
      isOpen: true,
      x: clientX,
      y: clientY,
      title: options?.title,
      items: visibleItems,
    });
  }, []);

  // Keyboard and click outside listeners
  useEffect(() => {
    if (!menuState) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        hideContextMenu();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        hideContextMenu();
      }
    };

    const handleScroll = () => {
      hideContextMenu();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [menuState, hideContextMenu]);

  // Adjust coordinates after rendering to prevent screen overflow
  const [adjustedPos, setAdjustedPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (!menuState) return;
    const padding = 12;
    const menuEl = menuRef.current;
    
    let targetX = menuState.x;
    let targetY = menuState.y;

    if (menuEl) {
      const rect = menuEl.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      if (targetX + rect.width > vw - padding) {
        targetX = Math.max(padding, vw - rect.width - padding);
      }
      if (targetY + rect.height > vh - padding) {
        targetY = Math.max(padding, vh - rect.height - padding);
      }
    }

    setAdjustedPos({ x: targetX, y: targetY });
  }, [menuState]);

  return (
    <ContextMenuContext.Provider value={{ showContextMenu, hideContextMenu }}>
      {children}
      <AnimatePresence>
        {menuState && (
          <div className="fixed inset-0 z-[9999] pointer-events-none">
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, scale: 0.94, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: -4 }}
              transition={{ duration: 0.12, ease: "easeOut" }}
              style={{
                top: adjustedPos.y || menuState.y,
                left: adjustedPos.x || menuState.x,
              }}
              className="pointer-events-auto absolute min-w-[210px] max-w-[280px] rounded-2xl bg-[#122222]/95 backdrop-blur-xl border border-white/10 p-1.5 shadow-2xl text-[#f9f8f4] font-sans select-none overflow-hidden"
            >
              {menuState.title && (
                <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#b96f3e] border-b border-white/5 mb-1">
                  {menuState.title}
                </div>
              )}

              <div className="space-y-0.5">
                {menuState.items.map((item, index) => {
                  if (item.divider) {
                    return <div key={`divider-${index}`} className="my-1 border-t border-white/10" />;
                  }

                  const Icon = item.icon;
                  const isDanger = item.variant === "danger";
                  const isWarning = item.variant === "warning";
                  const isSuccess = item.variant === "success";
                  const isAccent = item.variant === "accent";

                  let colorStyle = "text-white/90 hover:bg-white/10 hover:text-white";
                  if (isDanger) {
                    colorStyle = "text-rose-400 hover:bg-rose-500/20 hover:text-rose-300";
                  } else if (isWarning) {
                    colorStyle = "text-amber-400 hover:bg-amber-500/20 hover:text-amber-300";
                  } else if (isSuccess) {
                    colorStyle = "text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300";
                  } else if (isAccent) {
                    colorStyle = "text-[#b96f3e] hover:bg-[#b96f3e]/20 hover:text-[#d48b59]";
                  }

                  return (
                    <button
                      key={item.id || `item-${index}`}
                      disabled={item.disabled}
                      onClick={() => {
                        if (item.disabled) return;
                        hideContextMenu();
                        if (item.onClick) item.onClick();
                      }}
                      className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                        item.disabled ? "opacity-40 cursor-not-allowed" : colorStyle
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        {Icon && <Icon className="h-4 w-4 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity" />}
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.shortcut && (
                        <span className="ml-3 text-[10px] font-mono opacity-50 tracking-tight shrink-0">
                          {item.shortcut}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ContextMenuContext.Provider>
  );
}
