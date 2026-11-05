import { Languages } from "lucide-react";
import { useLang } from "../i18n";

export function LangToggle({ dark = false }: { dark?: boolean }) {
  const { lang, setLang } = useLang();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === "en" ? "am" : "en")}
      className={`focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${
        dark ? "border-cream-50/30 text-cream-50 hover:bg-cream-50/10" : "border-navy-900/20 text-navy-900 hover:bg-navy-900/5"
      }`}
      aria-label={lang === "en" ? "አማርኛ — switch to Amharic" : "English — switch to English"}
    >
      <Languages className="h-4 w-4" aria-hidden />
      <span lang={lang === "en" ? "am" : "en"}>{lang === "en" ? "አማርኛ" : "English"}</span>
    </button>
  );
}
