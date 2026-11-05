import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import type { Category, Course, Teacher, Video } from "../types";
import { api, apiError } from "../api/client";
import { VideoCard } from "../components/VideoCard";
import { CourseCard } from "../components/CourseCard";
import { TeacherCard } from "../components/TeacherCard";
import { useLang } from "../i18n";
import { EmptyState, ErrorBox, PageHeader, Spinner } from "../components/UI";

export function Explore() {
  const { t, lang } = useLang();
  const [category, setCategory] = useState("all");
  const [language, setLanguage] = useState("all");
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();

  const videos = useQuery({
    queryKey: ["videos", "explore"],
    queryFn: async () => (await api.get<{ videos: Video[] }>("/videos")).data.videos,
  });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get<{ categories: Category[] }>("/categories")).data.categories,
  });
  const search = useQuery({
    queryKey: ["search", needle],
    queryFn: async () => (await api.get<{ courses: Course[]; teachers: Teacher[] }>("/search", { params: { q: needle } })).data,
    enabled: needle.length >= 2,
  });

  const list = useMemo(() => (videos.data ?? []).filter((video) => {
    const inCategory = category === "all" || video.categoryId === category;
    const inLanguage = language === "all" || video.language === language;
    const matches = !needle || [video.title, video.titleAm, video.teacher.name, video.description, video.descriptionAm]
      .some((value) => value.toLowerCase().includes(needle));
    return inCategory && inLanguage && matches;
  }), [videos.data, category, language, needle]);

  const chip = (on: boolean) => `focus-ring shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${on ? "border-navy-900 bg-navy-900 text-cream-50" : "border-navy-900/20 bg-cream-50 hover:bg-cream-200"}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader title={t("exploreTitle")} subtitle={t("exploreSub")} />

      <label className="relative mt-5 block">
        <span className="sr-only">{t("search")}</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone2-500" aria-hidden />
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchPlaceholder")}
          className="focus-ring w-full rounded-full border border-navy-900/20 bg-cream-50 py-3 pl-12 pr-4 text-navy-900 placeholder:text-stone2-500" />
      </label>

      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label={t("categoryLabel")}>
        <button type="button" aria-pressed={category === "all"} className={chip(category === "all")} onClick={() => setCategory("all")}>{t("allCategories")}</button>
        {categories.data?.map((item) => (
          <button key={item.id} type="button" aria-pressed={category === item.id} className={chip(category === item.id)} onClick={() => setCategory(item.id)}>
            {lang === "am" ? item.am : item.en}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label={t("language")}>
        {[["all", t("allLanguages")], ["en", "English"], ["am", "አማርኛ"]].map(([key, label]) => (
          <button key={key} type="button" aria-pressed={language === key} className={chip(language === key)} onClick={() => setLanguage(key)}>{label}</button>
        ))}
        {(category !== "all" || language !== "all" || query) && (
          <button type="button" onClick={() => { setCategory("all"); setLanguage("all"); setQuery(""); }} className="focus-ring rounded-full px-3 py-2 text-sm font-semibold text-gold-700 underline">
            {t("clearFilters")}
          </button>
        )}
      </div>

      {videos.isLoading && <Spinner />}
      {videos.isError && <ErrorBox message={apiError(videos.error)} retry={() => videos.refetch()} />}

      {videos.data && (
        <>
          <p className="mt-6 text-sm font-medium text-stone2-500">{list.length} {t("videosFound")}{needle ? ` · ${t("resultsFor")} “${query}”` : ""}</p>
          {list.length === 0 ? (
            <div className="mt-4">
              <EmptyState title={t("noResults")} action={<Link to="/app/courses" className="focus-ring rounded-full border border-navy-900/25 px-5 py-2.5 font-semibold">{t("courses")}</Link>} />
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {list.map((video) => <VideoCard key={video.id} video={video} />)}
            </div>
          )}
        </>
      )}

      {needle.length >= 2 && search.data && (search.data.courses.length > 0 || search.data.teachers.length > 0) && (
        <div className="mt-12 space-y-8">
          {search.data.courses.length > 0 && (
            <section>
              <h2 className="font-display text-2xl font-semibold">{t("coursesFound")}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">{search.data.courses.map((course) => <CourseCard key={course.id} course={course} />)}</div>
            </section>
          )}
          {search.data.teachers.length > 0 && (
            <section>
              <h2 className="font-display text-2xl font-semibold">{t("teachersFound")}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{search.data.teachers.map((teacher) => <TeacherCard key={teacher.id} teacher={teacher} />)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
