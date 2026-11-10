import { useState } from "react";
import { Link, useLocation } from "react-router";
import {
  Bell,
  Search,
  ChevronDown,
  ChevronRight,
  Menu,
  LogOut,
  Settings,
  UserCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Theme from "./Theme";
import { getNavForRole, roleColors, roleLabels } from "@/data";
import type { roles } from "@/types";
import { useSession, useSignOut } from "@/hooks/auth/use-session";
import { useMarkAllNotificationsRead, useNotifications } from "@/hooks/messaging/messaging.hooks";

interface NavbarProps {
  role: roles;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenMobile: () => void;
}

const LEADING_ROLE_SLUG: Record<roles, string> = {
  ADMIN: "administration",
  SUPER_ADMIN: "administration",
  DOCTOR: "doctor",
  NURSE: "nurse",
  PATIENT: "patient",
  RECEPTION: "reception",
  PHARMACY: "pharmacy",
  LABORATORY: "lab",
  BILLING: "billing",
};

const formatRelative = (value: string): string => {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

const Navbar = ({ role, collapsed, onToggleCollapsed, onOpenMobile }: NavbarProps) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [searchVal, setSearchVal] = useState("");

  const location = useLocation();
  const nav = getNavForRole(role);
  const color = roleColors[role];
  const label = roleLabels[role];
  const { data: session } = useSession();
  const signOut = useSignOut();
  const { data: notifications, isLoading: notificationsLoading } = useNotifications({
    pageSize: 8,
  });
  const markAllRead = useMarkAllNotificationsRead();

  const userName = session?.name ?? "Signed in";
  const initials = session?.avatarInitials ?? userName.slice(0, 2).toUpperCase();
  const subtitle = session?.email ?? session?.subtitle ?? "";
  const rows = notifications?.rows ?? [];
  const unread = notifications?.unreadCount ?? 0;

  const activeItem = nav.find((item) => item.url === location.pathname) ?? nav[0];
  const totalBadge = unread + nav.reduce((sum, n) => sum + (n.badge ?? 0), 0);
  const settingsPath = `/${LEADING_ROLE_SLUG[role]}/settings`;

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-card px-4 sm:px-6 navbar-shadow">
      <button
        onClick={onOpenMobile}
        className="flex rounded-lg border border-border p-2 text-muted-foreground lg:hidden"
      >
        <Menu size={16} />
      </button>
      <button
        onClick={onToggleCollapsed}
        className="hidden rounded-lg border border-border p-2 text-muted-foreground lg:flex"
      >
        {collapsed ? <ChevronRight size={16} /> : <Menu size={16} />}
      </button>

      {/* Breadcrumb */}
      <div className="hidden items-center gap-1.5 text-sm text-muted-foreground sm:flex">
        <span>{label}</span>
        <ChevronRight size={14} />
        <span className="font-semibold text-foreground">{activeItem?.title}</span>
      </div>

      <div className="flex-1" />

      {/* Search */}
      <div className="relative hidden w-64 md:block">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={searchVal}
          onChange={(e) => setSearchVal(e.target.value)}
          placeholder="Search patients, records..."
          className="w-full rounded-lg border border-border bg-muted py-2 pl-9 pr-3 text-[13px] text-foreground outline-none focus:border-blue-600"
        />
      </div>

      {/* Theme toggle */}
      <Theme />

      {/* Notifications */}
      <div className="relative">
        <button
          onClick={() => {
            setNotifOpen(!notifOpen);
            setUserOpen(false);
          }}
          className="relative flex rounded-lg border border-border p-2 text-muted-foreground"
          aria-label="Notifications"
        >
          <Bell size={16} />
          {totalBadge > 0 && (
            <div className="absolute right-1.5 top-1.5 size-2 rounded-full bg-red-500" />
          )}
        </button>
        {notifOpen && (
          <div className="absolute right-0 top-11 z-[100] w-80 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
              <span className="text-sm font-bold text-foreground">Notifications</span>
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending || unread === 0}
                className="cursor-pointer text-xs font-semibold text-blue-600 disabled:cursor-default disabled:opacity-50"
              >
                Mark all read
              </button>
            </div>
            {notificationsLoading ? (
              <div className="flex items-center justify-center px-4 py-8">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                You have no notifications.
              </div>
            ) : (
              rows.map((n, i) => (
                <div
                  key={n.id}
                  className={cn(
                    "flex items-start gap-2.5 px-4 py-3",
                    i < rows.length - 1 && "border-b border-border",
                    !n.readAt && "bg-blue-50/50 dark:bg-blue-950/20",
                  )}
                >
                  <div
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      n.type === "error" || n.type === "alert"
                        ? "bg-red-500"
                        : n.type === "warning"
                          ? "bg-amber-500"
                          : "bg-blue-500",
                    )}
                  />
                  <div className="min-w-0">
                    <div className="mb-0.5 truncate text-[13px] font-medium text-foreground">
                      {n.title}
                    </div>
                    <div className="line-clamp-2 text-[11px] text-muted-foreground">{n.body}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {formatRelative(n.createdAt)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => {
            setUserOpen(!userOpen);
            setNotifOpen(false);
          }}
          className="flex items-center gap-2 rounded-[10px] border border-border px-2.5 py-1.5"
        >
          <div
            className="flex size-[30px] items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {initials}
          </div>
          <span className="hidden text-[13px] font-semibold text-foreground md:inline">
            {userName.split(" ")[0]}
          </span>
          <ChevronDown size={14} className="text-muted-foreground" />
        </button>
        {userOpen && (
          <div className="absolute right-0 top-11 z-[100] w-56 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
            <div className="border-b border-border px-4 py-3.5">
              <div className="text-sm font-bold text-foreground">{userName}</div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</div>
            </div>
            <Link
              to={settingsPath}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-foreground hover:bg-muted"
            >
              <UserCircle size={15} /> Profile
            </Link>
            <Link
              to={settingsPath}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-foreground hover:bg-muted"
            >
              <Settings size={15} /> Settings
            </Link>
            <div className="border-t border-border">
              <button
                type="button"
                onClick={() => signOut.mutate()}
                disabled={signOut.isPending}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-red-600 hover:bg-red-50 disabled:opacity-60 dark:hover:bg-red-950/30"
              >
                <LogOut size={15} /> {signOut.isPending ? "Signing out…" : "Sign Out"}
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
