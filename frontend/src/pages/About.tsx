import { Link } from "react-router-dom";
import { BookOpen, CheckCircle2, HeartHandshake, ShieldCheck, Users } from "lucide-react";
import { useLang } from "../i18n";
import { btnPrimary, btnSecondary, PageHeader } from "../components/UI";
import { CrossMark } from "../components/Art";

export function About() {
  const { t, lang } = useLang();
  const am = lang === "am";

  const values = [
    {
      icon: ShieldCheck,
      title: am ? "የተገመገመ ይዘት" : "Reviewed content",
      body: am
        ? "እያንዳንዱ ትምህርት ከመታተሙ በፊት በአስተዳዳሪ ይታያል። ጥራትን፣ ትክክለኛነትንና ፈቃድን እንመረምራለን።"
        : "Every lesson is seen by a moderator before it is published. We check quality, accuracy and permission.",
    },
    {
      icon: BookOpen,
      title: am ? "አጭር ትምህርቶች" : "Short lessons",
      body: am
        ? "አንድ እስከ ሦስት ደቂቃ የሚቆዩ ትምህርቶች በዕለት ተዕለት ሕይወትዎ ውስጥ ቀላል ሆነው እንዲገኙ ተደርገዋል።"
        : "Lessons of one to three minutes are designed to fit into ordinary daily life.",
    },
    {
      icon: Users,
      title: am ? "ለሁሉም ቤተሰብ" : "For the whole family",
      body: am
        ? "ለደብር፣ ለሰንበት ት/ቤትና ለቤት ጥቅም የተዘጋጀ። ወላጆችና አስተማሪዎች በአንድ ቦታ ማግኘት ይችላሉ።"
        : "Built for parish, Sunday school and home, so parents and teachers can find good material in one place.",
    },
    {
      icon: HeartHandshake,
      title: am ? "ለመምህራን ክፍት" : "Open to teachers",
      body: am
        ? "የራስዎን ትምህርት ወይም ድምጽ ማስቀመጥ ይችላሉ። አስተዳዳሪ ካጸደቀ በኋላ ለሁሉም ይታያል።"
        : "You can upload your own lesson or audio recording. After a moderator approves it, it appears to everyone.",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <div className="grid items-center gap-8 md:grid-cols-[1fr_200px]">
        <PageHeader title={t("aboutTitle")} subtitle={t("aboutSub")} eyebrow={t("review")} />
        <div className="mx-auto grid h-40 w-40 place-items-center rounded-full border-4 border-gold-500/70 bg-navy-900">
          <CrossMark className="h-24 w-24 text-gold-400" />
        </div>
      </div>

      <section className="mt-10 rounded-3xl border border-gold-600/20 bg-cream-50 p-6 shadow-sm sm:p-8">
        <h2 className="font-display text-2xl font-semibold">{am ? "ስለ እኛ" : "What this is"}</h2>
        <p className="mt-3 leading-relaxed text-stone2-700">
          {am
            ? "ተዋሕዶ ትምህርት ለኦርቶዶክስ ተዋሕዶ ክርስቲያኖች አጫጭር፣ የተገመገሙና ጠቃሚ ትምህርቶችን የሚያቀርብ ትንሽ መድረክ ነው። ግባችን ጩኸት የሌለው፣ ጸሎትንና ትምህርትን የሚያበረታታ ቦታ መስጠት ነው።"
            : "Tewahedo Learn is a small platform for short, reviewed and useful lessons for Orthodox Tewahedo Christians. Our aim is a quiet place that encourages prayer and learning."}
        </p>
        <p className="mt-3 leading-relaxed text-stone2-700">
          {am
            ? "እዚህ ያለው ይዘት የመጀመሪያ ደረጃ ትምህርት ነው፤ የካህናትንና የመንፈሳዊ አባቶችን ምክር አይተካም። ወሳኝ ጥያቄዎችን ለካህንዎ ያቅርቡ።"
            : "The material here is introductory teaching; it does not replace the counsel of your priest or spiritual father. Bring important questions to your priest."}
        </p>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        {values.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border border-gold-600/20 bg-cream-50 p-5 shadow-sm">
            <Icon className="h-6 w-6 text-gold-700" aria-hidden />
            <h3 className="mt-3 font-display text-xl font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-stone2-700">{body}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 rounded-3xl bg-navy-950 p-6 text-cream-50 sm:p-8">
        <h2 className="font-display text-2xl font-semibold">{t("howItWorks")}</h2>
        <ol className="mt-5 grid gap-4 md:grid-cols-3">
          {[[t("step1Title"), t("step1Body")], [t("step2Title"), t("step2Body")], [t("step3Title"), t("step3Body")]].map(([title, body], index) => (
            <li key={title} className="rounded-2xl border border-gold-500/25 bg-navy-900 p-5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-gold-500 font-display font-bold text-navy-950" aria-hidden>{index + 1}</span>
              <h3 className="mt-3 font-display text-lg font-semibold">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-cream-200/85">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-gold-600/25 bg-gold-500/10 p-6">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl font-semibold"><CheckCircle2 className="h-6 w-6 text-gold-700" aria-hidden /> {t("ctaTitle")}</h2>
          <p className="mt-1 text-sm text-stone2-700">{t("ctaSub")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/register" className={btnPrimary}>{t("createAccount")}</Link>
          <Link to="/contact" className={btnSecondary}>{t("contactTitle")}</Link>
        </div>
      </section>
    </div>
  );
}
