import { create } from "zustand";
import type { PublicUser } from "../types";

interface AuthState {
  user: PublicUser | null;
  setUser: (user: PublicUser | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));

/** Username of the signed-in operator, for audit trails and issued_by/received_by fields. */
export function currentActor(): string {
  return useAuthStore.getState().user?.username ?? "unknown";
}
