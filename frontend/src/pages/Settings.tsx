import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "../types";
import { api, apiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useLang } from "../i18n";
import { Input, Select, Textarea } from "../components/Field";
import { btnPrimary, PageHeader } from "../components/UI";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  bio: z.string().trim().max(500, "Keep the bio under 500 characters").optional(),
  language: z.enum(["en", "am"]),
});
const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(8, "Use at least 8 characters").max(200),
  confirmPassword: z.string(),
}).refine((values) => values.newPassword === values.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match",
}).refine((values) => values.newPassword !== values.currentPassword, {
  path: ["newPassword"],
  message: "Choose a password that is different from the old one",
});

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export function Settings() {
  const { t } = useLang();
  const { user, setUser } = useAuth();
  const queryClient = useQueryClient();
  const [profileNotice, setProfileNotice] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? "", bio: user?.bio ?? "", language: user?.language ?? "en" },
  });
  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <PageHeader title={t("settingsTitle")} subtitle={t("settingsSub")} />

      <section className="mt-6 rounded-3xl border border-gold-600/20 bg-cream-50 p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-xl font-semibold">{t("accountSection")}</h2>
        <form
          className="mt-4 space-y-4"
          noValidate
          onSubmit={profileForm.handleSubmit(async (values) => {
            setProfileError("");
            setProfileNotice("");
            try {
              const { data } = await api.patch<{ user: User }>("/auth/me", values);
              setUser(data.user);
              queryClient.invalidateQueries({ queryKey: ["summary"] });
              setProfileNotice(t("profileUpdated"));
            } catch (error) {
              setProfileError(apiError(error));
            }
          })}
        >
          <Input label={t("fullName")} error={profileForm.formState.errors.name?.message} {...profileForm.register("name")} />
          <Input label={t("email")} value={user.email} readOnly disabled hint={t("email")} />
          <Textarea label={t("bioLabel")} error={profileForm.formState.errors.bio?.message} {...profileForm.register("bio")} />
          <Select label={t("languageLabel")} error={profileForm.formState.errors.language?.message} {...profileForm.register("language")}>
            <option value="en">{t("english")}</option>
            <option value="am">{t("amharic")}</option>
          </Select>
          {profileNotice && <p role="status" className="rounded-xl bg-emerald-600/10 p-3 text-sm font-medium text-emerald-800">{profileNotice}</p>}
          {profileError && <p role="alert" className="rounded-xl bg-rubric-500/10 p-3 text-sm font-medium text-rubric-600">{profileError}</p>}
          <button type="submit" disabled={profileForm.formState.isSubmitting} className={btnPrimary}>
            {profileForm.formState.isSubmitting ? t("saving") : t("updateProfile")}
          </button>
        </form>
      </section>

      <section className="mt-5 rounded-3xl border border-gold-600/20 bg-cream-50 p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-xl font-semibold">{t("securitySection")}</h2>
        <form
          className="mt-4 space-y-4"
          noValidate
          onSubmit={passwordForm.handleSubmit(async (values) => {
            setPasswordError("");
            setPasswordNotice("");
            try {
              const { data } = await api.patch<{ user: User }>("/auth/me", {
                currentPassword: values.currentPassword,
                newPassword: values.newPassword,
              });
              setUser(data.user);
              passwordForm.reset();
              setPasswordNotice(t("passwordUpdated"));
            } catch (error) {
              setPasswordError(apiError(error));
            }
          })}
        >
          <Input label={t("currentPassword")} type="password" autoComplete="current-password" error={passwordForm.formState.errors.currentPassword?.message} {...passwordForm.register("currentPassword")} />
          <Input label={t("newPassword")} type="password" autoComplete="new-password" error={passwordForm.formState.errors.newPassword?.message} {...passwordForm.register("newPassword")} />
          <Input label={t("confirmPassword")} type="password" autoComplete="new-password" error={passwordForm.formState.errors.confirmPassword?.message} {...passwordForm.register("confirmPassword")} />
          {passwordNotice && <p role="status" className="rounded-xl bg-emerald-600/10 p-3 text-sm font-medium text-emerald-800">{passwordNotice}</p>}
          {passwordError && <p role="alert" className="rounded-xl bg-rubric-500/10 p-3 text-sm font-medium text-rubric-600">{passwordError}</p>}
          <button type="submit" disabled={passwordForm.formState.isSubmitting} className={btnPrimary}>
            {passwordForm.formState.isSubmitting ? t("saving") : t("updatePassword")}
          </button>
        </form>
      </section>
    </div>
  );
}
