import { Link, NavLink, Outlet } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { Logo } from "../components/Logo";
import { LangToggle } from "../components/LangToggle";
import { useAuth } from "../auth/AuthContext";
import { useLang } from "../i18n";
import { btnPrimary } from "../components/UI";

export function PublicLayout() {
  const { t } = useLang();
  const { user } = useAuth();
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-full focus:bg-navy-900 focus:px-4 focus:py-2 focus:text-cream-50">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-gold-600/15 bg-cream-50/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <Logo />
          <nav aria-label="Main" className="flex items-center gap-1 sm:gap-3">
            <NavLink to="/about" className="focus-ring hidden rounded-full px-3 py-2 text-sm font-semibold hover:bg-navy-900/5 sm:block">{t("footerAbout")}</NavLink>
            <NavLink to="/contact" className="focus-ring hidden rounded-full px-3 py-2 text-sm font-semibold hover:bg-navy-900/5 sm:block">{t("footerContact")}</NavLink>
            <LangToggle />
            {user ? (
              <Link to="/app" className={btnPrimary}>{t("openApp")}</Link>
            ) : (
              <>
                <Link to="/login" className="focus-ring rounded-full px-3 py-2 text-sm font-semibold hover:bg-navy-900/5">{t("login")}</Link>
                <Link to="/register" className={`${btnPrimary} hidden sm:inline-flex`}>{t("register")}</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1"><Outlet /></main>
      <footer className="bg-navy-950 text-cream-200">
        <div className="manuscript-band" />
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo light />
            <p className="mt-3 max-w-xs text-sm text-cream-300/85">{t("footerNote")}</p>
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-gold-400">{t("footerExplore")}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link to="/app/explore" className="hover:text-gold-300">{t("explore")}</Link></li>
              <li><Link to="/app/courses" className="hover:text-gold-300">{t("courses")}</Link></li>
              <li><Link to="/app/teachers" className="hover:text-gold-300">{t("teachers")}</Link></li>
              <li><Link to="/register" className="hover:text-gold-300">{t("createAccount")}</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-gold-400">{t("footerAbout")}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link to="/about" className="hover:text-gold-300">{t("aboutTitle")}</Link></li>
              <li><Link to="/contact" className="hover:text-gold-300">{t("contactTitle")}</Link></li>
              <li><Link to="/app" className="hover:text-gold-300">{t("openApp")}</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-gold-400">{t("footerPrivacy")}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link to="/privacy" className="hover:text-gold-300">{t("privacyTitle")}</Link></li>
              <li><Link to="/terms" className="hover:text-gold-300">{t("termsTitle")}</Link></li>
            </ul>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-gold-500/30 px-3 py-1 text-xs text-gold-300">
              <BookOpen className="h-3.5 w-3.5" aria-hidden /> {t("review")}
            </p>
          </div>
        </div>
        <div className="border-t border-cream-50/10 py-4 text-center text-xs text-cream-300/70">
          © {new Date().getFullYear()} Tewahedo Learn · {t("demoNote")}
        </div>
      </footer>
    </div>
  );
}
