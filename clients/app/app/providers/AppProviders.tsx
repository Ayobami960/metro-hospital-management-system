import { Toaster } from "sonner";

import { ThemeProvider } from "@/components/provider/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryProvider } from "./QueryProvider";

/**
 * Root providers. Order matters only in that everything below QueryProvider may
 * use server-state hooks, and toasts/tooltips are available to every page.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider storageKey="medicore-theme" defaultTheme="system">
      <QueryProvider>
        <TooltipProvider>
          {children}
          <Toaster richColors closeButton position="bottom-right" toastOptions={{ duration: 8000 }} />
        </TooltipProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
