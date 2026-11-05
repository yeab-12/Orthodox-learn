import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bell, BookOpen, Bookmark, Compass, FolderUp, Home, ShieldCheck, Upload as UploadIcon, User, Users,
} from "lucide-react";
import { Logo } from "../components/Logo";
import { LangToggle } from "../components/LangToggle";
import { useAuth } from "../auth/AuthContext";
import { useLang, type Key } from "../i18n";
import { api } from "../api/client";
import type { NotificationItem } from "../types";

const items: { to: string; key: Key; icon: typeof Home; end?: boolean }[] = [
  { to: "/app", key: "home", icon: Home, end: true },
  { to: "/app/explore", key: "explore", icon: Compass },
  { to: "/app/courses", key: "courses", icon: BookOpen },
  { to: "/app/saved", key: "saved", icon: Bookmark },
  { to: "/app/upload", key: "upload", icon: UploadIcon },
  { to: "/app/my-uploads", key: "myUploads", icon: FolderUp },
  { to: "/app/community", key: "community", icon: Users },
  { to: "/app/notifications", key: "notifications", icon: Bell },
  { to: "/app/profile", key: "profile", icon: User },
];

const mobileItems = items.filter((item) => ["/app", "/app/explore", "/app/courses", "/app/upload", "/app/profile"].includes(item.to));

export function AppLayout() {
  const { t } = useLang();
  const { user } = useAuth();
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get<{ notifications: NotificationItem[]; unread: number }>("/notifications")).data,
    enabled: Boolean(user),
  });
  const unread = notifications.data?.unread ?? 0;

  return (
    <div className="min-h-screen lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-navy-900 focus:px-4 focus:py-2 focus:text-cream-50">
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto bg-navy-900 p-5 lg:flex">
        <Logo light to="/app" />
        <nav className="mt-7 flex flex-1 flex-col gap-1" aria-label="Main">
          {items.map(({ to, key, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `focus-ring flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold ${isActive ? "bg-gold-500 text-navy-950" : "text-cream-100 hover:bg-navy-800"}`}>
              <span className="relative">
                <Icon className="h-5 w-5" aria-hidden />
                {to === "/app/notifications" && unread > 0 && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-rubric-500 ring-2 ring-navy-900" />}
              </span>
              <span className="flex-1">{t(key)}</span>
              {to === "/app/notifications" && unread > 0 && <span className="rounded-full bg-rubric-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{unread}</span>}
            </NavLink>
          ))}
          {user?.role === "admin" && (
            <NavLink to="/app/admin" className={({ isActive }) => `focus-ring flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold ${isActive ? "bg-rubric-500 text-white" : "text-cream-100 hover:bg-navy-800"}`}>
              <ShieldCheck className="h-5 w-5" aria-hidden />{t("admin")}
            </NavLink>
          )}
        </nav>
        <div className="mt-5 border-t border-cream-50/10 pt-4">
          <p className="mb-2 truncate text-xs font-semibold text-cream-300">{user?.name}</p>
          <LangToggle dark />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-gold-600/20 bg-cream-50/95 px-3 backdrop-blur lg:hidden">
          <Logo to="/app" />
          <div className="flex items-center gap-1.5">
            <NavLink to="/app/notifications" aria-label={t("notifications")} className="focus-ring relative grid h-10 w-10 place-items-center rounded-full hover:bg-cream-200">
              <Bell className="h-5 w-5" aria-hidden />
              {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-rubric-500 ring-2 ring-cream-50" />}
            </NavLink>
            <LangToggle />
          </div>
        </header>

        <main id="main" className="app-main min-w-0"><Outlet /></main>

        <nav aria-label="Main" className="bottom-nav fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-gold-500/30 bg-navy-900 lg:hidden">
          {mobileItems.map(({ to, key, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `focus-ring flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${isActive ? "text-gold-400" : "text-cream-200"}`}>
              <Icon className="h-5 w-5" aria-hidden />{t(key)}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
