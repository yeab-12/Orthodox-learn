import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
  RotateCcw,
  Trophy,
  XCircle,
} from "lucide-react";
import type { Certificate, Quiz as QuizModel, QuizAttempt } from "../types";
import { api, apiError } from "../api/client";
import { useLang } from "../i18n";
import { btnGold, btnSecondary, ErrorBox, Spinner } from "../components/UI";
import { displayTitle, formatDate, quizTypeKey } from "../lib/learning";

function formatSpent(seconds: number | null, lang: "en" | "am") {
  if (seconds === null || Number.isNaN(seconds)) return "";
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return lang === "am" ? `${minutes} ደቂቃ ${rest} ሰከንድ` : `${minutes}m ${rest}s`;
}

export function QuizResult() {
  const { id = "", attemptId = "" } = useParams();
  const { t, lang } = useLang();

  const attemptQuery = useQuery({
    queryKey: ["quiz", id, "attempt", attemptId],
    queryFn: async () =>
      (await api.get<{ attempt: QuizAttempt }>(`/quizzes/${id}/attempts/${attemptId}`)).data.attempt,
  });
  const quizQuery = useQuery({
    queryKey: ["quiz", id],
    queryFn: async () => (await api.get<{ quiz: QuizModel }>(`/quizzes/${id}`)).data.quiz,
  });
  const certificatesQuery = useQuery({
    queryKey: ["learning", "certificates"],
    queryFn: async () => (await api.get<{ certificates: Certificate[] }>("/learning/certificates")).data.certificates,
  });

  if (attemptQuery.isLoading) return <div className="mx-auto max-w-4xl px-4"><Spinner /></div>;
  if (attemptQuery.isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <ErrorBox message={apiError(attemptQuery.error)} retry={() => attemptQuery.refetch()} />
        <Link to={`/app/quizzes/${id}`} className={`${btnSecondary} mt-4`}>{t("backToQuiz")}</Link>
      </div>
    );
  }

  const attempt = attemptQuery.data;
  if (!attempt) return null;

  const quiz = quizQuery.data;
  const percentage = Math.max(0, Math.min(100, Math.round(Number(attempt.percentage) || 0)));
  const passed = Boolean(attempt.passed);
  const answers = attempt.answers ?? [];
  const showReview = answers.length > 0;
  const questionMap = new Map((quiz?.questions ?? []).map((question) => [question.id, question]));
  const certificate = (certificatesQuery.data ?? []).find(
    (item) => item.courseId === (quiz?.courseId ?? attempt.courseId),
  );
  const correctCount = answers.filter((answer) => answer.correct).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <Link
        to={quiz ? `/app/courses/${quiz.courseId}` : "/app/my-learning"}
        className="focus-ring inline-flex items-center gap-1 text-sm font-semibold text-gold-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> {quiz ? t("backToCourse") : t("myLearning")}
      </Link>

      <section className={`mt-5 overflow-hidden rounded-3xl p-6 shadow-lg ${passed ? "bg-emerald-700 text-white" : "bg-navy-900 text-cream-50"}`}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {quiz && <span className="rounded-full bg-cream-50/15 px-2.5 py-1 font-semibold">{t(quizTypeKey(quiz.type))}</span>}
          <span className="rounded-full bg-cream-50/15 px-2.5 py-1">{t("attemptLabel")} {attempt.attemptNumber}</span>
          {attempt.submittedAt && <span className="rounded-full bg-cream-50/15 px-2.5 py-1">{formatDate(attempt.submittedAt, lang)}</span>}
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold leading-tight sm:text-4xl">
          {quiz ? displayTitle(quiz, lang) : attempt.quizTitle}
        </h1>
        <p className="mt-1 text-sm opacity-85">{t("quizResultSub")}</p>

        <div className="mt-5 flex flex-wrap items-center gap-6">
          <div className="grid h-28 w-28 shrink-0 place-items-center rounded-full border-4 border-cream-50/30 bg-cream-50/10">
            <div className="text-center">
              <p className="font-display text-3xl font-bold">{percentage}%</p>
              <p className="text-xs opacity-80">{attempt.score ?? 0}/{attempt.totalPoints ?? 0}</p>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${passed ? "bg-white/20" : "bg-gold-500 text-navy-950"}`}>
              {passed ? <Trophy className="h-4 w-4" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />}
              {passed ? t("passedLabel") : t("failedLabel")}
            </p>
            <p className="mt-2 max-w-xl text-sm opacity-90">{passed ? t("passedBody") : t("notPassedBody")}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs opacity-80">
              <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-4 w-4" aria-hidden /> {correctCount}/{answers.length || quiz?.questionCount || 0} {t("correctLabel")}</span>
              {attempt.durationSec !== null && <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" aria-hidden /> {formatSpent(attempt.durationSec, lang)}</span>}
              {quiz && <span>{t("passingScoreLabel")}: {quiz.passingScore}%</span>}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link to={`/app/quizzes/${id}`} className={btnGold}>
            <RotateCcw className="h-4 w-4" aria-hidden /> {t("retakeQuiz")}
          </Link>
          {quiz && <Link to={`/app/courses/${quiz.courseId}`} className={`${btnSecondary} !border-cream-50/30 !bg-transparent !text-cream-50 hover:!bg-cream-50/10`}>{t("backToCourse")}</Link>}
          {certificate && (
            <Link to={`/app/certificates/${certificate.id}`} className={`${btnSecondary} !border-cream-50/30 !bg-transparent !text-cream-50 hover:!bg-cream-50/10`}>
              <Award className="h-4 w-4" aria-hidden /> {t("viewCertificate")}
            </Link>
          )}
        </div>
      </section>

      {!showReview && (
        <p className="mt-5 rounded-2xl border border-gold-600/25 bg-cream-50 p-4 text-sm text-stone2-700">
          {attempt.submittedAt ? t("resultsUnavailable") : t("autoGradedNote")}
        </p>
      )}

      {showReview && (
        <section className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="font-display text-2xl font-semibold">{t("questionReview")}</h2>
            <p className="text-xs text-stone2-500">{t("autoGradedNote")}</p>
          </div>
          <ol className="mt-4 space-y-4">
            {answers.map((answer, index) => {
              const question = questionMap.get(answer.questionId);
              const selected = answer.optionIds ?? [];
              const correct = answer.correctOptionIds ?? [];
              return (
                <li key={answer.questionId} className="rounded-2xl border border-gold-600/20 bg-cream-50 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-lg font-semibold leading-snug">
                      <span className="mr-2 inline-grid h-7 w-7 place-items-center rounded-full bg-navy-900 text-sm text-gold-300">{index + 1}</span>
                      {lang === "am" ? answer.textAm || answer.text : answer.text}
                    </h3>
                    <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${answer.correct ? "bg-emerald-600/15 text-emerald-800" : "bg-rubric-500/15 text-rubric-600"}`}>
                      {answer.correct ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <XCircle className="h-3.5 w-3.5" aria-hidden />}
                      {answer.correct ? t("correctLabel") : t("incorrectLabel")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-stone2-500">{answer.pointsAwarded}/{answer.points} {t("pointsLabel")}</p>

                  {answer.type === "short_answer" ? (
                    <dl className="mt-3 space-y-2 text-sm">
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-stone2-500">{t("yourAnswerLabel")}</dt>
                        <dd className={`mt-0.5 rounded-lg border px-3 py-2 ${answer.correct ? "border-emerald-600/30 bg-emerald-600/10" : "border-rubric-500/30 bg-rubric-500/10"}`}>
                          {answer.answerText || t("noAnswer")}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-stone2-500">{t("correctAnswerLabel")}</dt>
                        <dd className="mt-0.5 rounded-lg border border-emerald-600/30 bg-emerald-600/10 px-3 py-2">{answer.correctText || "—"}</dd>
                      </div>
                    </dl>
                  ) : (
                    <ul className="mt-3 space-y-2 text-sm">
                      {(question?.options ?? []).map((option) => {
                        const isCorrect = correct.includes(option.id);
                        const isSelected = selected.includes(option.id);
                        return (
                          <li
                            key={option.id}
                            className={`flex items-start gap-2 rounded-xl border px-3 py-2 ${
                              isCorrect
                                ? "border-emerald-600/40 bg-emerald-600/10"
                                : isSelected
                                  ? "border-rubric-500/40 bg-rubric-500/10"
                                  : "border-navy-900/10 bg-white"
                            }`}
                          >
                            <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
                              {isCorrect ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : isSelected ? <XCircle className="h-4 w-4 text-rubric-600" /> : <span className="h-2 w-2 rounded-full bg-navy-900/20" />}
                            </span>
                            <span className="min-w-0 flex-1">{lang === "am" ? option.textAm || option.text : option.text}</span>
                            {isSelected && <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-stone2-500">{t("yourAnswerLabel")}</span>}
                            {isCorrect && <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">{t("correctLabel")}</span>}
                          </li>
                        );
                      })}
                      {selected.length === 0 && <li className="text-sm text-stone2-500">{t("noAnswer")}</li>}
                    </ul>
                  )}

                  {answer.explanation && (
                    <div className="mt-3 rounded-xl border border-gold-600/25 bg-gold-500/10 p-3 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gold-700">{t("explanationLabel")}</p>
                      <p className="mt-1 text-stone2-700">{answer.explanation}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          {answers.some((answer) => answer.type === "short_answer") && (
            <p className="mt-4 rounded-xl border border-gold-600/25 bg-cream-50 p-3 text-xs text-stone2-700">{t("shortAnswerNote")}</p>
          )}
        </section>
      )}
    </div>
  );
}
