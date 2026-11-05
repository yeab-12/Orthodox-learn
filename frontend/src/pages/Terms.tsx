import { Link } from "react-router-dom";
import { useLang } from "../i18n";
import { PageHeader, proseClass } from "../components/UI";

export function Terms() {
  const { t, lang } = useLang();
  const am = lang === "am";
  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <PageHeader title={t("termsTitle")} subtitle={t("termsSub")} eyebrow={`${t("lastUpdated")}: 4 November 2026`} />
      <div className={`${proseClass()} mt-6`}>
        <h2 className="font-display text-2xl font-semibold text-navy-900">{am ? "መለያ" : "Your account"}</h2>
        <p>{am
          ? "እውነተኛ መረጃ ይጠቀሙ። መለያዎን ለሌሎች አያጋሩ። ሕግን ወይም የሌሎችን መብት የሚጥስ ድርጊት አይፈቀድም።"
          : "Use accurate information. Do not share your account. Activity that breaks the law or the rights of others is not allowed."}</p>
        <h2 className="font-display text-2xl font-semibold text-navy-900">{am ? "ስቀላዎች" : "Uploads"}</h2>
        <p>{am
          ? "የራስዎን ቅጂ ወይም የማጋራት ፈቃድ ያለዎትን ብቻ ይስቀሉ። ስቀላ ከመታተሙ በፊት ይገመገማል። ገምጋሚዎች ለምክንያት ሳይገልጹ ሊያጽድቁ ወይም ሊከለክሉ ይችላሉ።"
          : "Upload only your own recording or material you have permission to share. Uploads are reviewed before publication. Moderators may approve or decline with a reason."}</p>
        <h2 className="font-display text-2xl font-semibold text-navy-900">{am ? "አስተያየቶች" : "Comments"}</h2>
        <p>{am
          ? "አክብሮት ይኑር። ጸያፍ፣ አድልዎ ያለበት ወይም ጠቃሚ ያልሆነ አስተያየት ይወገዳል። አስተያየትዎን በራስዎ ማጥፋት ይችላሉ።"
          : "Be respectful. Abusive, discriminatory or irrelevant comments are removed. You can delete your own comments."}</p>
        <h2 className="font-display text-2xl font-semibold text-navy-900">{am ? "ትምህርታዊ ገለጻ" : "Educational purpose"}</h2>
        <p>{am
          ? "ይዘቱ ለትምህርት ብቻ ነው፤ የካህናትን ምክር አይተካም። ትክክለኛነትን ለማረጋገጥ እንጥራለን፤ ሆኖም ስህተት ሊኖር ይችላል።"
          : "The content is for education only and does not replace the counsel of your priest. We try to be accurate, but mistakes can happen."}</p>
        <h2 className="font-display text-2xl font-semibold text-navy-900">{am ? "ለውጦች" : "Changes"}</h2>
        <p>{am
          ? "እነዚህ ውሎች ሊዘመኑ ይችላሉ። መተግበሪያውን መጠቀምዎን ከቀጠሉ አዲሱን ውሎች ተቀብለዋል ማለት ነው።"
          : "These terms may be updated. Continuing to use the app means you accept the current version."}</p>
        <p><Link to="/contact" className="font-semibold text-gold-700 underline">{t("contactTitle")}</Link></p>
      </div>
    </div>
  );
}
