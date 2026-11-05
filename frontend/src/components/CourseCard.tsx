import { Link } from "react-router-dom";
import { CheckCircle2, Clock, ListVideo } from "lucide-react";
import type { Course } from "../types";
import { useLang } from "../i18n";
import { Cover } from "./Art";
import {
  courseStatusKey,
  courseStatusTone,
  difficultyKey,
  displayTitle,
  formatLearningTime,
  percent,
} from "../lib/learning";

export function CourseCard({ course }: { course: Course }) {
  const { t, lang } = useLang();
  const title = displayTitle(course, lang);
  const pct = percent(course.progressPct);
  const duration = formatLearningTime(course.totalDurationSec || course.estimatedDuration, lang);
  const status = course.status ?? "published";

  return (
    <Link
      to={`/app/courses/${course.id}`}
      className="focus-ring group flex flex-col overflow-hidden rounded-2xl border border-gold-600/20 bg-cream-50 shadow-sm shadow-navy-900/5 transition hover:border-gold-600/50"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-navy-900">
        <Cover variant={course.cover} className="h-full w-full transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-2.5">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${courseStatusTone[status]}`}>
            {t(courseStatusKey(status))}
          </span>
          <span className="rounded-full bg-navy-950/75 px-2.5 py-1 text-[11px] font-semibold text-cream-50">
            {t(difficultyKey(course.difficulty))}
          </span>
        </div>
        {course.completed && (
          <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {t("completed")}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-stone2-700">
          <span className="inline-flex items-center gap-1 rounded-full bg-gold-500/25 px-2.5 py-1 text-gold-700">
            <ListVideo className="h-3.5 w-3.5" aria-hidden /> {course.lessonCount} {t("courseLessons")}
          </span>
          {duration && (
            <span className="inline-flex items-center gap-1 rounded-full bg-cream-200 px-2.5 py-1">
              <Clock className="h-3.5 w-3.5" aria-hidden /> {duration}
            </span>
          )}
        </div>
        <h2 className="mt-2 font-display text-lg font-semibold leading-snug group-hover:text-gold-700">{title}</h2>
        <p className="mt-0.5 text-sm text-stone2-500">
          {course.teacher?.name ?? t("teacherLabel")} · {course.language === "am" ? "አማርኛ" : "English"}
        </p>

        {course.enrolled ? (
          <div className="mt-auto pt-4">
            <div
              className="h-2 rounded-full bg-cream-200"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t("courseProgress")}
            >
              <div className="h-full rounded-full bg-gold-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-xs font-medium">
              {course.completed
                ? t("completed")
                : `${t("doneOf", { done: course.done, total: course.lessonCount })} · ${pct}%`}
            </p>
          </div>
        ) : (
          <p className="mt-auto pt-4 text-sm font-semibold text-gold-700">{t("startCourse")} →</p>
        )}
      </div>
    </Link>
  );
}
