import { useEffect } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router";

import type { roles } from "@/types";
import Sidebar from "@/components/layout/sidebar";
import Navbar from "@/components/layout/navbar";
import { useAppStore } from "@/stores/app.store";
import { useSession } from "@/hooks/auth/use-session";
import { UNAUTHORIZED_EVENT } from "@/services/api/client";
import { ApiError } from "@/services/api/api-error";
import { getRoleHomeRoute } from "@/data";
import { Loader2 } from "lucide-react";

/** Route prefixes each role may open. Unknown prefixes stay available to all. */
const ROLE_PREFIXES: Record<roles, string[]> = {
  ADMIN: ["administration"],
  SUPER_ADMIN: ["administration"],
  DOCTOR: ["doctor"],
  NURSE: ["nurse"],
  PATIENT: ["patient"],
  RECEPTION: ["reception"],
  PHARMACY: ["pharmacy"],
  LABORATORY: ["lab"],
  BILLING: ["billing"],
};

const Layout = () => {
  const { data: session, isLoading, isError, error } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const collapsed = useAppStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const mobileOpen = useAppStore((state) => state.mobileSidebarOpen);
  const setMobileOpen = useAppStore((state) => state.setMobileSidebarOpen);

  // Expired/revoked sessions surface as 401 from any request.
  useEffect(() => {
    const onUnauthorized = () => navigate("/login", { replace: true });
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading session" />
      </div>
    );
  }

  // 403 means the password was accepted but an account stage is outstanding.
  // Onboarding is its own page; the remaining stages are challenge screens.
  // 401 is terminal and goes back to the password step.
  if (isError || !session) {
    const apiError = error instanceof ApiError ? error : null;
    const reason = (apiError?.details as { reason?: string } | null)?.reason;
    const destination =
      apiError?.status === 403
        ? reason === "ONBOARDING_REQUIRED"
          ? "/complete-profile"
          : "/login/verify"
        : "/login";
    return <Navigate to={destination} replace state={{ from: location.pathname }} />;
  }

  const role = session.role as roles;
  const allowed = ROLE_PREFIXES[role];
  const segment = location.pathname.split("/")[1] ?? "";
  if (allowed && segment && !allowed.includes(segment)) {
    return <Navigate to={getRoleHomeRoute(role)} replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-muted">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        role={role}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Navbar
          role={role}
          collapsed={collapsed}
          onToggleCollapsed={toggleSidebar}
          onOpenMobile={() => {
            setMobileOpen(true);
          }}
        />

        <main className="flex-1 overflow-y-auto bg-muted">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
