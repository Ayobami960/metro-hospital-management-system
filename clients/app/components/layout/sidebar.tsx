import { Link, useLocation } from "react-router";
import { Stethoscope, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNavForRole, roleColors, roleLabels } from "@/data";
import type { roles } from "@/types";
import { useSession } from "@/hooks/auth/use-session";
import { useUnreadMessages } from "@/hooks/messaging/messaging.hooks";

interface SidebarProps {
  role: roles;
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const Sidebar = ({ role, collapsed, mobileOpen, onCloseMobile }: SidebarProps) => {
  const location = useLocation();
  const { data: session } = useSession();
  const { data: unread } = useUnreadMessages();

  const nav = getNavForRole(role).map((item) =>
    item.url.endsWith("/messages") && unread?.unreadMessages
      ? { ...item, badge: unread.unreadMessages }
      : item,
  );
  const color = roleColors[role];
  const label = roleLabels[role];
  const userName = session?.name ?? "Signed in";
  const initials = session?.avatarInitials ?? userName.slice(0, 2).toUpperCase();
  const subtitle = session?.subtitle ?? session?.email ?? "";

  const expanded = !collapsed || mobileOpen;

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out lg:static lg:z-20 sidebar-shadow",
        collapsed ? "lg:w-[68px]" : "lg:w-64",
        mobileOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full lg:translate-x-0"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-sidebar-border px-5 py-5">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-[10px]"
          style={{ backgroundColor: color }}
        >
          <Stethoscope size={18} className="text-white" />
        </div>
        {expanded && (
          <div className="overflow-hidden">
            <div className="whitespace-nowrap font-sans text-base font-extrabold text-white">
              Medical app 
            </div>
            <div className="truncate text-[10px] font-semibold text-white/60">{label}</div>
          </div>
        )}
        <button onClick={onCloseMobile} className="ml-auto flex text-white/60 lg:hidden">
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        {nav.map((item) => {
          const Icon = item.icon;
          const isActive = item.url === location.pathname;
          return (
            <Link
              key={item.title}
              to={item.url}
              onClick={onCloseMobile}
              style={isActive ? { backgroundColor: color } : undefined}
              className={cn(
                "relative mb-0.5 flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13px] transition-colors",
                collapsed && !mobileOpen ? "lg:justify-center lg:px-3.5" : "",
                isActive
                  ? "font-semibold text-white"
                  : "font-normal text-white/70 hover:bg-sidebar-accent hover:text-white"
              )}
            >
              {Icon && <Icon size={18} className="shrink-0" />}
              {expanded && <span className="flex-1 whitespace-nowrap">{item.title}</span>}
              {expanded && !!item.badge && (
                <span
                  className={cn(
                    "flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
                    isActive ? "bg-white/20 text-white" : "bg-white/10 text-white/60"
                  )}
                >
                  {item.badge}
                </span>
              )}
              {collapsed && !mobileOpen && !!item.badge && (
                <div className="absolute right-1.5 top-1.5 size-2 rounded-full bg-red-500" />
              )}
            </Link>
          );
        })}
      </nav>

  

      {/* User */}
      <div className="flex items-center gap-2.5 border-t border-sidebar-border p-3">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {initials}
        </div>
        {expanded && (
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-bold text-white">{userName}</div>
            <div className="truncate text-[11px] text-white/50">{subtitle}</div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;