import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Flame,
  GraduationCap,
  ListVideo,
  PlayCircle,
  TrendingUp,
} from "lucide-react";
import type { MyLearningDashboard } from "../types";
import { api, apiError } from "../api/client";
import { useLang } from "../i18n";
import { Cover } from "../components/Art";
import { CourseCard } from "../components/CourseCard";
import { btnGold, btnPrimary, btnSecondary, EmptyState, ErrorBox, PageHeader, Spinner } from "../components/UI";
import { displayTitle, formatDate, percent } from "../lib/learning";

const filters = [
  { value: "all", key: "filterAll" },
  { value: "in_progress", key: "filterInProgress" },
  { value: "completed", key: "filterCompleted" },
  { value: "not_started", key: "filterNotStarted" },
] as const;

function StatCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-gold-600/20 bg-cream-50 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-gold-700">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-gold-500/20">{icon}</span>
        <p className="text-xs font-semibold uppercase tracking-wide text-stone2-500">{label}</p>
      </div>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-stone2-500">{hint}</p>}
    </div>
  );
}

export function MyLearning() {
  const { t, lang } = useLang();
  const [filter, setFilter] = useState("all");

  const query = useQuery({
    queryKey: ["learning", "dashboard", filter],
    queryFn: async () =>
      (await api.get<MyLearningDashboard>("/learning/dashboard", { params: { filter } })).data,
  });

  const data = query.data;
  const stats = data?.stats;
  const continueLearning = data?.continueLearning ?? [];
  const courses = data?.courses ?? [];
  const activity = data?.recentActivity ?? [];
  const certificates = data?.certificates ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader
        title={t("myLearning")}
        subtitle={t("myLearningSub")}
        actions={<Link to="/app/courses" className={btnSecondary}><BookOpen className="h-4 w-4" aria-hidden /> {t("viewAllCourses")}</Link>}
      />

      {query.isLoading && <Spinner />}
      {query.isError && <ErrorBox message={apiError(query.error)} retry={() => query.refetch()} />}

      {data && stats && (
        <>
          <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" aria-label={t("overviewTitle")}>
            <StatCard icon={<BookOpen className="h-4 w-4" aria-hidden />} label={t("enrolledCourses")} value={stats.enrolledCourses} />
            <StatCard icon={<TrendingUp className="h-4 w-4" aria-hidden />} label={t("inProgress")} value={stats.inProgress} />
            <StatCard icon={<CheckCircle2 className="h-4 w-4" aria-hidden />} label={t("completedCourses")} value={stats.completedCourses} />
            <StatCard icon={<ListVideo className="h-4 w-4" aria-hidden />} label={t("lessonsCompletedLabel")} value={stats.lessonsCompleted} />
            <StatCard icon={<GraduationCap className="h-4 w-4" aria-hidden />} label={t("quizAverage")} value={`${stats.quizAverage}%`} hint={`${stats.quizAttempts} ${t("quizAttemptsLabel")}`} />
            <StatCard icon={<Award className="h-4 w-4" aria-hidden />} label={t("certificatesLabel")} value={stats.certificates} />
          </section>

          {stats.streak > 0 && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-gold-600/25 bg-gold-500/15 px-3 py-1.5 text-sm font-semibold text-gold-700">
              <Flame className="h-4 w-4" aria-hidden /> {t("learningStreak")}: {stats.streak} {t("daysLabel")}
            </p>
          )}

          {continueLearning.length > 0 && (
            <section className="mt-8">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 className="font-display text-2xl font-semibold">{t("continueLearning")}</h2>
                <span className="text-sm text-stone2-500">{courses.length} {t("coursesFound")}</span>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {continueLearning.map((course) => {
                  const pct = percent(course.progressPct);
                  const resumeId = course.resumeLessonId || course.lastLessonId;
                  const href = resumeId ? `/app/lessons/${resumeId}` : `/app/courses/${course.id}`;
                  return (
                    <article key={course.id} className="flex overflow-hidden rounded-2xl border border-gold-600/20 bg-cream-50 shadow-sm">
                      <div className="w-24 shrink-0 sm:w-28">
                        <Cover variant={course.cover} className="h-full w-full" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gold-700">{t("continueLearning")}</p>
                        <Link to={`/app/courses/${course.id}`} className="focus-ring mt-0.5 line-clamp-2 font-display text-lg font-semibold leading-snug hover:text-gold-700">
                          {displayTitle(course, lang)}
                        </Link>
                        <p className="mt-0.5 text-xs text-stone2-500">{course.teacher?.name}</p>
                        <div className="mt-2 h-2 rounded-full bg-cream-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t("courseProgress")}>
                          <div className="h-full rounded-full bg-gold-500" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-1 text-xs">{t("doneOf", { done: course.done, total: course.lessonCount })} · {pct}%</p>
                        <Link to={href} className={`${btnPrimary} mt-3 self-start !min-h-9 !px-4 !py-1.5 !text-xs`}>
                          <PlayCircle className="h-4 w-4" aria-hidden /> {t("resumeLesson")}
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          <section className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-semibold">{t("enrolledCourses")}</h2>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("filterAll")}>
                {filters.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setFilter(item.value)}
                    aria-pressed={filter === item.value}
                    className={`focus-ring min-h-9 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                      filter === item.value ? "bg-navy-900 text-cream-50" : "border border-navy-900/20 bg-cream-50 text-navy-900 hover:bg-cream-200"
                    }`}
                  >
                    {t(item.key)}
                  </button>
                ))}
              </div>
            </div>

            {courses.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  icon={<GraduationCap className="h-7 w-7" aria-hidden />}
                  title={t("noLearningCourses")}
                  body={t("noLearningBody")}
                  action={<Link to="/app/courses" className={btnGold}>{t("viewAllCourses")}</Link>}
                />
              </div>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {courses.map((course) => <CourseCard key={course.id} course={course} />)}
              </div>
            )}
          </section>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
            <section>
              <h2 className="font-display text-2xl font-semibold">{t("recentActivity")}</h2>
              {activity.length === 0 ? (
                <p className="mt-3 rounded-2xl border border-dashed border-navy-900/20 bg-cream-50 p-6 text-sm text-stone2-700">{t("noActivity")}</p>
              ) : (
                <ol className="mt-3 space-y-2">
                  {activity.map((item, index) => {
                    const isQuiz = item.type === "quiz_submitted";
                    const isComplete = item.type === "lesson_completed";
                    const title = isQuiz
                      ? lang === "am" ? item.quizTitleAm || item.quizTitle : item.quizTitle
                      : lang === "am" ? item.lessonTitleAm || item.lessonTitle : item.lessonTitle;
                    const verb = isQuiz ? t("activityQuizSubmitted") : isComplete ? t("activityLessonCompleted") : t("activityLessonProgress");
                    const href = isQuiz && item.quizId
                      ? `/app/quizzes/${item.quizId}`
                      : item.lessonId
                        ? `/app/lessons/${item.lessonId}`
                        : `/app/courses/${item.courseId}`;
                    return (
                      <li key={`${item.type}-${item.at}-${index}`}>
                        <Link to={href} className="focus-ring flex items-start gap-3 rounded-xl border border-gold-600/15 bg-cream-50 p-3 transition hover:border-gold-600/40">
                          <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${isQuiz ? "bg-gold-500/25 text-gold-700" : isComplete ? "bg-emerald-600/15 text-emerald-800" : "bg-cream-200 text-navy-900"}`}>
                            {isQuiz ? <GraduationCap className="h-4 w-4" aria-hidden /> : isComplete ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <Clock className="h-4 w-4" aria-hidden />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">
                              {verb} <span className="font-semibold">{title || item.courseTitle}</span>
                            </span>
                            <span className="mt-0.5 block text-xs text-stone2-500">
                              {displayTitle({ title: item.courseTitle, titleAm: item.courseTitleAm }, lang)} · {formatDate(item.at, lang)}
                              {isQuiz && item.percentage !== undefined ? ` · ${item.percentage}%` : ""}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            <section>
              <h2 className="font-display text-2xl font-semibold">{t("certificatesTitle")}</h2>
              {certificates.length === 0 ? (
                <p className="mt-3 rounded-2xl border border-dashed border-navy-900/20 bg-cream-50 p-6 text-sm text-stone2-700">{t("noCertificates")}</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {certificates.map((certificate) => (
                    <li key={certificate.id}>
                      <Link to={`/app/certificates/${certificate.id}`} className="focus-ring flex items-center gap-3 rounded-xl border border-gold-600/20 bg-cream-50 p-3 transition hover:border-gold-600/50">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold-500/20 text-gold-700"><Award className="h-5 w-5" aria-hidden /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{displayTitle({ title: certificate.courseTitle, titleAm: certificate.courseTitleAm }, lang)}</span>
                          <span className="text-xs text-stone2-500">{formatDate(certificate.issuedAt, lang)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
