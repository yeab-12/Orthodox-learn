import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ListChecks,
  Send,
  Trophy,
} from "lucide-react";
import type { Quiz as QuizType, QuizAttempt, QuizQuestion } from "../types";
import { api, apiError } from "../api/client";
import { useLang } from "../i18n";
import { btnGold, btnPrimary, btnSecondary, ErrorBox, Spinner } from "../components/UI";
import { displayTitle, quizTypeKey } from "../lib/learning";

interface AnswerValue {
  optionIds: string[];
  text: string;
}

type AnswerMap = Record<string, AnswerValue>;

function draftKey(quizId: string, attemptId: string) {
  return `tewahedo_quiz_${quizId}_${attemptId}`;
}

function readDraft(quizId: string, attemptId: string): AnswerMap {
  try {
    const raw = localStorage.getItem(draftKey(quizId, attemptId));
    return raw ? (JSON.parse(raw) as AnswerMap) : {};
  } catch {
    return {};
  }
}

function clock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}

export function Quiz() {
  const { id = "" } = useParams();
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [startedQuiz, setStartedQuiz] = useState<QuizType | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState("");
  const autoSubmitted = useRef(false);
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const query = useQuery({
    queryKey: ["quiz", id],
    queryFn: async () => (await api.get<{ quiz: QuizType }>(`/quizzes/${id}`)).data.quiz,
  });

  const quiz = startedQuiz ?? query.data;

  const start = useMutation({
    mutationFn: async () =>
      (await api.post<{ attempt: QuizAttempt; quiz: QuizType; resumed: boolean }>(`/quizzes/${id}/start`)).data,
    onSuccess: (data) => {
      setAttempt(data.attempt);
      setStartedQuiz(data.quiz);
      setAnswers(readDraft(id, data.attempt.id));
      setNow(Date.now());
      autoSubmitted.current = false;
      setNotice(data.resumed ? t("quizResumed") : "");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (error) => setNotice(apiError(error)),
  });

  const submit = useMutation({
    mutationFn: async (attemptId: string) =>
      (
        await api.post<{ attempt: QuizAttempt }>(`/quizzes/${id}/submit`, {
          attemptId,
          answers: Object.entries(answers).map(([questionId, value]) => ({
            questionId,
            optionIds: value.optionIds ?? [],
            text: value.text ?? "",
          })),
          timeSpentSec: attempt?.startedAt
            ? Math.max(0, Math.round((Date.now() - new Date(attempt.startedAt).getTime()) / 1000))
            : 0,
        })
      ).data,
    onSuccess: (data) => {
      if (attempt) localStorage.removeItem(draftKey(id, attempt.id));
      queryClient.invalidateQueries({ queryKey: ["quiz", id] });
      queryClient.invalidateQueries({ queryKey: ["course"] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["learning"] });
      navigate(`/app/quizzes/${id}/results/${data.attempt.id}`);
    },
    onError: (error) => setNotice(apiError(error)),
  });

  useEffect(() => {
    if (!attempt) return;
    const key = draftKey(id, attempt.id);
    try {
      localStorage.setItem(key, JSON.stringify(answers));
    } catch {
      /* storage may be full or disabled; the quiz still works in memory */
    }
  }, [answers, attempt, id]);

  useEffect(() => {
    if (!attempt || !quiz || quiz.timeLimitMin <= 0) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [attempt, quiz]);

  const limitMs = (quiz?.timeLimitMin ?? 0) * 60_000;
  const startedAtMs = attempt ? new Date(attempt.startedAt).getTime() : 0;
  const remainingSec = limitMs > 0 && attempt ? Math.max(0, Math.round((startedAtMs + limitMs - now) / 1000)) : 0;

  useEffect(() => {
    if (!attempt || limitMs <= 0 || autoSubmitted.current || submit.isPending) return;
    if (Date.now() >= startedAtMs + limitMs) {
      autoSubmitted.current = true;
      submit.mutate(attempt.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, attempt, limitMs, startedAtMs]);

  const questions = useMemo(() => quiz?.questions ?? [], [quiz]);
  const answeredCount = questions.filter((question) => {
    const value = answers[question.id];
    if (question.type === "short_answer") return Boolean(value?.text?.trim());
    return Boolean(value?.optionIds?.length);
  }).length;
  const unanswered = questions.length - answeredCount;

  const setOption = (question: QuizQuestion, optionId: string) => {
    setAnswers((previous) => {
      const current = previous[question.id] ?? { optionIds: [], text: "" };
      if (question.type === "multiple_select") {
        const selected = current.optionIds.includes(optionId)
          ? current.optionIds.filter((value) => value !== optionId)
          : [...current.optionIds, optionId];
        return { ...previous, [question.id]: { ...current, optionIds: selected } };
      }
      return { ...previous, [question.id]: { ...current, optionIds: [optionId] } };
    });
  };

  const setText = (question: QuizQuestion, text: string) => {
    setAnswers((previous) => ({
      ...previous,
      [question.id]: { optionIds: [], text },
    }));
  };

  const scrollTo = (questionId: string) => {
    questionRefs.current[questionId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const canStart = Boolean(quiz && quiz.canAttempt !== false && quiz.questionCount > 0);
  const attemptsLeft = quiz && quiz.maxAttempts > 0 ? Math.max(0, quiz.maxAttempts - quiz.attemptsUsed) : null;

  if (query.isLoading) return <div className="mx-auto max-w-4xl px-4"><Spinner /></div>;
  if (query.isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <ErrorBox message={apiError(query.error)} retry={() => query.refetch()} />
        <Link to="/app/courses" className={`${btnSecondary} mt-4`}>{t("backToCourses")}</Link>
      </div>
    );
  }
  if (!quiz) return null;

  const title = displayTitle(quiz, lang);
  const description = lang === "am" ? quiz.descriptionAm || quiz.description : quiz.description;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Link to={`/app/courses/${quiz.courseId}`} className="focus-ring inline-flex items-center gap-1 text-sm font-semibold text-gold-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {t("backToCourse")}
      </Link>

      <div className="mt-4 overflow-hidden rounded-3xl border border-gold-600/20 bg-navy-900 p-6 text-cream-50 shadow-lg">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full px-2.5 py-1 font-semibold ${quiz.type === "final" ? "bg-rubric-500 text-white" : "bg-gold-500 text-navy-950"}`}>
            {t(quizTypeKey(quiz.type))}
          </span>
          {quiz.passed && <span className="rounded-full bg-emerald-600/30 px-2.5 py-1 font-semibold">{t("quizPassed")}</span>}
          {quiz.bestPercentage > 0 && <span className="rounded-full bg-cream-50/15 px-2.5 py-1">{t("bestScore")}: {quiz.bestPercentage}%</span>}
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold leading-tight sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-cream-100/85">{description}</p>}
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
          <p className="rounded-xl bg-cream-50/10 px-3 py-2"><span className="block text-xs text-cream-200">{t("questionsCount")}</span><span className="font-semibold">{quiz.questionCount}</span></p>
          <p className="rounded-xl bg-cream-50/10 px-3 py-2"><span className="block text-xs text-cream-200">{t("pointsLabel")}</span><span className="font-semibold">{quiz.totalPoints}</span></p>
          <p className="rounded-xl bg-cream-50/10 px-3 py-2"><span className="block text-xs text-cream-200">{t("passingScoreLabel")}</span><span className="font-semibold">{quiz.passingScore}%</span></p>
          <p className="rounded-xl bg-cream-50/10 px-3 py-2"><span className="block text-xs text-cream-200">{t("timeLimitLabel")}</span><span className="font-semibold">{quiz.timeLimitMin > 0 ? `${quiz.timeLimitMin} ${t("minutesLabel")}` : t("unlimitedLabel")}</span></p>
        </div>
      </div>

      {notice && <p role="alert" className="mt-4 rounded-xl border border-gold-600/30 bg-gold-500/10 p-3 text-sm font-medium text-stone2-700">{notice}</p>}

      {!attempt && (
        <section className="mt-6 rounded-2xl border border-gold-600/20 bg-cream-50 p-6">
          <h2 className="flex items-center gap-2 font-display text-2xl font-semibold"><ListChecks className="h-5 w-5 text-gold-700" aria-hidden /> {t("quizInstructions")}</h2>
          <ul className="mt-3 space-y-2 text-sm text-stone2-700">
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />{t("quizInstructionOne")}</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />{t("quizInstructionTwo")}</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />{t("quizInstructionThree")}</li>
            {quiz.maxAttempts > 0 && (
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />{t("attemptLimitLabel")}: {quiz.maxAttempts} · {t("attemptsRemaining", { count: attemptsLeft ?? 0 })}</li>
            )}
          </ul>

          {quiz.passed && quiz.lastAttempt && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-600/25 bg-emerald-600/10 p-3">
              <Trophy className="h-5 w-5 text-emerald-700" aria-hidden />
              <p className="min-w-0 flex-1 text-sm font-medium text-emerald-800">{t("quizAlreadyPassed")}</p>
              <Link to={`/app/quizzes/${quiz.id}/results/${quiz.lastAttempt.id}`} className={btnSecondary}>{t("viewResults")}</Link>
            </div>
          )}

          {!canStart && (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-rubric-500/25 bg-rubric-500/10 p-3 text-sm font-medium text-rubric-600">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {quiz.questionCount === 0 ? t("quizNoQuestions") : t("noAttemptsLeft")}
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={() => start.mutate()} disabled={!canStart || start.isPending} className={btnGold}>
              {start.isPending ? t("loading") : quiz.attemptsUsed > 0 || quiz.passed ? t("retryQuiz") : t("startQuiz")}
            </button>
            {quiz.passed && quiz.lastAttempt && <Link to={`/app/quizzes/${quiz.id}/results/${quiz.lastAttempt.id}`} className={btnSecondary}>{t("viewResults")}</Link>}
          </div>
        </section>
      )}

      {attempt && quiz && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_260px]">
          <div className="min-w-0 space-y-4">
            <div className="sticky top-16 z-10 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gold-600/25 bg-cream-50/95 p-3 shadow-sm backdrop-blur">
              <p className="text-sm font-semibold">
                {t("answeredLabel")}: {answeredCount}/{questions.length}
                {unanswered > 0 && <span className="ml-2 rounded-full bg-gold-500/20 px-2 py-0.5 text-xs font-semibold text-gold-700">{unanswered} {t("unansweredLabel")}</span>}
              </p>
              {quiz.timeLimitMin > 0 && (
                <p className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${remainingSec < 60 ? "bg-rubric-500/15 text-rubric-600" : "bg-cream-200 text-navy-900"}`}>
                  <Clock className="h-4 w-4" aria-hidden /> {clock(remainingSec)}
                </p>
              )}
            </div>

            {questions.map((question, index) => {
              const value = answers[question.id] ?? { optionIds: [], text: "" };
              return (
                <div
                  key={question.id}
                  ref={(node) => { questionRefs.current[question.id] = node; }}
                  id={`question-${question.id}`}
                  className="scroll-mt-24 rounded-2xl border border-gold-600/20 bg-cream-50 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-display text-lg font-semibold leading-snug">
                      <span className="mr-2 inline-grid h-7 w-7 place-items-center rounded-full bg-navy-900 text-sm text-gold-300">{index + 1}</span>
                      {lang === "am" ? question.textAm || question.text : question.text}
                    </h2>
                    <span className="shrink-0 rounded-full bg-cream-200 px-2 py-1 text-[11px] font-semibold">{question.points} {t("pointsShort")}</span>
                  </div>
                  <p className="mt-1 text-xs text-stone2-500">
                    {question.type === "multiple_select" ? t("selectAllThatApply") : question.type === "short_answer" ? t("typeAnswer") : t("selectOne")}
                  </p>

                  {question.type === "short_answer" ? (
                    <input
                      value={value.text}
                      onChange={(event) => setText(question, event.target.value)}
                      placeholder={t("yourAnswer")}
                      className="focus-ring mt-3 w-full rounded-xl border border-navy-900/20 bg-white px-4 py-3 text-sm outline-none focus:border-gold-600"
                    />
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {question.options.map((option) => {
                        const checked = value.optionIds.includes(option.id);
                        return (
                          <li key={option.id}>
                            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition ${checked ? "border-gold-600 bg-gold-500/10" : "border-navy-900/15 bg-white hover:border-gold-600/50"}`}>
                              <input
                                type={question.type === "multiple_select" ? "checkbox" : "radio"}
                                name={`question-${question.id}`}
                                checked={checked}
                                onChange={() => setOption(question, option.id)}
                                className="mt-0.5 h-4 w-4 accent-gold-600"
                              />
                              <span>{lang === "am" ? option.textAm || option.text : option.text}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}

            <div className="rounded-2xl border border-gold-600/20 bg-cream-50 p-4">
              {unanswered > 0 && (
                <p className="mb-3 flex items-start gap-2 text-sm font-medium text-gold-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {t("unansweredWarning", { count: unanswered })}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  if (unanswered > 0 && !window.confirm(t("confirmSubmitQuiz", { count: unanswered }))) return;
                  if (!window.confirm(t("confirmSubmitFinal"))) return;
                  submit.mutate(attempt.id);
                }}
                disabled={submit.isPending}
                className={`${btnGold} w-full sm:w-auto`}
              >
                <Send className="h-4 w-4" aria-hidden /> {submit.isPending ? t("submitting") : t("submitQuiz")}
              </button>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-gold-600/20 bg-cream-50 p-4">
              <h2 className="font-display text-lg font-semibold">{t("quizNavigator")}</h2>
              <div className="mt-3 grid grid-cols-5 gap-2">
                {questions.map((question, index) => {
                  const done = question.type === "short_answer"
                    ? Boolean(answers[question.id]?.text?.trim())
                    : Boolean(answers[question.id]?.optionIds?.length);
                  return (
                    <button
                      key={question.id}
                      type="button"
                      onClick={() => scrollTo(question.id)}
                      className={`focus-ring grid h-9 w-9 place-items-center rounded-full text-sm font-semibold ${done ? "bg-emerald-600 text-white" : "bg-cream-200 text-navy-900 hover:bg-cream-300"}`}
                      aria-label={`${t("questionLabel")} ${index + 1}`}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 space-y-1 text-xs text-stone2-700">
                <p className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-600" aria-hidden /> {t("answeredLabel")}</p>
                <p className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-cream-200 ring-1 ring-navy-900/15" aria-hidden /> {t("unansweredLabel")}</p>
              </div>
            </div>
            <p className="rounded-2xl border border-gold-600/20 bg-cream-50 p-4 text-xs text-stone2-700">{t("quizAutosaveNote")}</p>
            <button type="button" onClick={() => scrollTo(questions[questions.length - 1]?.id)} className={`${btnSecondary} w-full`}>
              {t("goToLastQuestion")}
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
