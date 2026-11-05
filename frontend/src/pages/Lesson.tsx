import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  FileDown,
  Heart,
  ListChecks,
  PlayCircle,
  Share2,
  Target,
} from "lucide-react";
import type { Course, LessonResource, Video } from "../types";
import { api, apiError, mediaUrl } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useLang } from "../i18n";
import { VideoPlayer } from "../components/VideoPlayer";
import { VideoCard } from "../components/VideoCard";
import { CommentThread } from "../components/CommentThread";
import { Avatar, btnGold, btnPrimary, btnSecondary, DemoBadge, ErrorBox, Spinner, StatusPill } from "../components/UI";
import { displayTitle, formatLearningTime, percent, quizTypeKey } from "../lib/learning";

export function Lesson() {
  const { id = "" } = useParams();
  const { t, lang } = useLang();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(0);
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState("");
  const [completedOverride, setCompletedOverride] = useState<boolean | null>(null);
  const started = useRef<string | null>(null);

  const videoQuery = useQuery({
    queryKey: ["video", id],
    queryFn: async () => (await api.get<{ video: Video }>(`/videos/${id}`)).data.video,
  });
  const video = videoQuery.data;

  const courseQuery = useQuery({
    queryKey: ["course", video?.courseId],
    queryFn: async () => (await api.get<{ course: Course }>(`/courses/${video!.courseId}`)).data.course,
    enabled: Boolean(video?.courseId),
  });
  const course = courseQuery.data;

  const related = useQuery({
    queryKey: ["videos", "related", video?.categoryId],
    queryFn: async () => (await api.get<{ videos: Video[] }>("/videos", { params: { categoryId: video!.categoryId, limit: 5 } })).data.videos,
    enabled: Boolean(video?.categoryId),
  });

  const manager = Boolean(
    user && course && (user.role === "admin" || (user.role === "teacher" && user.id === course.teacherId)),
  );
  const enrolled = Boolean(course?.enrolled || manager);

  const refreshCourse = () => {
    queryClient.invalidateQueries({ queryKey: ["course", course?.id] });
    queryClient.invalidateQueries({ queryKey: ["courses"] });
    queryClient.invalidateQueries({ queryKey: ["learning"] });
  };

  const enroll = useMutation({
    mutationFn: () => api.post(`/courses/${course!.id}/enroll`),
    onSuccess: () => {
      setNotice(t("enrolledNow"));
      refreshCourse();
    },
    onError: (error) => setNotice(apiError(error)),
  });

  const start = useMutation({
    mutationFn: () => api.post(`/courses/${course!.id}/lessons/${id}/start`),
    onError: () => undefined,
  });

  const progress = useMutation({
    mutationFn: ({ positionSec, durationSec }: { positionSec: number; durationSec: number }) =>
      api.post(`/courses/${course!.id}/lessons/${id}/progress`, { positionSec, durationSec }),
    onSuccess: (response) => {
      const data = response.data as { lesson?: { completed?: boolean } };
      if (data.lesson?.completed && completedOverride !== true) {
        setCompletedOverride(true);
        refreshCourse();
      }
    },
    onError: () => undefined,
  });

  const complete = useMutation({
    mutationFn: (value: boolean) => api.post(`/courses/${course!.id}/lessons/${id}/complete`, { completed: value }),
    onSuccess: (response) => {
      const data = response.data as { completed?: boolean };
      setCompletedOverride(Boolean(data.completed));
      setNotice(data.completed ? t("lessonCompleted") : t("lessonMarkedIncomplete"));
      refreshCourse();
    },
    onError: (error) => setNotice(apiError(error)),
  });

  const like = useMutation({
    mutationFn: async () => (await api.post<{ liked: boolean; likes: number }>(`/videos/${id}/like`)).data,
    onSuccess: (data) => { setLiked(data.liked); setLikes(data.likes); },
    onError: (error) => setNotice(apiError(error)),
  });
  const save = useMutation({
    mutationFn: async () => (await api.post<{ saved: boolean }>(`/videos/${id}/save`)).data,
    onSuccess: (data) => setSaved(data.saved),
    onError: (error) => setNotice(apiError(error)),
  });

  useEffect(() => {
    if (!video) return;
    setLiked(video.liked);
    setLikes(video.likes);
    setSaved(video.saved);
    setCompletedOverride(null);
    setNotice("");
  }, [video]);

  useEffect(() => {
    if (!course?.enrolled || !video) return;
    if (started.current === video.id) return;
    started.current = video.id;
    start.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course?.enrolled, video?.id]);

  if (videoQuery.isLoading) return <div className="mx-auto max-w-5xl px-4"><Spinner /></div>;
  if (videoQuery.isError) return <div className="mx-auto max-w-2xl px-4 py-8"><ErrorBox message={apiError(videoQuery.error)} retry={() => videoQuery.refetch()} /></div>;
  if (!video) return null;

  const lesson = course?.lessons?.find((item) => item.id === video.id);
  const lessonIndex = course?.lessons?.findIndex((item) => item.id === video.id) ?? -1;
  const next = course?.lessons?.[lessonIndex + 1];
  const title = displayTitle(video, lang);
  const description = lang === "am" ? video.descriptionAm || video.description : video.description;
  const completed = completedOverride ?? Boolean(lesson?.completed);
  const isApproved = !video.status || video.status === "approved";
  const progressPct = percent(course?.progressPct);
  const resumeAt = completed ? 0 : Math.max(0, Number(lesson?.lastPositionSec) || 0);
  const lessonQuiz = lesson?.quiz ?? null;
  const resources: LessonResource[] = video.resources ?? [];
  const objectives = video.objectives ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Link to={course ? `/app/courses/${course.id}` : "/app/explore"} className="focus-ring inline-flex items-center gap-1 text-sm font-semibold text-gold-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {course ? t("backToCourses") : t("explore")}
      </Link>

      {video.status && video.status !== "approved" && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-gold-600/30 bg-gold-500/10 p-4">
          <StatusPill status={video.status} />
          {video.rejectionReason && <p className="text-sm text-rubric-600">{t("reviewNote")}: {video.rejectionReason}</p>}
          {!video.rejectionReason && <p className="text-sm text-stone2-700">{t("pendingNote")}</p>}
        </div>
      )}

      {course && !enrolled && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-gold-600/30 bg-gold-500/10 p-4">
          <p className="min-w-0 flex-1 text-sm font-medium text-stone2-700">{t("enrollToTrackLesson")}</p>
          <button type="button" onClick={() => enroll.mutate()} disabled={enroll.isPending} className={btnGold}>
            {enroll.isPending ? t("saving") : t("enroll")}
          </button>
        </div>
      )}

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <VideoPlayer
            video={video}
            resumeAt={resumeAt}
            onProgress={enrolled ? (positionSec, durationSec) => progress.mutate({ positionSec, durationSec }) : undefined}
            onEnded={enrolled && !completed ? () => complete.mutate(true) : undefined}
          />

          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
            {video.category && <span className="rounded-full bg-gold-500/25 px-2.5 py-1 font-semibold text-gold-700">{lang === "am" ? video.category.am : video.category.en}</span>}
            <span className="rounded-full bg-cream-200 px-2.5 py-1 font-medium">{video.language === "am" ? "አማርኛ" : "English"}</span>
            <span className="rounded-full bg-cream-200 px-2.5 py-1 font-medium">{formatLearningTime(video.durationSec, lang)}</span>
            <span className="rounded-full bg-cream-200 px-2.5 py-1 font-medium">{video.views} {t("viewsLabel")}</span>
            {video.demo && <DemoBadge label={t("demoClip")} />}
            {completed && <span className="rounded-full bg-emerald-600/15 px-2.5 py-1 font-semibold text-emerald-800">{t("completedBadge")}</span>}
          </div>
          <h1 className="mt-3 font-display text-3xl font-semibold leading-tight sm:text-4xl">{title}</h1>
          {description && <p className="mt-3 leading-relaxed text-stone2-700">{description}</p>}

          {objectives.length > 0 && (
            <section className="mt-6 rounded-2xl border border-gold-600/20 bg-cream-50 p-4">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Target className="h-5 w-5 text-gold-700" aria-hidden /> {t("lessonObjectives")}</h2>
              <ul className="mt-2 space-y-1.5 text-sm text-stone2-700">
                {objectives.map((item, index) => (
                  <li key={`${item}-${index}`} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden /><span>{item}</span></li>
                ))}
              </ul>
            </section>
          )}

          {(resources.length > 0 || video.downloadUrl) && (
            <section className="mt-4 rounded-2xl border border-gold-600/20 bg-cream-50 p-4">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><ListChecks className="h-5 w-5 text-gold-700" aria-hidden /> {t("lessonResources")}</h2>
              <ul className="mt-2 space-y-1.5 text-sm">
                {resources.map((resource, index) => (
                  <li key={`${resource.title}-${index}`}>
                    {resource.url ? (
                      <a href={resource.url} target="_blank" rel="noreferrer" className="focus-ring font-semibold text-gold-700 underline">
                        {resource.title || resource.url}
                      </a>
                    ) : (
                      <span className="text-stone2-700">{resource.title}</span>
                    )}
                  </li>
                ))}
                {video.downloadUrl && (
                  <li>
                    <a href={video.downloadUrl} target="_blank" rel="noreferrer" download className="focus-ring inline-flex items-center gap-1.5 rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-cream-50 hover:bg-navy-800">
                      <FileDown className="h-4 w-4" aria-hidden /> {video.downloadTitle || t("downloadMaterial")}
                    </a>
                  </li>
                )}
              </ul>
            </section>
          )}

          {lessonQuiz && (
            <section className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-gold-600/25 bg-gold-500/10 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-gold-700">{t(quizTypeKey(lessonQuiz.type))}</p>
                <p className="font-display text-lg font-semibold">{displayTitle(lessonQuiz, lang)}</p>
                <p className="text-xs text-stone2-700">
                  {lessonQuiz.questionCount} {t("questionsCount")} · {t("passingScoreLabel")} {lessonQuiz.passingScore}%
                  {lessonQuiz.passed ? ` · ${t("quizPassed")}` : ""}
                </p>
              </div>
              {enrolled ? (
                <Link to={`/app/quizzes/${lessonQuiz.id}`} className={lessonQuiz.passed ? btnSecondary : btnPrimary}>
                  {lessonQuiz.passed ? t("reviewQuiz") : t("takeQuiz")}
                </Link>
              ) : (
                <button type="button" onClick={() => enroll.mutate()} className={btnSecondary}>{t("enrollToTakeQuiz")}</button>
              )}
            </section>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {isApproved && (
              <>
                <button type="button" onClick={() => like.mutate()} aria-pressed={liked} className={liked ? btnGold : btnSecondary}>
                  <Heart className="h-4 w-4" fill={liked ? "currentColor" : "none"} aria-hidden /> {t("like")} · {likes}
                </button>
                <button type="button" onClick={() => save.mutate()} aria-pressed={saved} className={saved ? btnGold : btnSecondary}>
                  <Bookmark className="h-4 w-4" fill={saved ? "currentColor" : "none"} aria-hidden /> {saved ? t("savedLesson") : t("saveLesson")}
                </button>
              </>
            )}
            <button type="button" onClick={async () => {
              const data = { title, text: title, url: window.location.href };
              if (navigator.share) await navigator.share(data).catch(() => undefined);
              else await navigator.clipboard.writeText(window.location.href).then(() => setNotice(t("linkCopied"))).catch(() => setNotice(t("copyLink")));
            }} className={btnSecondary}>
              <Share2 className="h-4 w-4" aria-hidden /> {t("share")}
            </button>
          </div>
          {notice && <p role="status" className="mt-3 text-sm font-medium text-gold-700">{notice}</p>}
          {video.demo && <p className="mt-3 rounded-xl border border-gold-600/25 bg-cream-50 p-3 text-sm text-stone2-700">{t("demoPlayback")}</p>}
          {video.attribution && <p className="mt-4 text-xs text-stone2-500">{t("attributionLabel")}: {video.attribution}</p>}

          {isApproved && (
            <section className="mt-8">
              <h2 className="font-display text-2xl font-semibold">{t("commentSection")}</h2>
              <div className="mt-4"><CommentThread videoId={video.id} /></div>
            </section>
          )}
        </div>

        <aside className="space-y-5">
          <Link to={`/app/teachers/${video.teacher.id}`} className="focus-ring flex items-center gap-3 rounded-2xl border border-gold-600/20 bg-cream-50 p-4 hover:border-gold-600/50">
            <Avatar name={video.teacher.name} size={44} />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone2-500">{t("teacherLabel")}</p>
              <p className="truncate font-display text-lg font-semibold">{video.teacher.name}</p>
            </div>
          </Link>

          {course && (
            <div className="rounded-2xl border border-gold-600/20 bg-cream-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone2-500">{t("courseLabel")}</p>
              <Link to={`/app/courses/${course.id}`} className="focus-ring font-display text-lg font-semibold hover:text-gold-700">{displayTitle(course, lang)}</Link>
              <div className="mt-3 h-2 rounded-full bg-cream-200" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100} aria-label={t("courseProgress")}>
                <div className="h-full rounded-full bg-gold-500 transition-all" style={{ width: `${progressPct}%` }} />
              </div>
              <p className="mt-1 text-xs">{t("doneOf", { done: course.done, total: course.lessonCount })} · {progressPct}%</p>
              {enrolled ? (
                <button type="button" onClick={() => complete.mutate(!completed)} disabled={complete.isPending} className={`${completed ? btnSecondary : btnPrimary} mt-4 w-full`}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden /> {completed ? t("markIncomplete") : t("markComplete")}
                </button>
              ) : (
                <button type="button" onClick={() => enroll.mutate()} disabled={enroll.isPending} className={`${btnGold} mt-4 w-full`}>
                  {t("enroll")}
                </button>
              )}
              {next && <Link to={`/app/lessons/${next.id}`} className="focus-ring mt-3 flex items-center justify-center gap-1 text-sm font-semibold text-gold-700 underline"><PlayCircle className="h-4 w-4" aria-hidden /> {t("nextLesson")}</Link>}
            </div>
          )}

          {!course && video.courseId === null && <p className="rounded-2xl border border-dashed border-navy-900/20 p-4 text-sm text-stone2-700">{t("notInCourse")}</p>}

          {user && user.id === video.uploadedBy && video.status !== "approved" && (
            <Link to="/app/my-uploads" className={`${btnSecondary} w-full`}>{t("myUploads")}</Link>
          )}
        </aside>
      </div>

      {related.data && related.data.filter((item) => item.id !== video.id).length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold">{t("relatedLessons")}</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {related.data.filter((item) => item.id !== video.id).slice(0, 4).map((item) => <VideoCard key={item.id} video={item} />)}
          </div>
        </section>
      )}
      <p className="sr-only">{mediaUrl(video.videoUrl)}</p>
    </div>
  );
}
