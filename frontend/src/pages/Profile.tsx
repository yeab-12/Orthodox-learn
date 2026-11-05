import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Bookmark, FolderUp, Settings as SettingsIcon, ShieldCheck, UploadCloud } from "lucide-react";
import type { Summary } from "../types";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useLang } from "../i18n";
import { Avatar, btnPrimary, btnSecondary, PageHeader, RoleBadge, Spinner } from "../components/UI";

export function Profile() {
  const { t } = useLang();
  const { user } = useAuth();
  const summary = useQuery({
    queryKey: ["summary"],
    queryFn: async () => (await api.get<Summary>("/auth/me/summary")).data,
  });

  if (!user) return null;
  const stats = [
    { key: "savedCount", value: summary.data?.saved, to: "/app/saved", icon: Bookmark },
    { key: "completedCount", value: summary.data?.completed, to: "/app/courses", icon: BookOpen },
    { key: "coursesCount", value: summary.data?.courses, to: "/app/courses", icon: BookOpen },
    { key: "uploadsCount", value: summary.data?.uploads, to: "/app/my-uploads", icon: UploadCloud },
  ] as const;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <PageHeader
        title={t("profileTitle")}
        actions={
          <>
            <Link to="/app/settings" className={btnSecondary}><SettingsIcon className="h-4 w-4" aria-hidden /> {t("settings")}</Link>
            {user.role === "admin" && <Link to="/app/admin" className={btnPrimary}><ShieldCheck className="h-4 w-4" aria-hidden /> {t("adminPanel")}</Link>}
          </>
        }
      />

      <div className="mt-6 overflow-hidden rounded-3xl border border-gold-600/20 bg-cream-50 shadow-sm">
        <div className="h-24 bg-navy-900">
          <div className="manuscript-band" />
        </div>
        <div className="px-5 pb-6 sm:px-7">
          <div className="-mt-10 flex flex-wrap items-end gap-4">
            <span className="rounded-full ring-4 ring-cream-50"><Avatar name={user.name} size={84} /></span>
            <div className="min-w-0 flex-1 pb-1">
              <h2 className="font-display text-2xl font-semibold leading-tight">{user.name}</h2>
              <p className="text-sm text-stone2-500">{user.email}</p>
            </div>
            <div className="pb-1"><RoleBadge role={user.role} /></div>
          </div>
          {user.bio && <p className="mt-4 text-stone2-700">{user.bio}</p>}
          <p className="mt-3 text-xs text-stone2-500">
            {t("memberSince")} {new Date(user.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map(({ key, value, to, icon: Icon }) => (
              <Link key={key} to={to} className="focus-ring rounded-2xl border border-gold-600/20 bg-cream-100 p-4 transition hover:border-gold-600/50">
                <Icon className="h-5 w-5 text-gold-700" aria-hidden />
                <dd className="mt-2 font-display text-2xl font-semibold">{summary.isLoading ? "…" : value ?? 0}</dd>
                <dt className="text-xs font-medium text-stone2-700">{t(key)}</dt>
              </Link>
            ))}
          </dl>
          {summary.isLoading && <Spinner />}
          {summary.data && (summary.data.pendingUploads > 0) && (
            <p className="mt-4 rounded-xl bg-gold-500/15 p-3 text-sm text-gold-700">
              {summary.data.pendingUploads} {t("pending")} · <Link to="/app/my-uploads" className="font-semibold underline">{t("myUploads")}</Link>
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Link to="/app/courses" className="focus-ring flex items-center gap-3 rounded-2xl border border-gold-600/20 bg-cream-50 p-4 hover:border-gold-600/50">
          <BookOpen className="h-5 w-5 text-gold-700" aria-hidden />
          <span className="font-semibold">{t("coursesTitle")}</span>
        </Link>
        <Link to="/app/my-uploads" className="focus-ring flex items-center gap-3 rounded-2xl border border-gold-600/20 bg-cream-50 p-4 hover:border-gold-600/50">
          <FolderUp className="h-5 w-5 text-gold-700" aria-hidden />
          <span className="font-semibold">{t("myUploadsTitle")}</span>
        </Link>
      </div>
    </div>
  );
}
