import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 8_000 } } });
export function Providers({ children }: PropsWithChildren) { return <QueryClientProvider client={queryClient}>{children}<Toaster richColors position="bottom-right"/></QueryClientProvider>; }
