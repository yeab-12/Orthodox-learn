import type { CourseStatus, Difficulty, Lang, QuizType } from "../types";
import type { Key } from "../i18n";

export function difficultyKey(difficulty: Difficulty | string | undefined): Key {
  if (difficulty === "advanced") return "difficultyAdvanced";
  if (difficulty === "intermediate") return "difficultyIntermediate";
  return "difficultyBeginner";
}

export function courseStatusKey(status: CourseStatus | string | undefined): Key {
  if (status === "draft") return "statusDraft";
  if (status === "pending") return "statusPending";
  if (status === "archived") return "statusArchived";
  return "statusPublished";
}

export function quizTypeKey(type: QuizType | string | undefined): Key {
  if (type === "final") return "quizTypeFinal";
  if (type === "lesson") return "quizTypeLesson";
  return "quizTypePractice";
}

export const courseStatusTone: Record<string, string> = {
  published: "bg-emerald-600/15 text-emerald-800",
  draft: "bg-cream-200 text-navy-900",
  pending: "bg-gold-500/25 text-gold-700",
  archived: "bg-rubric-500/15 text-rubric-600",
};

/** Human readable learning time, for example "1 h 20 min". */
export function formatLearningTime(seconds: number | null | undefined, lang: Lang): string {
  const total = Math.max(0, Math.round(Number(seconds) || 0) / 60);
  const whole = Math.round(total);
  const hours = Math.floor(whole / 60);
  const minutes = whole % 60;
  const hourWord = lang === "am" ? "ሰዓት" : "h";
  const minuteWord = lang === "am" ? "ደቂቃ" : "min";
  if (whole <= 0) return lang === "am" ? "0 ደቂቃ" : "0 min";
  return [hours ? `${hours} ${hourWord}` : "", minutes ? `${minutes} ${minuteWord}` : ""].filter(Boolean).join(" ");
}

export function formatDate(value: string | null | undefined, lang: Lang): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(lang === "am" ? "am-ET" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function displayTitle(item: { title: string; titleAm?: string }, lang: Lang): string {
  return lang === "am" ? item.titleAm || item.title : item.title;
}

export function percent(value: number | null | undefined): number {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}
