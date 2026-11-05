import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import type { AdminUser, Role } from "../../types";
import { api, apiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { useLang } from "../../i18n";
import { Avatar, btnSecondary, ErrorBox, PageHeader, RoleBadge, Spinner } from "../../components/UI";

export function AdminUsers() {
  const { t } = useLang();
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");

  const users = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => (await api.get<{ users: AdminUser[] }>("/admin/users")).data.users,
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string; role?: Role; active?: boolean }) => api.patch(`/admin/users/${id}`, body),
    onSuccess: () => {
      setNotice(t("userUpdated"));
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });

  const needle = query.trim().toLowerCase();
  const list = (users.data ?? []).filter((entry) => !needle || [entry.name, entry.email].some((value) => value.toLowerCase().includes(needle)));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader title={t("usersTitle")} subtitle={t("usersSub")} actions={<Link to="/app/admin" className={btnSecondary}>{t("overviewTitle")}</Link>} />

      <label className="relative mt-5 block">
        <span className="sr-only">{t("searchUsers")}</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone2-500" aria-hidden />
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchUsers")}
          className="focus-ring w-full rounded-full border border-navy-900/20 bg-cream-50 py-3 pl-12 pr-4" />
      </label>

      {notice && <p role="status" className="mt-4 rounded-xl border border-emerald-600/25 bg-emerald-600/10 p-3 text-sm font-medium text-emerald-800">{notice}</p>}
      {users.isLoading && <Spinner />}
      {users.isError && <ErrorBox message={apiError(users.error)} retry={() => users.refetch()} />}
      {update.isError && <ErrorBox message={apiError(update.error)} />}
      {users.data && list.length === 0 && <p className="mt-6 rounded-2xl border border-dashed border-navy-900/20 bg-cream-50 p-8 text-center text-stone2-700">{t("noUsers")}</p>}

      {list.length > 0 && (
        <ul className="mt-5 space-y-2">
          {list.map((entry) => {
            const self = entry.id === me?.id;
            return (
              <li key={entry.id} className="flex flex-col gap-3 rounded-2xl border border-gold-600/20 bg-cream-50 p-4 shadow-sm sm:flex-row sm:items-center">
                <Avatar name={entry.name} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold">{entry.name}</p>
                    <RoleBadge role={entry.role} />
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${entry.active ? "bg-emerald-600/15 text-emerald-800" : "bg-rubric-500/15 text-rubric-600"}`}>
                      {entry.active ? t("activeLabel") : t("inactiveLabel")}
                    </span>
                  </div>
                  <p className="truncate text-sm text-stone2-500">{entry.email}</p>
                  <p className="mt-0.5 text-xs text-stone2-500">
                    {t("uploadsLabel")}: {entry.uploads} · {t("commentsCount")}: {entry.comments} · {t("joined")}: {new Date(entry.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs font-semibold">
                    {t("roleLabel")}
                    <select value={entry.role} disabled={self || update.isPending}
                      onChange={(event) => update.mutate({ id: entry.id, role: event.target.value as Role })}
                      className="focus-ring mt-0.5 block rounded-xl border border-navy-900/25 bg-white px-3 py-2 text-sm">
                      <option value="student">{t("studentLabel")}</option>
                      <option value="teacher">{t("teacherLabel")}</option>
                      <option value="admin">{t("adminLabel")}</option>
                    </select>
                  </label>
                  <button type="button" disabled={self || update.isPending}
                    onClick={() => update.mutate({ id: entry.id, active: !entry.active })}
                    className="focus-ring mt-4 rounded-full border border-navy-900/25 px-4 py-2 text-sm font-semibold hover:bg-cream-200 disabled:cursor-not-allowed disabled:opacity-50">
                    {entry.active ? t("disable") : t("enable")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
