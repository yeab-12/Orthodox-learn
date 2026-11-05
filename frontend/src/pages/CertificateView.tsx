import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Award, BadgeCheck, Printer, ShieldCheck } from "lucide-react";
import type { Certificate } from "../types";
import { api, apiError } from "../api/client";
import { useLang } from "../i18n";
import { btnGold, btnSecondary, ErrorBox, Spinner } from "../components/UI";
import { displayTitle, formatDate } from "../lib/learning";

export function CertificateView() {
  const { id = "" } = useParams();
  const { t, lang } = useLang();

  const query = useQuery({
    queryKey: ["learning", "certificate", id],
    queryFn: async () => (await api.get<{ certificate: Certificate }>(`/learning/certificates/${id}`)).data.certificate,
  });

  if (query.isLoading) return <div className="mx-auto max-w-3xl px-4"><Spinner /></div>;
  if (query.isError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <ErrorBox message={apiError(query.error)} retry={() => query.refetch()} />
        <Link to="/app/my-learning" className={`${btnSecondary} mt-4`}>{t("myLearning")}</Link>
      </div>
    );
  }
  if (!query.data) return null;

  const certificate = query.data;
  const courseTitle = displayTitle({ title: certificate.courseTitle, titleAm: certificate.courseTitleAm }, lang);
  const teacherName = certificate.teacherName;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link to="/app/my-learning" className="focus-ring inline-flex items-center gap-1 text-sm font-semibold text-gold-700 hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden /> {t("myLearning")}
        </Link>
        <div className="flex flex-wrap gap-2">
          <Link to={`/verify/${certificate.id}`} className={btnSecondary}>
            <ShieldCheck className="h-4 w-4" aria-hidden /> {t("verifyButton")}
          </Link>
          <button type="button" onClick={() => window.print()} className={btnGold}>
            <Printer className="h-4 w-4" aria-hidden /> {t("printCertificate")}
          </button>
        </div>
      </div>

      <article className="certificate-print relative mt-5 overflow-hidden rounded-3xl border-8 border-double border-gold-600/70 bg-[#fffaf0] p-6 shadow-xl sm:p-10">
        <div className="pointer-events-none absolute inset-3 rounded-2xl border border-gold-600/35" aria-hidden />
        <div className="relative text-center">
          <p className="inline-flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.35em] text-navy-900">
            <span aria-hidden className="text-gold-700">✠</span> Tewahedo Learn
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-stone2-500">Orthodox Christian learning</p>

          <div className="mx-auto mt-5 grid h-16 w-16 place-items-center rounded-full bg-navy-900 text-gold-300">
            <Award className="h-9 w-9" aria-hidden />
          </div>
          <h1 className="mt-4 font-display text-3xl font-semibold text-navy-900 sm:text-4xl">{t("certificateOfCompletion")}</h1>

          <p className="mt-6 text-sm text-stone2-700">{t("certificatePresentedTo")}</p>
          <p className="mt-2 font-display text-3xl font-semibold text-gold-700 sm:text-4xl">{certificate.studentName}</p>

          <p className="mt-5 text-sm text-stone2-700">{t("certificateCourseCompleted")}</p>
          <p className="mx-auto mt-2 max-w-2xl font-display text-2xl font-semibold leading-snug text-navy-900">{courseTitle}</p>
          {certificate.score !== null && certificate.score !== undefined && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-600/10 px-3 py-1 text-sm font-semibold text-emerald-800">
              <BadgeCheck className="h-4 w-4" aria-hidden /> {t("bestScore")}: {certificate.score}%
            </p>
          )}

          <dl className="mx-auto mt-8 grid max-w-2xl gap-4 text-left text-sm sm:grid-cols-3">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-stone2-500">{t("certificateTeacher")}</dt>
              <dd className="mt-1 font-semibold text-navy-900">{teacherName}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-stone2-500">{t("certificateIssuedOn")}</dt>
              <dd className="mt-1 font-semibold text-navy-900">{formatDate(certificate.issuedAt, lang)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-stone2-500">{t("certificateId")}</dt>
              <dd className="mt-1 break-all font-mono text-xs font-semibold text-navy-900">{certificate.id}</dd>
            </div>
          </dl>

          <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-gold-600/25 pt-4 text-xs text-stone2-500 sm:flex-row">
            <p>{t("certificateVerifyHint")}</p>
            <p className="font-semibold uppercase tracking-widest text-gold-700">Tewahedo Learn</p>
          </div>
        </div>
      </article>

      <p className="no-print mt-4 text-center text-xs text-stone2-500">
        {t("certificateId")}: <span className="font-mono">{certificate.id}</span>
      </p>
    </div>
  );
}
