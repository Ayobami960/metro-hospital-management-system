import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Client-only UI state. Server data never lives here — TanStack Query owns it.
 * Only harmless preferences are persisted; no session or patient data is
 * written to browser storage.
 */
interface AppState {
  /** Desktop sidebar collapsed. */
  sidebarCollapsed: boolean;
  /** Mobile drawer open. */
  mobileSidebarOpen: boolean;
  notificationPanelOpen: boolean;
  /** Persisted per-screen list preferences. */
  listDensity: "comfortable" | "compact";
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleNotificationPanel: () => void;
  setNotificationPanelOpen: (open: boolean) => void;
  setListDensity: (density: "comfortable" | "compact") => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileSidebarOpen: false,
      notificationPanelOpen: false,
      listDensity: "comfortable",
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setMobileSidebarOpen: (mobileSidebarOpen) => set({ mobileSidebarOpen }),
      toggleNotificationPanel: () =>
        set((state) => ({ notificationPanelOpen: !state.notificationPanelOpen })),
      setNotificationPanelOpen: (notificationPanelOpen) => set({ notificationPanelOpen }),
      setListDensity: (listDensity) => set({ listDensity }),
    }),
    {
      name: "hms-ui-preferences",
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        listDensity: state.listDensity,
      }),
    },
  ),
);
