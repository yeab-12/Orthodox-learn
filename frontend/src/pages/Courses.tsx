import { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Category, Course } from "../types";
import { api, apiError } from "../api/client";
import { CourseCard } from "../components/CourseCard";
import { useLang } from "../i18n";
import { difficultyKey } from "../lib/learning";
import { btnSecondary, EmptyState, ErrorBox, PageHeader, Spinner } from "../components/UI";

const difficulties = ["beginner", "intermediate", "advanced"] as const;

export function Courses() {
  const { t, lang } = useLang();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [language, setLanguage] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [sort, setSort] = useState("newest");

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get<{ categories: Category[] }>("/categories")).data.categories,
  });

  const courses = useQuery({
    queryKey: ["courses", { query, categoryId, language, difficulty, sort }],
    queryFn: async () =>
      (
        await api.get<{ courses: Course[] }>("/courses", {
          params: {
            q: query || undefined,
            categoryId: categoryId === "all" ? undefined : categoryId,
            language: language === "all" ? undefined : language,
            difficulty: difficulty === "all" ? undefined : difficulty,
            sort,
          },
        })
      ).data.courses,
  });

  const mine = useQuery({
    queryKey: ["courses", "enrolled"],
    queryFn: async () =>
      (await api.get<{ courses: Course[] }>("/courses", { params: { enrolled: "true", sort: "newest" } })).data.courses,
  });

  const all = courses.data ?? [];
  const enrolled = (mine.data ?? []).filter((course) => course.enrolled);
  const hasFilters = Boolean(query || categoryId !== "all" || language !== "all" || difficulty !== "all");

  const clearFilters = () => {
    setSearch("");
    setQuery("");
    setCategoryId("all");
    setLanguage("all");
    setDifficulty("all");
    setSort("newest");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader title={t("coursesTitle")} subtitle={t("coursesSub")} />

      {enrolled.length > 0 && (
        <section className="mt-8">
          <div className="flex items-end justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold">{t("continueLearning")}</h2>
            <span className="text-sm font-medium text-stone2-500">{enrolled.length} {t("coursesFound")}</span>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {enrolled.slice(0, 4).map((course) => <CourseCard key={course.id} course={course} />)}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">{t("browseCourses")}</h2>

        <form
          className="mt-4 rounded-2xl border border-gold-600/20 bg-cream-50 p-3 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search.trim());
          }}
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">{t("search")}</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone2-500" aria-hidden />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("searchCoursesPlaceholder")}
                className="focus-ring min-h-11 w-full rounded-xl border border-navy-900/20 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-gold-600"
              />
            </label>
            <button type="submit" className={btnSecondary}>{t("search")}</button>
          </div>

          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            <label className="text-xs font-semibold text-stone2-700">
              <span className="sr-only">{t("categoryLabel")}</span>
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="focus-ring mt-1 w-full rounded-xl border border-navy-900/20 bg-white px-3 py-2 text-sm">
                <option value="all">{t("allCategories")}</option>
                {categories.data?.map((category) => (
                  <option key={category.id} value={category.id}>{lang === "am" ? category.am : category.en}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-stone2-700">
              <span className="sr-only">{t("languageLabel")}</span>
              <select value={language} onChange={(event) => setLanguage(event.target.value)} className="focus-ring mt-1 w-full rounded-xl border border-navy-900/20 bg-white px-3 py-2 text-sm">
                <option value="all">{t("allLanguages")}</option>
                <option value="en">{t("english")}</option>
                <option value="am">{t("amharic")}</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-stone2-700">
              <span className="sr-only">{t("difficultyLabel")}</span>
              <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className="focus-ring mt-1 w-full rounded-xl border border-navy-900/20 bg-white px-3 py-2 text-sm">
                <option value="all">{t("allDifficulties")}</option>
                {difficulties.map((value) => <option key={value} value={value}>{t(difficultyKey(value))}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-stone2-700">
              <span className="sr-only">{t("sortLabel")}</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)} className="focus-ring mt-1 w-full rounded-xl border border-navy-900/20 bg-white px-3 py-2 text-sm">
                <option value="newest">{t("sortNewest")}</option>
                <option value="oldest">{t("sortOldest")}</option>
                <option value="title">{t("sortTitle")}</option>
                <option value="ordering">{t("sortOrder")}</option>
              </select>
            </label>
          </div>
        </form>

        {courses.isLoading && <Spinner />}
        {courses.isError && <ErrorBox message={apiError(courses.error)} retry={() => courses.refetch()} />}

        {courses.data && all.length === 0 && (
          <div className="mt-6">
            <EmptyState
              title={hasFilters ? t("noCourseResults") : t("noCourses")}
              body={hasFilters ? t("noCourseResultsBody") : undefined}
              action={hasFilters ? <button type="button" onClick={clearFilters} className={btnSecondary}><SlidersHorizontal className="h-4 w-4" aria-hidden /> {t("clearFilters")}</button> : undefined}
            />
          </div>
        )}

        {all.length > 0 && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {all.map((course) => <CourseCard key={course.id} course={course} />)}
          </div>
        )}
      </section>
    </div>
  );
}
