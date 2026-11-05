import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen } from "lucide-react";
import type { Course, Video } from "../types";
import { api, apiError } from "../api/client";
import { FeedItem } from "../components/FeedItem";
import { Cover } from "../components/Art";
import { Modal } from "../components/Modal";
import { CommentThread } from "../components/CommentThread";
import { useLang } from "../i18n";
import { EmptyState, ErrorBox, Spinner } from "../components/UI";

export function Feed() {
  const { t, lang } = useLang();
  const root = useRef<HTMLDivElement>(null);
  const items = useRef<Record<string, HTMLDivElement | null>>({});
  const [params] = useSearchParams();
  const target = params.get("video");
  const [active, setActive] = useState("");
  const [commentsFor, setCommentsFor] = useState<Video | null>(null);

  const videos = useQuery({
    queryKey: ["videos", "feed"],
    queryFn: async () => (await api.get<{ videos: Video[] }>("/videos")).data.videos,
  });
  const courses = useQuery({
    queryKey: ["courses"],
    queryFn: async () => (await api.get<{ courses: Course[] }>("/courses")).data.courses,
  });

  useEffect(() => {
    if (!videos.data?.length) return;
    setActive((current) => (current && videos.data!.some((v) => v.id === current) ? current : videos.data![0].id));
  }, [videos.data]);

  useEffect(() => {
    const element = root.current;
    if (!element || !videos.data?.length) return;
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && setActive((entry.target as HTMLElement).dataset.id || "")),
      { root: element, threshold: 0.65 },
    );
    element.querySelectorAll("[data-id]").forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [videos.data]);

  useEffect(() => {
    if (!target) return;
    const element = items.current[target];
    if (!element) return;
    element.scrollIntoView({ block: "start" });
    setActive(target);
  }, [target, videos.data]);

  if (videos.isLoading) {
    return <div className="grid min-h-[60dvh] place-items-center bg-navy-950 text-cream-50"><Spinner label={t("loading")} /></div>;
  }
  if (videos.isError) {
    return <div className="mx-auto max-w-xl px-4 py-10"><ErrorBox message={apiError(videos.error)} retry={() => videos.refetch()} /></div>;
  }

  const list = videos.data ?? [];
  const enrolled = (courses.data ?? []).filter((course) => course.enrolled && course.done < course.lessonCount).slice(0, 2);
  const upNext = list.filter((video) => video.id !== active).slice(0, 3);

  return (
    <div className="bg-navy-950 text-cream-50">
      <h1 className="sr-only">{t("feedTitle")}</h1>
      {list.length === 0 ? (
        <div className="mx-auto max-w-2xl px-4 py-12 text-navy-900">
          <EmptyState title={t("noVideos")} action={<Link to="/app/upload" className="focus-ring rounded-full bg-navy-900 px-5 py-2.5 font-semibold text-cream-50">{t("upload")}</Link>} />
        </div>
      ) : (
        <div className="mx-auto flex justify-center xl:grid xl:grid-cols-[minmax(0,460px)_330px] xl:gap-8 xl:px-6">
          <div ref={root} className="no-scrollbar h-[var(--feed-h)] w-full max-w-[460px] snap-y snap-mandatory overflow-y-scroll xl:h-screen">
            {list.map((video) => (
              <div key={video.id} data-id={video.id} ref={(element) => { items.current[video.id] = element; }}>
                <FeedItem video={video} active={active === video.id} onComments={() => setCommentsFor(video)} />
              </div>
            ))}
          </div>

          <aside className="hidden h-screen overflow-y-auto py-6 xl:block" aria-label={t("feedTitle")}>
            <div className="rounded-2xl border border-gold-500/20 bg-navy-900/80 p-5">
              <h2 className="font-display text-xl font-semibold">{t("upNext")}</h2>
              <ul className="mt-4 space-y-4">
                {upNext.map((video) => (
                  <li key={video.id}>
                    <Link to={`/app?video=${video.id}`} className="focus-ring group flex gap-3 rounded-xl">
                      <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-navy-800">
                        <Cover variant={video.cover} className="h-full w-full" />
                      </div>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold group-hover:text-gold-300">{lang === "am" ? video.titleAm : video.title}</p>
                        <p className="mt-1 text-xs text-cream-300/70">{video.teacher.name}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link to="/app/explore" className="focus-ring mt-4 inline-flex items-center gap-1 text-sm font-semibold text-gold-300 hover:underline">
                {t("seeAll")} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>

            <div className="mt-6 rounded-2xl border border-gold-500/20 bg-navy-900/80 p-5">
              <h2 className="font-display text-xl font-semibold">{t("continueLearning")}</h2>
              {enrolled.length === 0 ? (
                <p className="mt-3 text-sm text-cream-300/75">{t("noContinue")}</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {enrolled.map((course) => (
                    <li key={course.id}>
                      <Link to={`/app/courses/${course.id}`} className="focus-ring block rounded-xl bg-navy-800/70 p-3 hover:bg-navy-800">
                        <p className="line-clamp-1 text-sm font-semibold">{lang === "am" ? course.titleAm : course.title}</p>
                        <p className="mt-1 text-xs text-cream-300/70">{t("doneOf", { done: course.done, total: course.lessonCount })}</p>
                        <div className="mt-2 h-1.5 rounded-full bg-navy-950">
                          <div className="h-full rounded-full bg-gold-400" style={{ width: `${course.lessonCount ? (course.done / course.lessonCount) * 100 : 0}%` }} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/app/courses" className="focus-ring mt-4 inline-flex items-center gap-1 text-sm font-semibold text-gold-300 hover:underline">
                <BookOpen className="h-4 w-4" aria-hidden /> {t("courses")}
              </Link>
            </div>

            <p className="mt-6 rounded-2xl border border-gold-500/15 p-4 text-xs leading-relaxed text-cream-300/70">
              {t("footerNote")}
            </p>
          </aside>
        </div>
      )}

      <Modal open={Boolean(commentsFor)} onClose={() => setCommentsFor(null)} title={commentsFor ? (lang === "am" ? commentsFor.titleAm : commentsFor.title) : t("commentTitle")}>
        {commentsFor && <CommentThread videoId={commentsFor.id} />}
      </Modal>
    </div>
  );
}
