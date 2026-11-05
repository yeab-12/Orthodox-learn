import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  FileDown,
  ListChecks,
  PlayCircle,
  Settings,
  Target,
  Users,
} from "lucide-react";
import type { Course } from "../types";
import { api, apiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useLang } from "../i18n";
import { Cover } from "../components/Art";
import { Avatar, btnGold, btnPrimary, btnSecondary, ErrorBox, Spinner } from "../components/UI";
import {
  courseStatusKey,
  courseStatusTone,
  difficultyKey,
  displayTitle,
  formatDate,
  formatLearningTime,
  percent,
  quizTypeKey,
} from "../lib/learning";

export function CourseDetail() {
  const { id = "" } = useParams();
  const { t, lang } = useLang();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["course", id],
    queryFn: async () => (await api.get<{ course: Course }>(`/courses/${id}`)).data.course,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["course", id] });
    queryClient.invalidateQueries({ queryKey: ["courses"] });
    queryClient.invalidateQueries({ queryKey: ["learning"] });
  };

  const enroll = useMutation({
    mutationFn: () => api.post(`/courses/${id}/enroll`),
    onSuccess: refresh,
  });

  const claim = useMutation({
    mutationFn: () => api.post(`/courses/${id}/certificate`),
    onSuccess: refresh,
  });

  if (query.isLoading) return <div className="mx-auto max-w-5xl px-4"><Spinner /></div>;
  if (query.isError) return <div className="mx-auto max-w-2xl px-4 py-8"><ErrorBox message={apiError(query.error)} retry={() => query.refetch()} /></div>;
  if (!query.data) return null;

  const course = query.data;
  const manager = Boolean(user && (user.role === "admin" || (user.role === "teacher" && user.id === course.teacherId)));
  const title = displayTitle(course, lang);
  const description = lang === "am" ? course.descriptionAm || course.description : course.description;
  const lessons = course.lessons ?? [];
  const pct = percent(course.progressPct);
  const nextLesson = lessons.find((lesson) => !lesson.completed) ?? lessons[0];
  const resumeId = course.lastLessonId && lessons.some((lesson) => lesson.id === course.lastLessonId)
    ? course.lastLessonId
    : nextLesson?.id;
  const continueHref = resumeId ? `/app/lessons/${resumeId}` : "#";
  const duration = formatLearningTime(course.totalDurationSec || course.estimatedDuration, lang);
  const quizzes = course.quizzes ?? [];
  const finalQuiz = course.finalQuiz;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Link to="/app/courses" className="focus-ring inline-flex items-center gap-1 text-sm font-semibold text-gold-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {t("backToCourses")}
      </Link>

      <div className="mt-5 overflow-hidden rounded-3xl border border-gold-600/20 bg-navy-900 text-cream-50 shadow-xl shadow-navy-900/10 sm:grid sm:grid-cols-[240px_1fr]">
        <Cover variant={course.cover} className="h-48 w-full sm:h-full" />
        <div className="p-6">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-full px-2.5 py-1 font-semibold capitalize ${courseStatusTone[course.status]}`}>{t(courseStatusKey(course.status))}</span>
            <span className="rounded-full bg-gold-500 px-2.5 py-1 font-semibold text-navy-950">{t(difficultyKey(course.difficulty))}</span>
            <span className="rounded-full bg-cream-50/15 px-2.5 py-1">{course.language === "am" ? "አማርኛ" : "English"}</span>
            <span className="rounded-full bg-cream-50/15 px-2.5 py-1">{course.lessonCount} {t("courseLessons")}</span>
            {duration && <span className="rounded-full bg-cream-50/15 px-2.5 py-1">{duration}</span>}
            {course.enrolled && <span className="rounded-full bg-emerald-600/30 px-2.5 py-1 font-semibold">{t("enrolled")}</span>}
          </div>

          <h1 className="mt-3 font-display text-3xl font-semibold leading-tight sm:text-4xl">{title}</h1>
          {course.category && (
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gold-300">
              {lang === "am" ? course.category.am : course.category.en}
            </p>
          )}
          {description && <p className="mt-3 max-w-2xl text-cream-100/85">{description}</p>}

          {course.teacher && (
            <div className="mt-4 flex items-start gap-3">
              <Avatar name={course.teacher.name} size={36} />
              <div>
                <Link to={`/app/teachers/${course.teacher.id}`} className="focus-ring text-sm font-semibold hover:text-gold-300">
                  {course.teacher.name}
                </Link>
                {course.teacher.bio && <p className="mt-0.5 line-clamp-2 max-w-xl text-xs text-cream-200/80">{course.teacher.bio}</p>}
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {course.enrolled ? (
              <Link to={continueHref} className={btnPrimary}>
                <PlayCircle className="h-4 w-4" aria-hidden />
                {course.completed ? t("reviewCourse") : course.done > 0 ? t("continueCourse") : t("startCourse")}
              </Link>
            ) : (
              <button type="button" onClick={() => enroll.mutate()} disabled={enroll.isPending} className={btnGold}>
                <BookOpen className="h-4 w-4" aria-hidden /> {enroll.isPending ? t("saving") : t("enroll")}
              </button>
            )}
            {manager && (
              <Link to={`/app/manage/courses?course=${course.id}`} className={`${btnSecondary} !border-cream-50/30 !bg-transparent !text-cream-50 hover:!bg-cream-50/10`}>
                <Settings className="h-4 w-4" aria-hidden /> {t("manageThisCourse")}
              </Link>
            )}
            {course.enrolled && (
              <div className="min-w-40 flex-1 sm:max-w-xs">
                <div className="h-2 rounded-full bg-cream-50/20" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t("courseProgress")}>
                  <div className="h-full rounded-full bg-gold-400 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-xs text-cream-200">{t("doneOf", { done: course.done, total: course.lessonCount })} · {pct}%</p>
              </div>
            )}
          </div>
          {enroll.isError && <p role="alert" className="mt-3 text-sm text-gold-300">{apiError(enroll.error)}</p>}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-8">
          {(course.objectives.length > 0 || course.prerequisites.length > 0) && (
            <section className="grid gap-4 sm:grid-cols-2">
              {course.objectives.length > 0 && (
                <div className="rounded-2xl border border-gold-600/20 bg-cream-50 p-5">
                  <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Target className="h-5 w-5 text-gold-700" aria-hidden /> {t("whatYouLearn")}</h2>
                  <ul className="mt-3 space-y-2 text-sm text-stone2-700">
                    {course.objectives.map((item, index) => (
                      <li key={`${item}-${index}`} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden /><span>{item}</span></li>
                    ))}
                  </ul>
                </div>
              )}
              {course.prerequisites.length > 0 && (
                <div className="rounded-2xl border border-gold-600/20 bg-cream-50 p-5">
                  <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><ListChecks className="h-5 w-5 text-gold-700" aria-hidden /> {t("prerequisites")}</h2>
                  <ul className="mt-3 space-y-2 text-sm text-stone2-700">
                    {course.prerequisites.map((item, index) => (
                      <li key={`${item}-${index}`} className="flex gap-2"><Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-600" aria-hidden /><span>{item}</span></li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          <section>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="font-display text-2xl font-semibold">{t("courseContents")}</h2>
              <span className="text-sm text-stone2-500">{t("doneOf", { done: course.done, total: course.lessonCount })}</span>
            </div>
            {!course.enrolled && <p className="mt-2 rounded-xl border border-gold-600/25 bg-gold-500/10 p-3 text-sm text-stone2-700">{t("notEnrolled")}</p>}
            <ol className="mt-4 space-y-2">
              {lessons.map((lesson, index) => (
                <li key={lesson.id}>
                  <Link to={`/app/lessons/${lesson.id}`} className="focus-ring group flex items-center gap-4 rounded-2xl border border-gold-600/20 bg-cream-50 p-3 transition hover:border-gold-600/50 sm:p-4">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cream-200 font-display font-bold text-navy-900" aria-hidden>{index + 1}</span>
                    <div className="h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-navy-900"><Cover variant={lesson.cover} className="h-full w-full" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 font-semibold leading-snug group-hover:text-gold-700">{displayTitle(lesson, lang)}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-stone2-500">
                        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden /> {formatLearningTime(lesson.durationSec, lang)}</span>
                        {lesson.quiz && <span className="rounded-full bg-gold-500/20 px-2 py-0.5 font-semibold text-gold-700">{t("quizLabel")}</span>}
                        {lesson.objectives && lesson.objectives.length > 0 && <span>{lesson.objectives.length} {t("objectivesLabel")}</span>}
                      </p>
                    </div>
                    {lesson.completed ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" aria-label={t("completedBadge")} /> : <Circle className="h-5 w-5 shrink-0 text-stone2-500" aria-hidden />}
                    <PlayCircle className="hidden h-6 w-6 shrink-0 text-gold-700 sm:block" aria-hidden />
                  </Link>
                </li>
              ))}
            </ol>
            {lessons.length === 0 && <p className="mt-4 rounded-xl border border-dashed border-navy-900/20 p-6 text-stone2-700">{t("noVideos")}</p>}
          </section>

          <section>
            <h2 className="font-display text-2xl font-semibold">{t("courseQuizzes")}</h2>
            {quizzes.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-navy-900/20 p-5 text-sm text-stone2-700">{t("noQuizzes")}</p>
            ) : (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {quizzes.map((quiz) => (
                  <li key={quiz.id} className="rounded-2xl border border-gold-600/20 bg-cream-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${quiz.type === "final" ? "bg-rubric-500/15 text-rubric-600" : "bg-gold-500/25 text-gold-700"}`}>
                        {t(quizTypeKey(quiz.type))}
                      </span>
                      {quiz.passed && <span className="rounded-full bg-emerald-600/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">{t("quizPassed")}</span>}
                      {!quiz.published && <span className="rounded-full bg-cream-200 px-2.5 py-1 text-[11px] font-semibold">{t("statusDraft")}</span>}
                    </div>
                    <h3 className="mt-2 font-display text-lg font-semibold">{displayTitle(quiz, lang)}</h3>
                    <p className="mt-1 text-xs text-stone2-500">
                      {quiz.questionCount} {t("questionsCount")} · {quiz.totalPoints} {t("pointsLabel")} · {t("passingScoreLabel")} {quiz.passingScore}%
                      {quiz.timeLimitMin > 0 ? ` · ${quiz.timeLimitMin} ${t("minutesLabel")}` : ""}
                    </p>
                    {quiz.attemptsUsed > 0 && (
                      <p className="mt-1 text-xs font-medium text-stone2-700">
                        {t("bestScore")}: {quiz.bestPercentage}% · {t("attemptsUsedLabel")}: {quiz.attemptsUsed}
                        {quiz.maxAttempts > 0 ? ` / ${quiz.maxAttempts}` : ""}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {course.enrolled ? (
                        <Link to={`/app/quizzes/${quiz.id}`} className={quiz.passed ? btnSecondary : btnPrimary}>
                          {quiz.passed ? t("reviewQuiz") : t("takeQuiz")}
                        </Link>
                      ) : (
                        <button type="button" onClick={() => enroll.mutate()} disabled={enroll.isPending} className={btnSecondary}>{t("enrollToTakeQuiz")}</button>
                      )}
                      {quiz.lastAttempt && quiz.passed && (
                        <Link to={`/app/quizzes/${quiz.id}/results/${quiz.lastAttempt.id}`} className={btnSecondary}>{t("viewResults")}</Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-gold-600/20 bg-cream-50 p-5">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Award className="h-5 w-5 text-gold-700" aria-hidden /> {t("certificatePanelTitle")}</h2>
            {course.certificate ? (
              <>
                <p className="mt-2 text-sm text-stone2-700">{t("certificateReady")}</p>
                <Link to={`/app/certificates/${course.certificate.id}`} className={`${btnGold} mt-4 w-full`}>{t("viewCertificate")}</Link>
              </>
            ) : course.enrolled && course.completed && course.certificateEnabled ? (
              <>
                <p className="mt-2 text-sm text-stone2-700">{t("certificateEligible")}</p>
                <button type="button" onClick={() => claim.mutate()} disabled={claim.isPending} className={`${btnGold} mt-4 w-full`}>
                  {claim.isPending ? t("saving") : t("claimCertificate")}
                </button>
              </>
            ) : (
              <p className="mt-2 text-sm text-stone2-700">
                {course.certificateEnabled ? t("certificateRequirement") : t("certificateDisabled")}
              </p>
            )}
            {claim.isError && <p role="alert" className="mt-2 text-sm text-rubric-600">{apiError(claim.error)}</p>}
          </div>

          {finalQuiz && (
            <div className="rounded-2xl border border-gold-600/20 bg-cream-50 p-5">
              <h2 className="font-display text-xl font-semibold">{t("quizTypeFinal")}</h2>
              <p className="mt-1 text-sm font-medium">{displayTitle(finalQuiz, lang)}</p>
              <p className="mt-1 text-xs text-stone2-500">
                {finalQuiz.questionCount} {t("questionsCount")} · {t("passingScoreLabel")} {finalQuiz.passingScore}%
              </p>
              <p className="mt-2 text-xs font-medium">
                {finalQuiz.passed ? t("quizPassed") : course.enrolled ? t("finalQuizPending") : t("finalQuizEnroll")}
              </p>
              {course.enrolled && (
                <Link to={`/app/quizzes/${finalQuiz.id}`} className={`${finalQuiz.passed ? btnSecondary : btnPrimary} mt-3 w-full`}>
                  {finalQuiz.passed ? t("viewResults") : t("takeQuiz")}
                </Link>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-gold-600/20 bg-cream-50 p-5 text-sm text-stone2-700">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-navy-900"><Users className="h-5 w-5 text-gold-700" aria-hidden /> {t("courseFacts")}</h2>
            <dl className="mt-3 space-y-2">
              <div className="flex justify-between gap-3"><dt>{t("difficultyLabel")}</dt><dd className="font-semibold text-navy-900">{t(difficultyKey(course.difficulty))}</dd></div>
              <div className="flex justify-between gap-3"><dt>{t("languageLabel")}</dt><dd className="font-semibold text-navy-900">{course.language === "am" ? "አማርኛ" : "English"}</dd></div>
              <div className="flex justify-between gap-3"><dt>{t("courseLessons")}</dt><dd className="font-semibold text-navy-900">{course.lessonCount}</dd></div>
              {duration && <div className="flex justify-between gap-3"><dt>{t("durationLabel")}</dt><dd className="font-semibold text-navy-900">{duration}</dd></div>}
              {course.updatedAt && <div className="flex justify-between gap-3"><dt>{t("updatedLabel")}</dt><dd className="font-semibold text-navy-900">{formatDate(course.updatedAt, lang)}</dd></div>}
            </dl>
            {course.lessons?.some((lesson) => lesson.downloadUrl || (lesson.resources && lesson.resources.length > 0)) && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-gold-700"><FileDown className="h-4 w-4" aria-hidden /> {t("materialsAvailable")}</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
