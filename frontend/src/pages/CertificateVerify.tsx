import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Award, BadgeCheck, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import type { PublicCertificate } from "../types";
import { api, apiError } from "../api/client";
import { useLang } from "../i18n";
import { btnGold, btnSecondary, Spinner } from "../components/UI";
import { displayTitle, formatDate } from "../lib/learning";

interface VerifyResponse {
  valid: boolean;
  certificate?: PublicCertificate;
}

export function CertificateVerify() {
  const { id } = useParams();
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [value, setValue] = useState("");

  const query = useQuery({
    queryKey: ["verify", id],
    queryFn: async () => (await api.get<VerifyResponse>(`/learning/verify/${encodeURIComponent(id ?? "")}`)).data,
    enabled: Boolean(id),
    retry: false,
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next = value.trim();
    if (next) navigate(`/verify/${encodeURIComponent(next)}`);
  };

  const certificate = query.data?.certificate;
  const invalid = Boolean(id) && query.isError;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link to="/" className="focus-ring inline-flex items-center gap-1 text-sm font-semibold text-gold-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {t("backHome")}
      </Link>

      <section className="mt-5 overflow-hidden rounded-3xl border border-gold-600/25 bg-cream-50 p-6 shadow-lg sm:p-8">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-navy-900 text-gold-300">
            <ShieldCheck className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-3xl font-semibold leading-tight">{t("verifyTitle")}</h1>
            <p className="mt-1 text-sm text-stone2-700">{t("verifySub")}</p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="certificate-id" className="sr-only">{t("verifyPlaceholder")}</label>
          <input
            id="certificate-id"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={t("verifyPlaceholder")}
            className="focus-ring min-h-11 w-full rounded-xl border border-navy-900/25 bg-white px-4 py-2.5 text-sm outline-none focus:border-gold-600"
          />
          <button type="submit" disabled={!value.trim()} className={btnGold}>
            <Search className="h-4 w-4" aria-hidden /> {t("verifyButton")}
          </button>
        </form>

        {id && query.isLoading && <Spinner />}

        {invalid && (
          <div role="alert" className="mt-6 rounded-2xl border border-rubric-500/30 bg-rubric-500/10 p-5 text-rubric-600">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="h-5 w-5" aria-hidden /> {t("verifyInvalid")}
            </p>
            <p className="mt-1 text-sm">{query.error ? apiError(query.error) : t("verifyNotFound")}</p>
          </div>
        )}

        {certificate && query.data?.valid && (
          <div className="mt-6 rounded-2xl border border-emerald-600/30 bg-emerald-600/10 p-5">
            <p className="flex items-center gap-2 font-semibold text-emerald-800">
              <BadgeCheck className="h-5 w-5" aria-hidden /> {t("verifyValid")}
            </p>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-stone2-500">{t("certificatePresentedTo")}</dt>
                <dd className="mt-0.5 font-display text-xl font-semibold text-navy-900">{certificate.studentName}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-stone2-500">{t("certificateCourseCompleted")}</dt>
                <dd className="mt-0.5 font-semibold text-navy-900">{displayTitle(certificate, lang)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-stone2-500">{t("certificateTeacher")}</dt>
                <dd className="mt-0.5 font-semibold text-navy-900">{certificate.teacherName}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-stone2-500">{t("certificateIssuedOn")}</dt>
                <dd className="mt-0.5 font-semibold text-navy-900">{formatDate(certificate.issuedAt, lang)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-stone2-500">{t("certificateId")}</dt>
                <dd className="mt-0.5 break-all font-mono text-xs font-semibold text-navy-900">{certificate.id}</dd>
              </div>
            </dl>
            <p className="mt-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-800">
              <Award className="h-4 w-4" aria-hidden /> Tewahedo Learn
            </p>
          </div>
        )}
      </section>

      <p className="mt-6 text-center text-sm text-stone2-600">
        <Link to="/" className={`${btnSecondary} !min-h-9 !px-4 !py-1.5 !text-xs`}>{t("backHome")}</Link>
      </p>
    </div>
  );
}
