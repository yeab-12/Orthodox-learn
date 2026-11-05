import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { AlertCircle, Loader2, SearchX } from "lucide-react";
import type { Role, VideoStatus } from "../types";

export const btnPrimary =
  "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-navy-900 px-5 py-2.5 text-sm font-semibold text-cream-50 transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50";
export const btnGold =
  "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-gold-500 px-5 py-2.5 text-sm font-semibold text-navy-950 transition hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50";
export const btnSecondary =
  "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-navy-900/25 bg-white px-5 py-2.5 text-sm font-semibold text-navy-900 transition hover:bg-cream-200 disabled:cursor-not-allowed disabled:opacity-50";
export const btnDanger =
  "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-rubric-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rubric-600 disabled:cursor-not-allowed disabled:opacity-50";
export const inputClass =
  "focus-ring mt-1 w-full rounded-xl border border-navy-900/25 bg-white px-4 py-3 text-navy-900 outline-none focus:border-gold-600";
export const cardClass = "rounded-2xl border border-gold-600/20 bg-cream-50 p-5 shadow-sm shadow-navy-900/5";
export const labelClass = "block text-sm font-semibold text-navy-900";

export function PageHeader({ title, subtitle, actions, eyebrow }: {
  title: string; subtitle?: string; actions?: ReactNode; eyebrow?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.18em] text-rubric-600">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-stone2-700">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-stone2-700" role="status">
      <Loader2 className="h-5 w-5 animate-spin text-gold-600" aria-hidden />
      <span>{label ?? "Loading…"}</span>
    </div>
  );
}

export function PageLoader() {
  return <div className="mx-auto max-w-6xl px-4 py-10"><Spinner /></div>;
}

export function ErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div role="alert" className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-rubric-500/30 bg-rubric-500/10 p-4 text-rubric-600">
      <AlertCircle className="h-5 w-5 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 text-sm font-medium">{message}</p>
      {retry && <button type="button" onClick={retry} className="focus-ring rounded-full border border-rubric-500/40 px-4 py-1.5 text-sm font-semibold">Try again</button>}
    </div>
  );
}

export function EmptyState({ title, body, action, icon }: { title: string; body?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-navy-900/20 bg-cream-50 px-6 py-14 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-cream-200 text-gold-700">
        {icon ?? <SearchX className="h-7 w-7" aria-hidden />}
      </div>
      <h2 className="mt-4 font-display text-2xl font-semibold">{title}</h2>
      {body && <p className="mx-auto mt-2 max-w-md text-stone2-700">{body}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-navy-900 font-display font-semibold text-gold-300"
      style={{ width: size, height: size, fontSize: Math.max(14, size * 0.4) }}
      aria-hidden
    >
      {initial}
    </span>
  );
}

const roleStyle: Record<Role, string> = {
  student: "bg-cream-200 text-navy-900",
  teacher: "bg-gold-500/25 text-gold-700",
  admin: "bg-rubric-500/15 text-rubric-600",
};

export function RoleBadge({ role }: { role: Role }) {
  const label = role === "admin" ? "Admin" : role === "teacher" ? "Teacher" : "Student";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${roleStyle[role]}`}>{label}</span>;
}

const statusStyle: Record<VideoStatus, string> = {
  pending: "bg-gold-500/20 text-gold-700",
  approved: "bg-emerald-600/15 text-emerald-800",
  rejected: "bg-rubric-500/15 text-rubric-600",
};

export function StatusPill({ status }: { status: VideoStatus }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[status]}`}>{status}</span>;
}

export function DemoBadge({ label = "Demo" }: { label?: string }) {
  return <span className="rounded-full bg-rubric-500/15 px-2.5 py-1 text-xs font-semibold text-rubric-600">{label}</span>;
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className="focus-ring inline-flex items-center gap-1 text-sm font-semibold text-gold-700 hover:underline">{children}</Link>;
}

export function proseClass() {
  return "space-y-4 text-stone2-700 leading-relaxed";
}
