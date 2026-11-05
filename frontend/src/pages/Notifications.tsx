import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import type { NotificationItem } from "../types";
import { api, apiError } from "../api/client";
import { useLang } from "../i18n";
import { btnSecondary, EmptyState, ErrorBox, PageHeader, Spinner } from "../components/UI";

export function Notifications() {
  const { t, lang } = useLang();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get<{ notifications: NotificationItem[]; unread: number }>("/notifications")).data,
  });

  const read = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
    },
  });
  const readAll = useMutation({
    mutationFn: () => api.post("/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
    },
  });

  const formatDate = (value: string) => {
    try {
      return new Intl.DateTimeFormat(lang === "am" ? "am-ET" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
    } catch {
      return new Date(value).toLocaleString();
    }
  };

  const unread = query.data?.unread ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <PageHeader
        title={t("notificationsTitle")}
        subtitle={t("notificationsSub")}
        actions={unread > 0 ? (
          <button type="button" onClick={() => readAll.mutate()} disabled={readAll.isPending} className={btnSecondary}>
            <CheckCheck className="h-4 w-4" aria-hidden /> {t("markAllRead")}
          </button>
        ) : undefined}
      />

      {query.isLoading && <Spinner />}
      {query.isError && <ErrorBox message={apiError(query.error)} retry={() => query.refetch()} />}
      {read.isError && <ErrorBox message={apiError(read.error)} />}
      {readAll.isSuccess && <p role="status" className="mt-4 rounded-xl bg-emerald-600/10 p-3 text-sm font-medium text-emerald-800">{t("allRead")}</p>}

      {query.data && query.data.notifications.length === 0 && (
        <div className="mt-6">
          <EmptyState title={t("noNotifications")} icon={<Bell className="h-7 w-7" aria-hidden />} />
        </div>
      )}

      {query.data && query.data.notifications.length > 0 && (
        <ul className="mt-6 space-y-2">
          {query.data.notifications.map((item) => {
            const text = lang === "am" ? item.textAm || item.text : item.text;
            return (
              <li key={item.id}>
                <Link
                  to={item.href || "/app"}
                  onClick={() => { if (!item.read) read.mutate(item.id); }}
                  className={`focus-ring flex items-start gap-3 rounded-2xl border p-4 transition ${item.read ? "border-gold-600/15 bg-cream-50" : "border-gold-600/40 bg-gold-500/10 hover:bg-gold-500/15"}`}
                >
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.read ? "bg-stone2-500/30" : "bg-rubric-500"}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-relaxed">{text}</span>
                    <span className="mt-1 block text-xs text-stone2-500">{formatDate(item.createdAt)}{!item.read ? ` · ${t("unread")}` : ""}</span>
                  </span>
                  <span className="text-xs font-semibold text-gold-700">{t("view")}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
