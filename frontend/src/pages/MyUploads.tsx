import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderUp, Trash2 } from "lucide-react";
import type { Video } from "../types";
import { api, apiError } from "../api/client";
import { useLang } from "../i18n";
import { Cover } from "../components/Art";
import { btnPrimary, btnSecondary, DemoBadge, EmptyState, ErrorBox, PageHeader, Spinner, StatusPill } from "../components/UI";
import { formatDuration } from "../data/mock";

export function MyUploads() {
  const { t } = useLang();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["my-uploads"],
    queryFn: async () => (await api.get<{ videos: Video[] }>("/videos/me/videos")).data.videos,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/videos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-uploads"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const onDelete = (video: Video) => {
    if (!window.confirm(`${t("deleteUploadConfirm")}\n\n${video.title}`)) return;
    remove.mutate(video.id);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <PageHeader
        title={t("myUploadsTitle")}
        subtitle={t("myUploadsSub")}
        actions={<Link to="/app/upload" className={btnPrimary}>{t("uploadAnother")}</Link>}
      />

      <p className="mt-4 rounded-xl border border-gold-600/25 bg-cream-50 p-3 text-sm text-stone2-700">{t("pendingNote")}</p>

      {query.isLoading && <Spinner />}
      {query.isError && <ErrorBox message={apiError(query.error)} retry={() => query.refetch()} />}
      {remove.isError && <ErrorBox message={apiError(remove.error)} />}
      {remove.isSuccess && <p role="status" className="mt-4 rounded-xl bg-emerald-600/10 p-3 text-sm font-medium text-emerald-800">{t("uploadDeleted")}</p>}

      {query.data && query.data.length === 0 && (
        <div className="mt-6">
          <EmptyState
            title={t("noUploads")}
            icon={<FolderUp className="h-7 w-7" aria-hidden />}
            action={<Link to="/app/upload" className={btnPrimary}>{t("uploadTitle")}</Link>}
          />
        </div>
      )}

      {query.data && query.data.length > 0 && (
        <ul className="mt-6 space-y-3">
          {query.data.map((video) => (
            <li key={video.id} className="flex flex-col gap-4 rounded-2xl border border-gold-600/20 bg-cream-50 p-4 shadow-sm sm:flex-row">
              <div className="h-28 w-20 shrink-0 overflow-hidden rounded-xl bg-navy-900">
                <Cover variant={video.cover} className="h-full w-full" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {video.status && <StatusPill status={video.status} />}
                  <span className="rounded-full bg-cream-200 px-2.5 py-1 font-medium">{formatDuration(video.durationSec)}</span>
                  <span className="rounded-full bg-cream-200 px-2.5 py-1 font-medium">{video.language === "am" ? "አማርኛ" : "English"}</span>
                  {video.demo && <DemoBadge />}
                </div>
                <h2 className="mt-2 font-display text-xl font-semibold leading-snug">{video.title}</h2>
                {video.description && <p className="mt-1 line-clamp-2 text-sm text-stone2-700">{video.description}</p>}
                {video.status === "rejected" && video.rejectionReason && (
                  <p className="mt-2 rounded-xl border border-rubric-500/25 bg-rubric-500/10 p-3 text-sm text-rubric-600">
                    <strong>{t("rejectionReason")}:</strong> {video.rejectionReason}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to={`/app/lessons/${video.id}`} className={btnSecondary}>{t("previewVideo")}</Link>
                  <button type="button" onClick={() => onDelete(video)} disabled={remove.isPending} className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-full border border-rubric-500/40 px-5 py-2.5 text-sm font-semibold text-rubric-600 hover:bg-rubric-500/10">
                    <Trash2 className="h-4 w-4" aria-hidden /> {t("deleteUpload")}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
