import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2, ChevronDown, ChevronUp, FileAudio, FileVideo,
  Info, Loader2, Play, RotateCcw, ShieldCheck, Trash2, UploadCloud, X, XCircle,
} from "lucide-react";
import type { Category, Course, Lang, Video } from "../types";
import { api, apiError } from "../api/client";
import { useLang } from "../i18n";
import { Input, Select, Textarea } from "../components/Field";
import { Cover } from "../components/Art";
import { btnPrimary, btnSecondary, ErrorBox, PageHeader } from "../components/UI";
import { formatDuration } from "../data/mock";

const FALLBACK_MAX_MB = 200;
const FALLBACK_MAX_SECONDS = 300;
const FALLBACK_EXTENSIONS = [".mp4", ".webm", ".mov", ".m4v", ".mkv", ".ogv", ".ogg", ".mp3", ".m4a", ".wav", ".aac"];

type ItemStatus = "queued" | "checking" | "ready" | "uploading" | "success" | "error" | "canceled";

interface QueueItem {
  id: string;
  file: File;
  title: string;
  titleAm: string;
  description: string;
  descriptionAm: string;
  categoryId: string;
  language: Lang;
  courseId: string;
  cover: number;
  durationSec: number | null;
  status: ItemStatus;
  progress: number;
  error: string;
  // Validation failures (wrong type, too large, too long) must never be
  // retried as-is. Only network or server failures can be retried.
  retryable: boolean;
  serverId?: string;
  expanded: boolean;
}

interface UploadLimits {
  maxMb: number;
  maxDurationSec: number;
  extensions: string[];
  accept: string;
}

function uid() {
  return `f_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function titleFromFileName(name: string) {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function probeDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const element = document.createElement(file.type.startsWith("audio/") ? "audio" : "video");
    const cleanup = () => {
      URL.revokeObjectURL(url);
      element.removeAttribute("src");
    };
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("The media duration could not be read."));
    }, 20_000);
    element.preload = "metadata";
    element.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const duration = element.duration;
      cleanup();
      if (!Number.isFinite(duration) || duration <= 0) reject(new Error("The media duration could not be read."));
      else resolve(duration);
    };
    element.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      reject(new Error("This file could not be opened as video or audio."));
    };
    element.src = url;
  });
}

function formatSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const statusStyles: Record<ItemStatus, string> = {
  queued: "bg-cream-200 text-navy-900",
  checking: "bg-gold-500/20 text-gold-700",
  ready: "bg-navy-900/10 text-navy-900",
  uploading: "bg-gold-500/25 text-gold-700",
  success: "bg-emerald-600/15 text-emerald-800",
  error: "bg-rubric-500/15 text-rubric-600",
  canceled: "bg-stone2-500/15 text-stone2-700",
};

export function UploadPage() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const itemsRef = useRef<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [concurrency, setConcurrency] = useState(2);
  const concurrencyRef = useRef(2);
  const [defaults, setDefaults] = useState({ categoryId: "", language: "en" as Lang, courseId: "", cover: 0 });
  const defaultsRef = useRef(defaults);
  const runningRef = useRef(new Set<string>());
  const abortRef = useRef(new Map<string, AbortController>());
  const batchIdRef = useRef("");

  const limits = useQuery({
    queryKey: ["upload-limits"],
    queryFn: async () => (await api.get<UploadLimits>("/uploads/limits")).data,
    staleTime: 10 * 60 * 1000,
  });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await api.get<{ categories: Category[] }>("/categories")).data.categories,
  });
  const courses = useQuery({
    queryKey: ["courses"],
    queryFn: async () => (await api.get<{ courses: Course[] }>("/courses")).data.courses,
  });

  const maxMb = limits.data?.maxMb ?? FALLBACK_MAX_MB;
  const maxSeconds = limits.data?.maxDurationSec ?? FALLBACK_MAX_SECONDS;
  const accept = limits.data?.accept ?? "video/*,audio/*";
  const allowedExtensions = useMemo(() => {
    const list = limits.data?.extensions?.length ? limits.data.extensions : FALLBACK_EXTENSIONS;
    return new Set(list.map((ext) => ext.toLowerCase()));
  }, [limits.data]);

  useEffect(() => { concurrencyRef.current = concurrency; }, [concurrency]);
  useEffect(() => { defaultsRef.current = defaults; }, [defaults]);

  const commit = useCallback((updater: (current: QueueItem[]) => QueueItem[]) => {
    const next = updater(itemsRef.current);
    itemsRef.current = next;
    setItems(next);
  }, []);

  const update = useCallback((id: string, patch: Partial<QueueItem>) => {
    commit((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, [commit]);

  const probeItem = useCallback(async (id: string, file: File) => {
    const settle = (patch: Partial<QueueItem>) => {
      commit((current) => current.map((item) => (
        item.id === id && item.status === "checking" ? { ...item, retryable: false, ...patch } : item
      )));
    };
    try {
      const duration = await probeDuration(file);
      if (duration > maxSeconds) {
        settle({ status: "error", durationSec: duration, error: t("durationError") });
      } else {
        settle({ status: "ready", durationSec: duration });
      }
    } catch (probeError) {
      settle({
        status: "error",
        error: probeError instanceof Error ? probeError.message : t("durationError"),
      });
    }
  }, [commit, maxSeconds, t]);

  const addFiles = useCallback((files: File[]) => {
    if (!files.length) return;
    setError("");
    setNotice("");
    const base = defaultsRef.current;
    const existing = itemsRef.current.length;
    const additions: QueueItem[] = [];
    const toProbe: { id: string; file: File }[] = [];

    files.forEach((file, index) => {
      const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
      const id = uid();
      const item: QueueItem = {
        id,
        file,
        title: titleFromFileName(file.name),
        titleAm: "",
        description: "",
        descriptionAm: "",
        categoryId: base.categoryId,
        language: base.language,
        courseId: base.courseId,
        cover: (existing + index) % 4,
        durationSec: null,
        status: "queued",
        progress: 0,
        error: "",
        retryable: false,
        expanded: false,
      };
      if (!allowedExtensions.has(extension)) {
        additions.push({ ...item, status: "error", error: `${t("invalidType")} ${Array.from(allowedExtensions).join(", ")}` });
        return;
      }
      if (file.size > maxMb * 1024 * 1024) {
        additions.push({ ...item, status: "error", error: `${t("fileTooLarge")} (${maxMb} MB)` });
        return;
      }
      additions.push({ ...item, status: "checking" });
      toProbe.push({ id, file });
    });

    commit((current) => [...current, ...additions]);
    for (const entry of toProbe) void probeItem(entry.id, entry.file);
  }, [allowedExtensions, commit, maxMb, probeItem, t]);

  const applyDefaults = useCallback(() => {
    const base = defaultsRef.current;
    commit((current) => current.map((item) => {
      if (item.status === "success" || item.status === "uploading") return item;
      return { ...item, categoryId: base.categoryId || item.categoryId, language: base.language, courseId: base.courseId };
    }));
  }, [commit]);

  const removeItem = useCallback((id: string) => {
    abortRef.current.get(id)?.abort();
    abortRef.current.delete(id);
    runningRef.current.delete(id);
    commit((current) => current.filter((item) => item.id !== id));
  }, [commit]);

  async function uploadItem(id: string) {
    const item = itemsRef.current.find((entry) => entry.id === id);
    if (!item || item.durationSec === null) return;
    if (runningRef.current.has(id)) return;
    runningRef.current.add(id);
    const controller = new AbortController();
    abortRef.current.set(id, controller);
    update(id, { status: "uploading", progress: 0, error: "" });

    const form = new FormData();
    form.append("file", item.file);
    form.append("title", item.title.trim());
    form.append("titleAm", item.titleAm.trim());
    form.append("description", item.description.trim());
    form.append("descriptionAm", item.descriptionAm.trim());
    form.append("categoryId", item.categoryId);
    form.append("language", item.language);
    form.append("courseId", item.courseId);
    form.append("cover", String(item.cover));
    form.append("durationSec", String(item.durationSec));
    form.append("batchId", batchIdRef.current);

    try {
      const { data } = await api.post<{ video: Video }>("/uploads", form, {
        signal: controller.signal,
        onUploadProgress: (event) => {
          if (event.total) update(id, { progress: Math.min(100, Math.round((event.loaded / event.total) * 100)) });
        },
      });
      update(id, { status: "success", progress: 100, serverId: data.video.id, retryable: false, expanded: false });
      queryClient.invalidateQueries({ queryKey: ["my-uploads"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
    } catch (uploadError) {
      if (axios.isCancel(uploadError) || controller.signal.aborted) {
        update(id, { status: "canceled", progress: 0, retryable: true });
      } else {
        update(id, { status: "error", error: apiError(uploadError), retryable: true });
      }
    } finally {
      runningRef.current.delete(id);
      abortRef.current.delete(id);
      pump();
    }
  }

  function pump() {
    const capacity = Math.max(0, concurrencyRef.current - runningRef.current.size);
    if (capacity <= 0) return;
    const candidates = itemsRef.current
      .filter((item) => item.status === "ready" && !runningRef.current.has(item.id))
      .slice(0, capacity);
    for (const candidate of candidates) void uploadItem(candidate.id);
  }

  const start = () => {
    setError("");
    setNotice("");
    if (!agreed) {
      setError(t("agreement"));
      return;
    }
    const base = defaultsRef.current;
    const ready = itemsRef.current.filter((item) => item.status === "ready");
    if (!ready.length) {
      setError(t("noReadyFiles"));
      return;
    }
    if (ready.some((item) => !(item.categoryId || base.categoryId))) {
      setError(t("categoryRequired"));
      return;
    }
    const titles = new Set<string>();
    for (const item of ready) {
      const index = itemsRef.current.findIndex((entry) => entry.id === item.id);
      if (index < 0) continue;
      const title = item.title.trim() || titleFromFileName(item.file.name);
      if (title.length < 3) {
        setError(`${t("titleLabel")}: ${item.file.name}`);
        return;
      }
      if (titles.has(title)) {
        setError(`${t("titleLabel")}: ${title}`);
        return;
      }
      titles.add(title);
    }

    commit((current) => current.map((item) => {
      if (item.status !== "ready") return item;
      return {
        ...item,
        title: item.title.trim() || titleFromFileName(item.file.name),
        categoryId: item.categoryId || base.categoryId,
        courseId: item.courseId || base.courseId,
      };
    }));
    batchIdRef.current = `batch_${Date.now()}`;
    setNotice(t("batchStarted"));
    pump();
  };

  const retryOne = (id: string) => {
    const item = itemsRef.current.find((entry) => entry.id === id);
    if (!item || !item.retryable || item.durationSec === null) return;
    update(id, { status: "ready", error: "", retryable: false, progress: 0 });
    pump();
  };

  const retryFailed = () => {
    commit((current) => current.map((item) => {
      if (!item.retryable || item.durationSec === null) return item;
      return { ...item, status: "ready", error: "", retryable: false, progress: 0 };
    }));
    pump();
  };

  const cancelItem = (id: string) => {
    abortRef.current.get(id)?.abort();
    const item = itemsRef.current.find((entry) => entry.id === id);
    if (item && item.status !== "success") update(id, { status: "canceled", progress: 0 });
  };

  const cancelAll = () => {
    for (const controller of abortRef.current.values()) controller.abort();
    commit((current) => current.map((item) => (
      item.status === "success" ? item : { ...item, status: "canceled", progress: 0 }
    )));
    setNotice(t("cancelAll"));
  };

  const clearFinished = () => {
    commit((current) => current.filter((item) => item.status !== "success"));
  };

  const counts = useMemo(() => ({
    total: items.length,
    ready: items.filter((item) => item.status === "ready").length,
    uploading: items.filter((item) => item.status === "uploading").length,
    success: items.filter((item) => item.status === "success").length,
    failed: items.filter((item) => item.status === "error").length,
    checking: items.filter((item) => item.status === "checking").length,
    retryable: items.filter((item) => item.retryable && item.durationSec !== null).length,
  }), [items]);

  const overall = items.length
    ? Math.round(items.reduce((sum, item) => sum + (item.status === "success" ? 100 : item.progress), 0) / items.length)
    : 0;

  const statusLabel = (status: ItemStatus) => ({
    queued: t("queued"),
    checking: t("checking"),
    ready: t("ready"),
    uploading: t("uploading"),
    success: t("uploaded"),
    error: t("failed"),
    canceled: t("canceled"),
  })[status];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader
        title={t("bulkUploadTitle")}
        subtitle={t("bulkUploadSub")}
        actions={<Link to="/app/my-uploads" className={btnSecondary}>{t("myUploads")}</Link>}
      />

      {notice && <p role="status" className="mt-4 rounded-xl border border-emerald-600/25 bg-emerald-600/10 p-3 text-sm font-medium text-emerald-800">{notice}</p>}
      {error && <ErrorBox message={error} />}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              addFiles(Array.from(event.dataTransfer.files));
            }}
            className={`rounded-3xl border-2 border-dashed p-6 text-center transition ${dragging ? "border-gold-600 bg-gold-500/10" : "border-gold-600/40 bg-cream-50"}`}
          >
            <UploadCloud className="mx-auto h-10 w-10 text-gold-700" aria-hidden />
            <p className="mt-2 font-display text-lg font-semibold">{t("dropFiles")}</p>
            <p className="mt-1 text-xs text-stone2-500">
              {Array.from(allowedExtensions).join(", ")} · {t("fileHint")} · {maxSeconds / 60} min
            </p>
            <button type="button" onClick={() => fileInput.current?.click()} className={`${btnPrimary} mt-4`}>
              <UploadCloud className="h-4 w-4" aria-hidden /> {t("addFiles")}
            </button>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={accept}
              className="sr-only"
              onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }}
            />
          </div>

          <section className="rounded-3xl border border-gold-600/20 bg-cream-50 p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold">{t("queueTitle")}</h2>
              <span className="rounded-full bg-cream-200 px-3 py-1 text-xs font-semibold">{t("filesLabel", { count: counts.total })}</span>
            </div>

            {items.length === 0 && <p className="mt-4 rounded-2xl border border-dashed border-navy-900/20 p-6 text-center text-sm text-stone2-700">{t("queueEmpty")}</p>}

            {items.length > 0 && (
              <>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>{t("overallProgress")}</span>
                    <span>{overall}%</span>
                  </div>
                  <div className="mt-1 h-2.5 rounded-full bg-cream-200" role="progressbar" aria-valuenow={overall} aria-valuemin={0} aria-valuemax={100} aria-label={t("overallProgress")}>
                    <div className="h-full rounded-full bg-gold-500 transition-all" style={{ width: `${overall}%` }} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-stone2-700">
                    <span>{t("readyLabel", { count: counts.ready })}</span>
                    <span>{t("successLabel", { count: counts.success })}</span>
                    <span>{t("failedLabel", { count: counts.failed + (items.filter((item) => item.status === "canceled").length) })}</span>
                  </div>
                </div>

                <ul className="mt-4 space-y-3">
                  {items.map((item) => (
                    <li key={item.id} className={`rounded-2xl border p-4 ${item.status === "error" ? "border-rubric-500/30 bg-rubric-500/5" : "border-gold-600/20 bg-white"}`}>
                      <div className="flex items-start gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-navy-900 text-gold-300">
                          {item.file.type.startsWith("audio/") ? <FileAudio className="h-5 w-5" aria-hidden /> : <FileVideo className="h-5 w-5" aria-hidden />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold" title={item.file.name}>{item.title || item.file.name}</p>
                          <p className="text-xs text-stone2-500">
                            {formatSize(item.file.size)}
                            {item.durationSec !== null ? ` · ${formatDuration(item.durationSec)}` : ""}
                            {item.error ? ` · ${item.error}` : ""}
                          </p>
                          {item.status === "uploading" && (
                            <div className="mt-2 h-1.5 rounded-full bg-cream-200">
                              <div className="h-full rounded-full bg-gold-500 transition-all" style={{ width: `${item.progress}%` }} />
                            </div>
                          )}
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[item.status]}`}>
                          {item.status === "uploading" || item.status === "checking" ? <Loader2 className="mr-1 inline h-3 w-3 animate-spin" aria-hidden /> : null}
                          {statusLabel(item.status)}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => update(item.id, { expanded: !item.expanded })} className="focus-ring inline-flex items-center gap-1 rounded-full border border-navy-900/20 px-3 py-1.5 text-xs font-semibold hover:bg-cream-100">
                          {item.expanded ? <ChevronUp className="h-3.5 w-3.5" aria-hidden /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden />}
                          {item.expanded ? t("hideDetails") : t("uploadDetails")}
                        </button>
                        {(item.status === "error" || item.status === "canceled") && item.retryable && item.durationSec !== null && (
                          <button type="button" onClick={() => retryOne(item.id)} className="focus-ring inline-flex items-center gap-1 rounded-full border border-gold-600/40 px-3 py-1.5 text-xs font-semibold text-gold-700 hover:bg-gold-500/10">
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> {t("retry")}
                          </button>
                        )}
                        {item.status === "uploading" && (
                          <button type="button" onClick={() => cancelItem(item.id)} className="focus-ring inline-flex items-center gap-1 rounded-full border border-rubric-500/40 px-3 py-1.5 text-xs font-semibold text-rubric-600 hover:bg-rubric-500/10">
                            <X className="h-3.5 w-3.5" aria-hidden /> {t("cancel")}
                          </button>
                        )}
                        {item.status !== "uploading" && (
                          <button type="button" onClick={() => removeItem(item.id)} aria-label={t("remove")} className="focus-ring inline-flex items-center gap-1 rounded-full border border-navy-900/20 px-3 py-1.5 text-xs font-semibold hover:bg-cream-100">
                            <Trash2 className="h-3.5 w-3.5" aria-hidden /> {t("remove")}
                          </button>
                        )}
                        {item.status === "success" && item.serverId && (
                          <Link to={`/app/lessons/${item.serverId}`} className="focus-ring inline-flex items-center gap-1 rounded-full border border-emerald-600/30 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-600/10">
                            <Play className="h-3.5 w-3.5" aria-hidden /> {t("previewVideo")}
                          </Link>
                        )}
                      </div>

                      {item.expanded && (
                        <div className="mt-4 grid gap-4 rounded-2xl border border-gold-600/15 bg-cream-100/60 p-4 sm:grid-cols-2">
                          <div className="sm:col-span-2">
                            <Input label={t("titleLabel")} value={item.title} maxLength={160} onChange={(event) => update(item.id, { title: event.target.value })} />
                          </div>
                          <Input label={`${t("titleAmLabel")} (${t("optional")})`} lang="am" value={item.titleAm} maxLength={160} onChange={(event) => update(item.id, { titleAm: event.target.value })} />
                          <Select label={t("categoryLabel")} value={item.categoryId} onChange={(event) => update(item.id, { categoryId: event.target.value })}>
                            <option value="">{t("categoryLabel")}</option>
                            {categories.data?.map((category) => <option key={category.id} value={category.id}>{category.en} / {category.am}</option>)}
                          </Select>
                          <Select label={t("languageLabel")} value={item.language} onChange={(event) => update(item.id, { language: event.target.value as Lang })}>
                            <option value="en">{t("english")}</option>
                            <option value="am">{t("amharic")}</option>
                          </Select>
                          <Select label={`${t("courseOptional")} (${t("optional")})`} value={item.courseId} onChange={(event) => update(item.id, { courseId: event.target.value })}>
                            <option value="">{t("none")}</option>
                            {courses.data?.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
                          </Select>
                          <details className="sm:col-span-2">
                            <summary className="cursor-pointer text-sm font-semibold text-navy-900">{t("descriptionLabel")} ({t("optional")})</summary>
                            <div className="mt-2 space-y-3">
                              <Textarea label={t("descriptionLabel")} value={item.description} maxLength={2000} onChange={(event) => update(item.id, { description: event.target.value })} />
                              <Textarea label={t("descriptionAmLabel")} lang="am" value={item.descriptionAm} maxLength={2000} onChange={(event) => update(item.id, { descriptionAm: event.target.value })} />
                            </div>
                          </details>
                          <div className="sm:col-span-2">
                            <span className="text-sm font-semibold text-navy-900">{t("thumbnailLabel")}</span>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {[0, 1, 2, 3].map((variant) => (
                                <button
                                  key={variant}
                                  type="button"
                                  aria-pressed={item.cover === variant}
                                  aria-label={`${t("chooseCover")} ${variant + 1}`}
                                  onClick={() => update(item.id, { cover: variant })}
                                  className={`h-20 w-14 overflow-hidden rounded-lg border-2 ${item.cover === variant ? "border-gold-600 ring-2 ring-gold-500/40" : "border-transparent opacity-70 hover:opacity-100"}`}
                                >
                                  <Cover variant={variant} className="h-full w-full" />
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => { retryFailed(); if (counts.retryable > 0) setNotice(t("batchStarted")); }} disabled={counts.retryable === 0} className={btnSecondary}>
                    <RotateCcw className="h-4 w-4" aria-hidden /> {t("retryFailed")}
                  </button>
                  <button type="button" onClick={cancelAll} disabled={counts.uploading === 0 && counts.ready === 0} className={btnSecondary}>
                    <XCircle className="h-4 w-4" aria-hidden /> {t("cancelAll")}
                  </button>
                  <button type="button" onClick={clearFinished} disabled={counts.success === 0} className={btnSecondary}>
                    <CheckCircle2 className="h-4 w-4" aria-hidden /> {t("clearFinished")}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-gold-600/20 bg-cream-50 p-5 shadow-sm">
            <h2 className="font-display text-lg font-semibold">{t("batchDefaults")}</h2>
            <div className="mt-3 space-y-3">
              <Select label={t("categoryLabel")} value={defaults.categoryId} onChange={(event) => setDefaults({ ...defaults, categoryId: event.target.value })}>
                <option value="">{t("categoryLabel")}</option>
                {categories.data?.map((category) => <option key={category.id} value={category.id}>{category.en} / {category.am}</option>)}
              </Select>
              <Select label={t("languageLabel")} value={defaults.language} onChange={(event) => setDefaults({ ...defaults, language: event.target.value as Lang })}>
                <option value="en">{t("english")}</option>
                <option value="am">{t("amharic")}</option>
              </Select>
              <Select label={`${t("courseOptional")} (${t("optional")})`} value={defaults.courseId} onChange={(event) => setDefaults({ ...defaults, courseId: event.target.value })}>
                <option value="">{t("none")}</option>
                {courses.data?.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
              </Select>
              <Select label={t("concurrencyLabel")} value={concurrency} onChange={(event) => setConcurrency(Number(event.target.value))}>
                {[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value}</option>)}
              </Select>
              <p className="text-xs text-stone2-500">{t("concurrencyHint")}</p>
              <button type="button" onClick={applyDefaults} disabled={counts.total === 0} className={`${btnSecondary} w-full`}>{t("applyDefaults")}</button>
            </div>
          </section>

          <section className="rounded-2xl border border-gold-600/20 bg-cream-50 p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><ShieldCheck className="h-5 w-5 text-gold-700" aria-hidden /> {t("review")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-stone2-700">{t("step2Body")}</p>
          </section>

          <section className="rounded-2xl border border-gold-600/20 bg-cream-50 p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><Info className="h-5 w-5 text-gold-700" aria-hidden /> {t("fileHint")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-stone2-700">{t("durationError")}</p>
            <p className="mt-2 text-sm leading-relaxed text-stone2-700">{t("audioNote")}</p>
          </section>

          <section className="rounded-2xl border border-gold-600/30 bg-cream-100 p-5">
            <label className="flex items-start gap-3 text-sm text-stone2-700">
              <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-0.5 h-5 w-5 accent-gold-600" />
              <span>{t("agreementShort")}</span>
            </label>
            <button type="button" onClick={start} disabled={!agreed || counts.ready === 0 || counts.uploading > 0} className={`${btnPrimary} mt-4 w-full`}>
              <UploadCloud className="h-4 w-4" aria-hidden /> {t("startUpload")}
            </button>
            <p className="mt-2 text-xs text-stone2-500">{t("batchDone")}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
