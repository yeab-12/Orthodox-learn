import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Cover } from "../components/Art";
import { Input } from "../components/Field";
import { useAuth } from "../auth/AuthContext";
import { useLang } from "../i18n";
import { apiError } from "../api/client";
import { btnPrimary } from "../components/UI";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters"),
});
const registerSchema = loginSchema
  .extend({ name: z.string().min(2, "Enter your name"), confirm: z.string() })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords do not match" });

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

function Shell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-5 py-8 md:grid-cols-2 md:py-14">
      <div className="relative hidden overflow-hidden rounded-3xl border-4 border-gold-500/70 md:block">
        <Cover variant={2} className="h-full min-h-[540px] w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/80 via-transparent to-navy-950/20" />
        <div className="absolute inset-x-0 bottom-0 p-8 text-cream-50">
          <p className="font-display text-2xl font-semibold leading-snug">“Your word is a lamp to my feet and a light to my path.”</p>
          <p className="mt-2 text-sm text-gold-300">Psalm 119:105</p>
        </div>
      </div>
      <div className="self-center">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">{title}</h1>
        <p className="mt-2 text-stone2-700">{subtitle}</p>
        <div className="mt-7">{children}</div>
        <p className="mt-6 text-sm text-stone2-700">{footer}</p>
      </div>
    </div>
  );
}

export function Login() {
  const { t } = useLang();
  const { login } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState("");
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const from = (location.state as { from?: string } | null)?.from;

  return (
    <Shell
      title={t("loginTitle")}
      subtitle={t("loginSub")}
      footer={<>{t("noAccount")} <Link className="font-semibold text-gold-700 underline" to="/register">{t("createAccount")}</Link></>}
    >
      <form className="space-y-4" noValidate onSubmit={handleSubmit(async (values) => {
        setServerError("");
        try {
          const user = await login(values.email.trim(), values.password);
          nav(from || (user.role === "admin" ? "/app/admin" : "/app"), { replace: true });
        } catch (error) {
          setServerError(apiError(error));
        }
      })}>
        <Input label={t("email")} type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <Input label={t("password")} type="password" autoComplete="current-password" error={errors.password?.message} {...register("password")} />
        <button type="submit" disabled={isSubmitting} className={`${btnPrimary} w-full`}>{isSubmitting ? t("loading") : t("login")}</button>
        {serverError && <p role="alert" className="rounded-xl bg-rubric-500/10 p-3 text-sm font-medium text-rubric-600">{serverError}</p>}
      </form>

      {import.meta.env.DEV && (
        <div className="mt-6 rounded-2xl border border-gold-600/25 bg-cream-50 p-4">
          <p className="text-sm font-semibold">{t("demoAccounts")}</p>
          <p className="mt-1 text-xs text-stone2-500">{t("adminHint")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="focus-ring rounded-full border border-navy-900/20 px-3 py-1.5 text-xs font-semibold"
              onClick={() => { setValue("email", "admin@tewahedo.app"); setValue("password", "Tewahedo2026!"); }}>
              {t("fillAdmin")}
            </button>
            <button type="button" className="focus-ring rounded-full border border-navy-900/20 px-3 py-1.5 text-xs font-semibold"
              onClick={() => { setValue("email", "student@tewahedo.app"); setValue("password", "Student2026!"); }}>
              {t("fillStudent")}
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}

export function Register() {
  const { t, lang } = useLang();
  const { register: createAccount } = useAuth();
  const nav = useNavigate();
  const [serverError, setServerError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  return (
    <Shell
      title={t("registerTitle")}
      subtitle={t("registerSub")}
      footer={<>{t("haveAccount")} <Link className="font-semibold text-gold-700 underline" to="/login">{t("login")}</Link></>}
    >
      <form className="space-y-4" noValidate onSubmit={handleSubmit(async (values) => {
        setServerError("");
        try {
          await createAccount(values.name.trim(), values.email.trim(), values.password, lang);
          nav("/app", { replace: true });
        } catch (error) {
          setServerError(apiError(error));
        }
      })}>
        <Input label={t("fullName")} autoComplete="name" error={errors.name?.message} {...register("name")} />
        <Input label={t("email")} type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <Input label={t("password")} type="password" autoComplete="new-password" hint={lang === "am" ? "ቢያንስ 8 ቁምፊ" : "At least 8 characters"} error={errors.password?.message} {...register("password")} />
        <Input label={t("confirmPassword")} type="password" autoComplete="new-password" error={errors.confirm?.message} {...register("confirm")} />
        <button type="submit" disabled={isSubmitting} className={`${btnPrimary} w-full`}>{isSubmitting ? t("loading") : t("createAccount")}</button>
        {serverError && <p role="alert" className="rounded-xl bg-rubric-500/10 p-3 text-sm font-medium text-rubric-600">{serverError}</p>}
      </form>
    </Shell>
  );
}
