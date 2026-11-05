import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, Mail, MessageSquare, ShieldCheck } from "lucide-react";
import { api, apiError } from "../api/client";
import { useLang } from "../i18n";
import { Input, Textarea } from "../components/Field";
import { btnPrimary, ErrorBox, PageHeader } from "../components/UI";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().email("Enter a valid email address"),
  message: z.string().trim().min(10, "Write at least 10 characters").max(2000, "Keep the message under 2000 characters"),
});
type FormValues = z.infer<typeof schema>;

export function Contact() {
  const { t, lang } = useLang();
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <PageHeader title={t("contactTitle")} subtitle={t("contactSub")} eyebrow={t("contactFormTitle")} />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="rounded-3xl border border-gold-600/20 bg-cream-50 p-6 shadow-sm sm:p-8">
          {sent ? (
            <div className="py-8 text-center">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-600/15 text-emerald-800"><CheckCircle2 className="h-9 w-9" aria-hidden /></span>
              <h2 className="mt-4 font-display text-2xl font-semibold">{t("messageSent")}</h2>
              <p className="mt-2 text-stone2-700">{t("messageSentBody")}</p>
            </div>
          ) : (
            <form className="space-y-4" noValidate onSubmit={handleSubmit(async (values) => {
              setServerError("");
              try {
                await api.post("/contact", values);
                setSent(true);
              } catch (error) {
                setServerError(apiError(error));
              }
            })}>
              <h2 className="font-display text-2xl font-semibold">{t("contactFormTitle")}</h2>
              <Input label={t("name")} autoComplete="name" error={errors.name?.message} {...register("name")} />
              <Input label={t("email")} type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
              <Textarea label={t("yourMessage")} error={errors.message?.message} {...register("message")} />
              {serverError && <ErrorBox message={serverError} />}
              <button type="submit" disabled={isSubmitting} className={btnPrimary}>
                <MessageSquare className="h-4 w-4" aria-hidden /> {isSubmitting ? t("loading") : t("sendMessage")}
              </button>
            </form>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-gold-600/20 bg-cream-50 p-5">
            <Mail className="h-6 w-6 text-gold-700" aria-hidden />
            <h2 className="mt-3 font-display text-lg font-semibold">{t("contactEmail")}</h2>
            <a href="mailto:hello@tewahedo.app" className="mt-1 block text-sm font-semibold text-gold-700 underline">hello@tewahedo.app</a>
            <p className="mt-2 text-sm text-stone2-700">{t("contactResponse")}</p>
          </div>
          <div className="rounded-2xl border border-gold-600/20 bg-cream-50 p-5">
            <ShieldCheck className="h-6 w-6 text-gold-700" aria-hidden />
            <h2 className="mt-3 font-display text-lg font-semibold">{t("review")}</h2>
            <p className="mt-1 text-sm leading-relaxed text-stone2-700">{t("footerNote")}</p>
          </div>
          <div className="rounded-2xl border border-gold-600/20 bg-cream-50 p-5">
            <h2 className="font-display text-lg font-semibold">{lang === "am" ? "የመልእክት ዓይነቶች" : "What to write about"}</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-stone2-700">
              <li>· {lang === "am" ? "የትምህርት ማስተካከያ" : "Corrections to a lesson"}</li>
              <li>· {lang === "am" ? "የፈቃድ ጥያቄ" : "Permission questions"}</li>
              <li>· {lang === "am" ? "የትብብር ሀሳብ" : "Partnership ideas"}</li>
              <li>· {lang === "am" ? "የቴክኒክ ችግር" : "A technical problem"}</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
