import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Cover } from "../components/Art";
import { VideoCard } from "../components/VideoCard";
import { useLang } from "../i18n";
import { api, apiError } from "../api/client";
import type { Category, Video } from "../types";
import { btnPrimary, btnSecondary, ErrorBox, Spinner } from "../components/UI";

export function Landing() {
  const { t, lang } = useLang();
  const featured = useQuery({
    queryKey: ["videos", "featured"],
    queryFn: async () => (await api.get<{ videos: Video[] }>("/videos", { params: { limit: 4 } })).data.videos,
  });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get<{ categories: Category[] }>("/categories")).data.categories,
  });

  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-14 pt-8 md:grid-cols-[1.05fr_0.95fr] md:pt-14">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-gold-600/30 bg-cream-50 px-3 py-1 text-xs font-semibold text-gold-700">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />{t("review")}
          </span>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">{t("heroTitle")}</h1>
          <p className="mt-5 max-w-lg text-lg text-stone2-700">{t("heroSub")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/register" className={btnPrimary}>{t("start")} <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            <Link to="/app/explore" className={btnSecondary}>{t("browse")}</Link>
          </div>
          <p className="mt-6 text-sm font-medium text-stone2-500">{t("trustLine")}</p>
        </div>
        <div className="mx-auto w-full max-w-sm">
          <div className="overflow-hidden rounded-t-[999px] rounded-b-2xl border-[6px] border-gold-500 bg-navy-900 shadow-2xl shadow-navy-900/25">
            <Cover variant={0} className="aspect-[3/4.4] w-full" />
          </div>
        </div>
      </section>

      <div className="manuscript-band" />

      <section className="bg-cream-50 py-14">
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-3xl font-semibold">{t("featuredTitle")}</h2>
              <p className="mt-1 text-stone2-700">{t("featuredSub")}</p>
            </div>
            <Link to="/app/explore" className="focus-ring inline-flex items-center gap-1 text-sm font-semibold text-gold-700 hover:underline">{t("seeAll")} <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </div>
          {featured.isLoading && <Spinner />}
          {featured.isError && <ErrorBox message={apiError(featured.error)} retry={() => featured.refetch()} />}
          {featured.data && featured.data.length === 0 && <p className="mt-6 text-stone2-700">{t("noVideos")}</p>}
          {featured.data && featured.data.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {featured.data.map((video) => <VideoCard key={video.id} video={video} />)}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="font-display text-3xl font-semibold">{t("whatLearn")}</h2>
        {categories.isLoading && <Spinner />}
        {categories.data && (
          <ul className="mt-6 flex flex-wrap gap-2.5">
            {categories.data.map((category) => (
              <li key={category.id} className="rounded-full border border-gold-600/40 bg-cream-50 px-4 py-2 text-sm font-medium">
                {lang === "am" ? category.am : category.en}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-navy-950 py-16 text-cream-50">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="font-display text-3xl font-semibold">{t("howItWorks")}</h2>
          <ol className="mt-8 grid gap-5 md:grid-cols-3">
            {[
              [t("step1Title"), t("step1Body")],
              [t("step2Title"), t("step2Body")],
              [t("step3Title"), t("step3Body")],
            ].map(([heading, body], index) => (
              <li key={heading} className="rounded-2xl border border-gold-500/25 bg-navy-900 p-6">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-gold-500 font-display text-lg font-bold text-navy-950" aria-hidden>{index + 1}</span>
                <h3 className="mt-4 font-display text-xl font-semibold">{heading}</h3>
                <p className="mt-2 text-sm leading-relaxed text-cream-200/85">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-16 text-center">
        <h2 className="font-display text-3xl font-semibold sm:text-4xl">{t("ctaTitle")}</h2>
        <p className="mx-auto mt-3 max-w-xl text-stone2-700">{t("ctaSub")}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link to="/register" className={btnPrimary}>{t("createAccount")}</Link>
          <Link to="/login" className={btnSecondary}>{t("login")}</Link>
        </div>
      </section>
    </>
  );
}
