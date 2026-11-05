import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";
import type { Video } from "../types";
import { api, apiError } from "../api/client";
import { useLang } from "../i18n";
import { VideoCard } from "../components/VideoCard";
import { btnPrimary, EmptyState, ErrorBox, PageHeader, Spinner } from "../components/UI";

export function Saved() {
  const { t } = useLang();
  const query = useQuery({
    queryKey: ["saved"],
    queryFn: async () => (await api.get<{ videos: Video[] }>("/videos/me/saved")).data.videos,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader title={t("saved")} subtitle={t("savedCount")} />

      {query.isLoading && <Spinner />}
      {query.isError && <ErrorBox message={apiError(query.error)} retry={() => query.refetch()} />}

      {query.data && query.data.length === 0 && (
        <div className="mt-6">
          <EmptyState
            title={t("saved")}
            body={t("noVideos")}
            icon={<Bookmark className="h-7 w-7" aria-hidden />}
            action={<Link to="/app/explore" className={btnPrimary}>{t("exploreTitle")}</Link>}
          />
        </div>
      )}

      {query.data && query.data.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {query.data.map((video) => <VideoCard key={video.id} video={video} />)}
        </div>
      )}
    </div>
  );
}
