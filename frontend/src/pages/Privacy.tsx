import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useLang } from "../i18n";
import { PageHeader, proseClass } from "../components/UI";

export function Privacy() {
  const { t, lang } = useLang();
  const am = lang === "am";
  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <PageHeader title={t("privacyTitle")} subtitle={t("privacySub")} eyebrow={`${t("lastUpdated")}: 4 November 2026`} />
      <div className={`${proseClass()} mt-6`}>
        <h2 className="font-display text-2xl font-semibold text-navy-900">{am ? "የምንሰበስበው" : "What we collect"}</h2>
        <p>{am
          ? "የመለያ ስም፣ ኢሜይል፣ የይለፍ ቃል (በሚስጥር የተቀመጠ)፣ የተሰቀሉ ፋይሎች፣ አስተያየቶች፣ የተቀመጡ ትምህርቶችና የኮርስ ሂደት።"
          : "Your name, email address, a securely hashed password, uploaded files, comments, saved lessons and course progress."}</p>
        <h2 className="font-display text-2xl font-semibold text-navy-900">{am ? "ለምን እንጠቀማለን" : "Why we use it"}</h2>
        <p>{am
          ? "መለያዎን ለማስተዳደር፣ ትምህርቶችን ለማሳየት፣ ሂደትዎን ለማስቀመጥና ስቀላዎችን ለመገምገም ብቻ። የንግድ ማስታወቂያ አናሳይም።"
          : "Only to run your account, show lessons, keep your progress and review uploads. We do not show advertising."}</p>
        <h2 className="font-display text-2xl font-semibold text-navy-900">{am ? "ማከማቻ" : "Where it is stored"}</h2>
        <p>{am
          ? "መረጃው በዚህ መተግበሪያ አገልጋይ ላይ ይቀመጣል። የመግቢያ ማስረጃዎ በአሳሽዎ localStorage ውስጥ ይቀመጣል፤ ይህን በመውጣት ማጥፋት ይችላሉ።"
          : "Data is stored on this application's server. Your login token is kept in your browser's localStorage; logging out removes it."}</p>
        <h2 className="font-display text-2xl font-semibold text-navy-900">{am ? "መብቶችዎ" : "Your choices"}</h2>
        <p>{am
          ? "መገለጫዎን ማስተካከል፣ ስቀላዎን መሰረዝ ወይም መለያዎን እንዲሰረዝ መጠየቅ ይችላሉ። በአግኙን ገጽ ያግኙን።"
          : "You can edit your profile, delete your uploads or ask for your account to be removed. Use the contact page to reach us."}</p>
        <div className="rounded-2xl border border-gold-600/25 bg-cream-50 p-5">
          <p className="flex items-start gap-3 text-sm"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold-700" aria-hidden />
            {am ? "የይለፍ ቃልዎን ከማንም ጋር አያጋሩ። አስተዳዳሪዎች የይለፍ ቃልዎን አይጠይቁዎትም።" : "Do not share your password with anyone. Administrators will never ask you for it."}
          </p>
        </div>
        <p><Link to="/contact" className="font-semibold text-gold-700 underline">{t("contactTitle")}</Link></p>
      </div>
    </div>
  );
}
