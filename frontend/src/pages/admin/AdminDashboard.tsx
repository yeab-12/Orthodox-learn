import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, MessageSquare, PlayCircle, ShieldCheck, Users, XCircle } from "lucide-react";
import type { AdminStats, ContactMessage, Video } from "../../types";
import { api, apiError } from "../../api/client";
import { useLang } from "../../i18n";
import { Modal } from "../../components/Modal";
import { Cover } from "../../components/Art";
import { btnPrimary, btnSecondary, ErrorBox, PageHeader, Spinner, StatusPill } from "../../components/UI";
import { formatDuration } from "../../data/mock";

export function AdminDashboard() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState<Video | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");

  const stats = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => (await api.get<AdminStats>("/admin/stats")).data,
  });
  const pending = useQuery({
    queryKey: ["admin", "videos", "pending"],
    queryFn: async () => (await api.get<{ videos: Video[] }>("/admin/videos", { params: { status: "pending" } })).data.videos,
  });
  const messages = useQuery({
    queryKey: ["admin", "messages"],
    queryFn: async () => (await api.get<{ messages: ContactMessage[] }>("/admin/messages")).data.messages,
  });

  const review = useMutation({
    mutationFn: ({ id, status, rejectionReason }: { id: string; status: "approved" | "rejected"; rejectionReason?: string }) =>
      api.patch(`/admin/videos/${id}`, { status, rejectionReason }),
    onSuccess: (_data, variables) => {
      setNotice(variables.status === "approved" ? t("videoApproved") : t("videoRejected"));
      setRejecting(null);
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
    },
  });
  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/messages/${id}`),
    onSuccess: () => {
      setNotice(t("messageRead"));
      queryClient.invalidateQueries({ queryKey: ["admin", "messages"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });

  const cards = stats.data ? [
    { key: "totalUsers", value: stats.data.users, icon: Users, to: "/app/admin/users" },
    { key: "totalVideos", value: stats.data.videos, icon: PlayCircle, to: "/app/admin/videos" },
    { key: "pendingCount", value: stats.data.pending, icon: ShieldCheck, to: "/app/admin/videos" },
    { key: "approvedCount", value: stats.data.approved, icon: CheckCircle2, to: "/app/admin/videos" },
    { key: "rejectedCount", value: stats.data.rejected, icon: XCircle, to: "/app/admin/videos" },
    { key: "coursesCountAdmin", value: stats.data.courses, icon: BookOpen, to: "/app/admin/courses" },
    { key: "commentsCount", value: stats.data.comments, icon: MessageSquare, to: "/app/admin" },
    { key: "messagesTitle", value: stats.data.messages, icon: MessageSquare, to: "/app/admin" },
  ] as const : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader title={t("adminTitle")} subtitle={t("adminSub")} />

      <div className="mt-5 flex flex-wrap gap-2">
        <Link to="/app/admin/videos" className={btnSecondary}>{t("manageVideos")}</Link>
        <Link to="/app/admin/users" className={btnSecondary}>{t("manageUsers")}</Link>
        <Link to="/app/admin/courses" className={btnSecondary}>{t("manageCourses")}</Link>
      </div>

      {notice && <p role="status" className="mt-4 rounded-xl border border-emerald-600/25 bg-emerald-600/10 p-3 text-sm font-medium text-emerald-800">{notice}</p>}
      {stats.isLoading && <Spinner />}
      {stats.isError && <ErrorBox message={apiError(stats.error)} retry={() => stats.refetch()} />}
      {review.isError && <ErrorBox message={apiError(review.error)} />}
      {markRead.isError && <ErrorBox message={apiError(markRead.error)} />}

      {stats.data && (
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cards.map(({ key, value, icon: Icon, to }) => (
            <Link key={key} to={to} className="focus-ring rounded-2xl border border-gold-600/20 bg-cream-50 p-4 shadow-sm transition hover:border-gold-600/50">
              <Icon className="h-5 w-5 text-gold-700" aria-hidden />
              <dd className="mt-2 font-display text-3xl font-semibold">{value}</dd>
              <dt className="text-xs font-medium text-stone2-700">{t(key)}</dt>
            </Link>
          ))}
        </dl>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <section>
          <h2 className="font-display text-2xl font-semibold">{t("pendingTitle")}</h2>
          {pending.isLoading && <Spinner />}
          {pending.isError && <ErrorBox message={apiError(pending.error)} retry={() => pending.refetch()} />}
          {pending.data && pending.data.length === 0 && (
            <p className="mt-4 rounded-2xl border border-dashed border-navy-900/20 bg-cream-50 p-6 text-sm text-stone2-700">{t("noPending")}</p>
          )}
          {pending.data && pending.data.length > 0 && (
            <ul className="mt-4 space-y-3">
              {pending.data.map((video) => (
                <li key={video.id} className="flex flex-col gap-4 rounded-2xl border border-gold-600/20 bg-cream-50 p-4 sm:flex-row">
                  <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-navy-900">
                    <Cover variant={video.cover} className="h-full w-full" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <StatusPill status={video.status ?? "pending"} />
                      <span className="rounded-full bg-cream-200 px-2 py-0.5 font-medium">{formatDuration(video.durationSec)}</span>
                      <span className="text-stone2-500">{video.teacher.name}</span>
                    </div>
                    <h3 className="mt-1 font-display text-lg font-semibold leading-snug">{video.title}</h3>
                    {video.attribution && <p className="text-xs text-stone2-500">{t("attributionLabel")}: {video.attribution}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link to={`/app/lessons/${video.id}`} className={btnSecondary}>{t("previewVideo")}</Link>
                      <button type="button" onClick={() => { if (window.confirm(t("confirmApprove"))) review.mutate({ id: video.id, status: "approved" }); }} disabled={review.isPending} className={btnPrimary}>
                        <CheckCircle2 className="h-4 w-4" aria-hidden /> {t("approve")}
                      </button>
                      <button type="button" onClick={() => { setRejecting(video); setReason(""); }} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-rubric-500/40 px-5 py-2.5 text-sm font-semibold text-rubric-600 hover:bg-rubric-500/10">
                        <XCircle className="h-4 w-4" aria-hidden /> {t("reject")}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="font-display text-2xl font-semibold">{t("messagesTitle")}</h2>
          {messages.isLoading && <Spinner />}
          {messages.isError && <ErrorBox message={apiError(messages.error)} retry={() => messages.refetch()} />}
          {messages.data && messages.data.length === 0 && (
            <p className="mt-4 rounded-2xl border border-dashed border-navy-900/20 bg-cream-50 p-6 text-sm text-stone2-700">{t("noMessages")}</p>
          )}
          {messages.data && messages.data.length > 0 && (
            <ul className="mt-4 space-y-3">
              {messages.data.map((message) => (
                <li key={message.id} className={`rounded-2xl border p-4 ${message.read ? "border-gold-600/15 bg-cream-50" : "border-gold-600/40 bg-gold-500/10"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{message.name}</p>
                    <p className="text-xs text-stone2-500">{new Date(message.createdAt).toLocaleDateString()}</p>
                  </div>
                  <a href={`mailto:${message.email}`} className="text-xs text-gold-700 underline">{message.email}</a>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-stone2-700">{message.message}</p>
                  {!message.read && (
                    <button type="button" onClick={() => markRead.mutate(message.id)} className="focus-ring mt-2 text-xs font-semibold text-gold-700 underline">{t("markRead")}</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Modal open={Boolean(rejecting)} onClose={() => setRejecting(null)} title={t("confirmReject")}>
        {rejecting && (
          <div className="space-y-4">
            <p className="text-sm font-medium">{rejecting.title}</p>
            <label className="block text-sm font-semibold">
              {t("reviewNote")}
              <textarea value={reason} onChange={(event) => setReason(event.target.value.slice(0, 500))} rows={4} placeholder={t("rejectionPlaceholder")}
                className="focus-ring mt-1 w-full rounded-xl border border-navy-900/25 bg-white px-4 py-3" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRejecting(null)} className={btnSecondary}>{t("cancel")}</button>
              <button type="button" onClick={() => review.mutate({ id: rejecting.id, status: "rejected", rejectionReason: reason.trim() })} disabled={review.isPending}
                className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full bg-rubric-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rubric-600">
                <XCircle className="h-4 w-4" aria-hidden /> {t("reject")}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
