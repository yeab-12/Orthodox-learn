import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import type { Video } from "../types";
import { formatDuration } from "../data/mock";
import { useLang } from "../i18n";
import { Cover } from "./Art";
import { DemoBadge } from "./UI";

export function VideoCard({ video, showStatus = false }: { video: Video; showStatus?: boolean }) {
  const { lang, t } = useLang();
  const title = lang === "am" ? video.titleAm : video.title;
  return (
    <Link to={`/app/lessons/${video.id}`} className="focus-ring group block rounded-2xl">
      <article>
        <div className="relative aspect-[9/14] overflow-hidden rounded-2xl bg-navy-900">
          <Cover variant={video.cover} className="h-full w-full transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-x-0 top-0 flex justify-between gap-2 p-2">
            {video.demo && <DemoBadge label={t("demoClip")} />}
            {showStatus && video.status && (
              <span className="rounded-full bg-navy-950/75 px-2 py-1 text-xs font-semibold capitalize text-cream-50">{video.status}</span>
            )}
          </div>
          <span className="absolute bottom-2 right-2 rounded bg-navy-950/80 px-1.5 py-0.5 text-xs font-medium text-cream-50">{formatDuration(video.durationSec)}</span>
          <span className="absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-gold-500 text-navy-950"><Play className="h-5 w-5 translate-x-0.5" fill="currentColor" aria-hidden /></span>
          </span>
          {video.mediaType === "audio" && <span className="absolute left-2 bottom-2 rounded bg-navy-950/80 px-1.5 py-0.5 text-[11px] font-medium text-cream-50">Audio</span>}
        </div>
        <h3 className="mt-2.5 font-display text-base font-semibold leading-snug">{title}</h3>
        <p className="text-sm text-stone2-500">{video.teacher.name} · {video.category ? (lang === "am" ? video.category.am : video.category.en) : ""}</p>
      </article>
    </Link>
  );
}
