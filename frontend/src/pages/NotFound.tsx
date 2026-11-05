import { Link } from "react-router-dom";
import { useLang } from "../i18n";
import { btnPrimary } from "../components/UI";

export function NotFound() {
  const { t } = useLang();
  return (
    <div className="mx-auto max-w-md px-5 py-24 text-center">
      <p className="font-display text-6xl font-semibold text-gold-600">404</p>
      <h1 className="mt-3 font-display text-3xl font-semibold">{t("notFoundTitle")}</h1>
      <p className="mt-2 text-stone2-700">{t("notFoundBody")}</p>
      <Link to="/" className={`${btnPrimary} mt-6`}>{t("goHome")}</Link>
    </div>
  );
}
