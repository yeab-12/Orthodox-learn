import { Link } from "react-router-dom";
import type { Teacher } from "../types";
import { useLang } from "../i18n";
import { Avatar } from "./UI";

export function TeacherCard({ teacher }: { teacher: Teacher }) {
  const { t, lang } = useLang();
  return (
    <Link to={`/app/teachers/${teacher.id}`} className="focus-ring flex h-full flex-col rounded-2xl border border-gold-600/20 bg-cream-50 p-5 shadow-sm shadow-navy-900/5 transition hover:border-gold-600/50">
      <div className="flex items-center gap-3">
        <Avatar name={teacher.name} size={48} />
        <div className="min-w-0">
          <h2 className="truncate font-display text-lg font-semibold">{teacher.name}</h2>
          <p className="text-xs text-stone2-500">{teacher.videoCount} {t("videosCount")} · {teacher.followers} {t("followersCount")}</p>
        </div>
      </div>
      {teacher.bio && <p className="mt-3 line-clamp-3 text-sm text-stone2-700">{teacher.bio}</p>}
      <span className="mt-auto pt-4 text-xs font-semibold text-gold-700">{lang === "am" ? "መገለጫ ተመልከት →" : "View profile →"}</span>
    </Link>
  );
}
