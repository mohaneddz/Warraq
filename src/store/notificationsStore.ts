import { create } from "zustand";

// The bell badge used to sum live, ever-present states — overdue loans, due-soon loans and
// ready holds — which have no "read" concept, so the badge never cleared for a real library.
// This store records which of those synthetic notifications the user has already acknowledged
// (by their stable id, e.g. `overdue-<loanId>`), so clicking one drops the badge and only
// genuinely new events light it back up. `sync` prunes ids that are no longer live, which also
// means a resolved-then-recurring alert is correctly treated as new again.

const KEY = "warraq-seen-notifications";

function load(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function save(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable */
  }
}

interface NotificationsState {
  seen: string[];
  markSeen: (ids: string[]) => void;
  /** Keep only ids that are still live so the set can't grow unbounded or mask recurring alerts. */
  sync: (validIds: string[]) => void;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  seen: load(),
  markSeen: (ids) =>
    set((state) => {
      const next = Array.from(new Set([...state.seen, ...ids]));
      if (next.length === state.seen.length) return state;
      save(next);
      return { seen: next };
    }),
  sync: (validIds) =>
    set((state) => {
      const valid = new Set(validIds);
      const next = state.seen.filter((id) => valid.has(id));
      if (next.length === state.seen.length) return state;
      save(next);
      return { seen: next };
    }),
}));
