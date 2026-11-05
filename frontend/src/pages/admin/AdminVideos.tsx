import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive, ArchiveRestore, CheckCircle2, ChevronLeft, ChevronRight, Edit3, FileWarning,
  Grid2X2, LayoutList, Play, RefreshCw, RotateCcw, Search, Trash2, UploadCloud, XCircle,
} from "lucide-react";
import type { AdminVideo, AdminVideoList, Lang, VideoStatus } from "../../types";
import { api, apiError } from "../../api/client";
import { useLang } from "../../i18n";
import { Modal } from "../../components/Modal";
import { Cover } from "../../components/Art";
import { Input, Select, Textarea } from "../../components/Field";
import { btnDanger, btnPrimary, btnSecondary, ErrorBox, PageHeader, Spinner, StatusPill } from "../../components/UI";
import { formatDuration } from "../../data/mock";

type ViewMode = "table" | "grid";

interface EditForm {
  title: string;
  titleAm: string;
  description: string;
  descriptionAm: string;
  categoryId: string;
  language: Lang;
  cover: number;
  durationSec: number;
  courseId: string;
  attribution: string;
  status: VideoStatus;
  archived: boolean;
}

const emptyEdit: EditForm = {
  title: "",
  titleAm: "",
  description: "",
  descriptionAm: "",
  categoryId: "",
  language: "en",
  cover: 0,
  durationSec: 0,
  courseId: "",
  attribution: "",
  status: "pending",
  archived: false,
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

function formatSize(bytes?: number | null) {
  if (!bytes) return "—";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const iconBtn = "focus-ring inline-grid h-9 w-9 place-items-center rounded-full border border-navy-900/15 text-navy-900 hover:bg-cream-200 disabled:opacity-40";

export function AdminVideos() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [view, setView] = useState<ViewMode>("table");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [language, setLanguage] = useState("all");
  const [creatorId, setCreatorId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [archived, setArchived] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState("");
  const [bulkCourseId, setBulkCourseId] = useState("");
  const [rejectIds, setRejectIds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [editing, setEditing] = useState<AdminVideo | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyEdit);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [debouncedSearch, status, categoryId, language, creatorId, courseId, archived, sort, pageSize]);

  useEffect(() => {
    setSelected(new Set());
  }, [page]);

  const query = useQuery({
    queryKey: ["admin", "videos", debouncedSearch, status, categoryId, language, creatorId, courseId, archived, sort, page, pageSize],
    queryFn: async () => (await api.get<AdminVideoList>("/admin/videos", {
      params: {
        q: debouncedSearch,
        status,
        categoryId,
        language,
        teacherId: creatorId,
        courseId,
        archived,
        sort,
        page,
        pageSize,
      },
    })).data,
    placeholderData: keepPreviousData,
  });

  const data = query.data;
  const videos = data?.videos ?? [];
  const facets = data?.facets;
  const pageIds = useMemo(() => videos.map((video) => video.id), [videos]);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin"] });
    queryClient.invalidateQueries({ queryKey: ["videos"] });
    queryClient.invalidateQueries({ queryKey: ["courses"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["summary"] });
  };

  const bulk = useMutation({
    mutationFn: (body: { action: string; ids: string[]; reason?: string; courseId?: string }) =>
      api.patch<{ updated: number }>("/admin/videos/bulk", body),
    onSuccess: (response) => {
      setNotice(t("bulkDone", { count: response.data.updated }));
      setSelected(new Set());
      setRejectIds([]);
      setReason("");
      invalidate();
    },
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<EditForm>) => api.patch(`/admin/videos/${id}`, body),
    onSuccess: () => {
      setNotice(t("metadataSaved"));
      setEditing(null);
      invalidate();
    },
  });

  const retry = useMutation({
    mutationFn: (id: string) => api.post(`/admin/videos/${id}/retry`),
    onSuccess: () => { setNotice(t("retryQueued")); invalidate(); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/videos/${id}`),
    onSuccess: () => { setNotice(t("videoDeleted")); invalidate(); },
  });

  const toggleSelection = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePage = () => {
    setSelected((current) => {
      const next = new Set(current);
      if (allSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const openReject = (ids: string[]) => {
    setRejectIds(ids);
    setReason("");
  };

  const openEdit = (video: AdminVideo) => {
    setEditing(video);
    setEditForm({
      title: video.title,
      titleAm: video.titleAm,
      description: video.description,
      descriptionAm: video.descriptionAm,
      categoryId: video.categoryId,
      language: video.language,
      cover: video.cover,
      durationSec: video.durationSec,
      courseId: video.courseId ?? "",
      attribution: video.attribution ?? "",
      status: video.status ?? "pending",
      archived: Boolean(video.archived),
    });
  };

  const saveEdit = () => {
    if (!editing) return;
    update.mutate({ id: editing.id, ...editForm, durationSec: Number(editForm.durationSec) });
  };

  const selectedIds = Array.from(selected);
  const stats = data?.stats;
  const pendingAction = bulk.isPending || update.isPending || remove.isPending || retry.isPending;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <PageHeader
        title={t("videoLibrary")}
        subtitle={t("librarySub")}
        actions={(
          <>
            <Link to="/app/upload" className={btnPrimary}><UploadCloud className="h-4 w-4" aria-hidden /> {t("upload")}</Link>
            <Link to="/app/admin" className={btnSecondary}>{t("overviewTitle")}</Link>
          </>
        )}
      />

      {notice && <p role="status" className="mt-4 rounded-xl border border-emerald-600/25 bg-emerald-600/10 p-3 text-sm font-medium text-emerald-800">{notice}</p>}
      {query.isError && <ErrorBox message={apiError(query.error)} retry={() => query.refetch()} />}
      {bulk.isError && <ErrorBox message={apiError(bulk.error)} />}
      {update.isError && <ErrorBox message={apiError(update.error)} />}
      {retry.isError && <ErrorBox message={apiError(retry.error)} />}
      {remove.isError && <ErrorBox message={apiError(remove.error)} />}

      {stats && (
        <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label={t("filterStatus")}>
          {[
            { key: "all", label: t("allVideos"), value: stats.all, active: status === "all" && archived === "all", onClick: () => { setStatus("all"); setArchived("all"); } },
            { key: "pending", label: t("pendingVideos"), value: stats.pending, active: status === "pending" && archived === "all", onClick: () => { setStatus("pending"); setArchived("all"); } },
            { key: "approved", label: t("approvedVideos"), value: stats.approved, active: status === "approved" && archived === "all", onClick: () => { setStatus("approved"); setArchived("all"); } },
            { key: "rejected", label: t("rejectedVideos"), value: stats.rejected, active: status === "rejected" && archived === "all", onClick: () => { setStatus("rejected"); setArchived("all"); } },
            { key: "archived", label: t("archiveLabel"), value: stats.archived, active: archived === "true", onClick: () => { setStatus("all"); setArchived("true"); } },
          ].map((chip) => (
            <button
              key={chip.key}
              type="button"
              aria-pressed={chip.active}
              onClick={chip.onClick}
              className={`focus-ring rounded-full border px-4 py-2 text-sm font-semibold ${chip.active ? "border-navy-900 bg-navy-900 text-cream-50" : "border-navy-900/20 bg-cream-50 hover:bg-cream-200"}`}
            >
              {chip.label} · {chip.value}
            </button>
          ))}
          {stats.failed > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-rubric-500/30 bg-rubric-500/10 px-4 py-2 text-sm font-semibold text-rubric-600">
              <FileWarning className="h-4 w-4" aria-hidden /> {stats.failed}
            </span>
          )}
        </div>
      )}

      <section className="mt-5 rounded-2xl border border-gold-600/20 bg-cream-50 p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2">
            <Input label={t("searchVideos")} type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
            <Search className="pointer-events-none absolute bottom-3.5 right-3 h-4 w-4 text-stone2-500" aria-hidden />
          </div>
          <Select label={t("filterStatus")} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">{t("allStatuses")}</option>
            <option value="pending">{t("pending")}</option>
            <option value="approved">{t("approved")}</option>
            <option value="rejected">{t("rejected")}</option>
          </Select>
          <Select label={t("filterArchive")} value={archived} onChange={(event) => setArchived(event.target.value)}>
            <option value="all">{t("all")}</option>
            <option value="false">{t("activeOnly")}</option>
            <option value="true">{t("archivedOnly")}</option>
          </Select>
          <Select label={t("categoryLabel")} value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="all">{t("allCategories")}</option>
            {facets?.categories.map((category) => <option key={category.id} value={category.id}>{category.en} / {category.am}</option>)}
          </Select>
          <Select label={t("languageLabel")} value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="all">{t("allLanguages")}</option>
            <option value="en">{t("english")}</option>
            <option value="am">{t("amharic")}</option>
          </Select>
          <Select label={t("filterCreator")} value={creatorId} onChange={(event) => setCreatorId(event.target.value)}>
            <option value="">{t("allCreators")}</option>
            {facets?.creators.map((creator) => <option key={creator.id} value={creator.id}>{creator.name} ({creator.videoCount})</option>)}
          </Select>
          <Select label={t("filterCourse")} value={courseId} onChange={(event) => setCourseId(event.target.value)}>
            <option value="">{t("allCourses")}</option>
            {facets?.courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
          </Select>
          <Select label={t("sortLabel")} value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="newest">{t("sortNewest")}</option>
            <option value="oldest">{t("sortOldest")}</option>
            <option value="title">{t("sortTitle")}</option>
            <option value="duration">{t("sortDuration")}</option>
            <option value="status">{t("sortStatus")}</option>
          </Select>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setView("table")} aria-pressed={view === "table"} className={`${view === "table" ? btnPrimary : btnSecondary} min-h-9 px-3 py-1.5 text-xs`}>
              <LayoutList className="h-3.5 w-3.5" aria-hidden /> {t("tableView")}
            </button>
            <button type="button" onClick={() => setView("grid")} aria-pressed={view === "grid"} className={`${view === "grid" ? btnPrimary : btnSecondary} min-h-9 px-3 py-1.5 text-xs`}>
              <Grid2X2 className="h-3.5 w-3.5" aria-hidden /> {t("gridView")}
            </button>
            <button type="button" onClick={() => query.refetch()} disabled={query.isFetching} className={`${btnSecondary} min-h-9 px-3 py-1.5 text-xs`}>
              <RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} aria-hidden /> {t("refresh")}
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-stone2-700">
            <span>{data ? `${data.total} ${t("totalVideos")}` : t("loading")}</span>
            <label className="flex items-center gap-1">
              {t("perPage")}
              <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="rounded-lg border border-navy-900/25 bg-white px-2 py-1">
                {[25, 50, 100, 200].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
          </div>
        </div>
      </section>

      {selected.size > 0 && (
        <section className="sticky top-2 z-20 mt-4 rounded-2xl border border-navy-900/20 bg-navy-950 p-3 text-cream-50 shadow-lg">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-gold-500 px-3 py-1 text-xs font-bold text-navy-950">{t("selectedCount", { count: selected.size })}</span>
            <button type="button" onClick={() => bulk.mutate({ action: "approve", ids: selectedIds })} disabled={pendingAction} className={`${btnSecondary} min-h-9 px-3 py-1.5 text-xs`}>
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {t("bulkApprove")}
            </button>
            <button type="button" onClick={() => bulk.mutate({ action: "publish", ids: selectedIds })} disabled={pendingAction} className={`${btnSecondary} min-h-9 px-3 py-1.5 text-xs`}>
              <Play className="h-3.5 w-3.5" aria-hidden /> {t("bulkPublish")}
            </button>
            <button type="button" onClick={() => openReject(selectedIds)} disabled={pendingAction} className={`${btnDanger} min-h-9 px-3 py-1.5 text-xs`}>
              <XCircle className="h-3.5 w-3.5" aria-hidden /> {t("bulkReject")}
            </button>
            <button type="button" onClick={() => bulk.mutate({ action: "archive", ids: selectedIds })} disabled={pendingAction} className={`${btnSecondary} min-h-9 px-3 py-1.5 text-xs`}>
              <Archive className="h-3.5 w-3.5" aria-hidden /> {t("bulkArchive")}
            </button>
            <button type="button" onClick={() => bulk.mutate({ action: "unarchive", ids: selectedIds })} disabled={pendingAction} className={`${btnSecondary} min-h-9 px-3 py-1.5 text-xs`}>
              <ArchiveRestore className="h-3.5 w-3.5" aria-hidden /> {t("bulkUnarchive")}
            </button>
            <button type="button" onClick={() => bulk.mutate({ action: "pending", ids: selectedIds })} disabled={pendingAction} className={`${btnSecondary} min-h-9 px-3 py-1.5 text-xs`}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> {t("bulkPending")}
            </button>
            <button type="button" onClick={() => bulk.mutate({ action: "retry", ids: selectedIds })} disabled={pendingAction} className={`${btnSecondary} min-h-9 px-3 py-1.5 text-xs`}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden /> {t("bulkRetry")}
            </button>
            <div className="flex items-center gap-1">
              <select value={bulkCourseId} onChange={(event) => setBulkCourseId(event.target.value)} aria-label={t("chooseCourse")} className="min-h-9 rounded-lg border border-cream-50/30 bg-navy-900 px-2 py-1 text-xs text-cream-50">
                <option value="">{t("chooseCourse")}</option>
                {facets?.courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
              </select>
              <button type="button" onClick={() => bulk.mutate({ action: "assignCourse", ids: selectedIds, courseId: bulkCourseId })} disabled={pendingAction || !bulkCourseId} className={`${btnSecondary} min-h-9 px-3 py-1.5 text-xs`}>
                {t("applyCourse")}
              </button>
            </div>
            <button type="button" onClick={() => setSelected(new Set())} className="focus-ring rounded-full border border-cream-50/30 px-3 py-1.5 text-xs font-semibold text-cream-50 hover:bg-cream-50/10">
              {t("clearSelection")}
            </button>
          </div>
        </section>
      )}

      {(query.isLoading || (query.isFetching && !data)) && <Spinner />}

      {!query.isLoading && videos.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-navy-900/20 bg-cream-50 p-8 text-center text-stone2-700">{t("noLibraryVideos")}</p>
      )}

      {videos.length > 0 && view === "table" && (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-gold-600/20 bg-cream-50 shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gold-600/20 bg-cream-100 text-xs uppercase tracking-wide text-stone2-700">
              <tr>
                <th className="w-10 p-3">
                  <input type="checkbox" checked={allSelected} onChange={togglePage} aria-label={t("selectPage")} className="h-4 w-4 accent-gold-600" />
                </th>
                <th className="p-3">{t("titleLabel")}</th>
                <th className="p-3">{t("createdBy")}</th>
                <th className="p-3">{t("categoryLabel")}</th>
                <th className="p-3">{t("language")}</th>
                <th className="p-3">{t("durationLabel")}</th>
                <th className="p-3">{t("status")}</th>
                <th className="p-3">{t("uploadDate")}</th>
                <th className="p-3 text-right">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((video) => (
                <tr key={video.id} className={`border-b border-gold-600/10 last:border-0 ${selected.has(video.id) ? "bg-gold-500/10" : ""}`}>
                  <td className="p-3 align-top">
                    <input type="checkbox" checked={selected.has(video.id)} onChange={() => toggleSelection(video.id)} aria-label={video.title} className="h-4 w-4 accent-gold-600" />
                  </td>
                  <td className="max-w-sm p-3 align-top">
                    <div className="flex gap-3">
                      <div className="h-16 w-11 shrink-0 overflow-hidden rounded bg-navy-900">
                        <Cover variant={video.cover} className="h-full w-full" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold" title={video.title}>{video.title}</p>
                        {video.titleAm && video.titleAm !== video.title && <p className="truncate text-xs text-stone2-500" lang="am">{video.titleAm}</p>}
                        <p className="truncate text-xs text-stone2-500">{video.originalName || ""}</p>
                        {!video.fileExists && <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-rubric-600"><FileWarning className="h-3 w-3" aria-hidden /> {t("fileMissing")}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 align-top text-xs">{video.uploadedByName || video.teacher.name}</td>
                  <td className="p-3 align-top text-xs">{video.category ? video.category.en : video.categoryId}</td>
                  <td className="p-3 align-top text-xs">{video.language === "am" ? "አማርኛ" : "English"}</td>
                  <td className="p-3 align-top text-xs">{formatDuration(video.durationSec)}</td>
                  <td className="p-3 align-top">
                    <div className="flex flex-col items-start gap-1">
                      {video.status && <StatusPill status={video.status} />}
                      {video.archived && <span className="rounded-full bg-stone2-500/15 px-2 py-0.5 text-xs font-semibold text-stone2-700">{t("archiveLabel")}</span>}
                      <span className="text-[11px] text-stone2-500">{formatSize(video.fileSize)}</span>
                    </div>
                  </td>
                  <td className="p-3 align-top text-xs">{formatDate(video.uploadedAt || video.createdAt)}</td>
                  <td className="p-3 align-top">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Link to={`/app/lessons/${video.id}`} aria-label={t("previewVideo")} title={t("previewVideo")} className={iconBtn}><Play className="h-4 w-4" aria-hidden /></Link>
                      <button type="button" onClick={() => openEdit(video)} aria-label={t("editMetadata")} title={t("editMetadata")} className={iconBtn}><Edit3 className="h-4 w-4" aria-hidden /></button>
                      {video.status !== "approved" && (
                        <button type="button" onClick={() => bulk.mutate({ action: "approve", ids: [video.id] })} disabled={pendingAction} aria-label={t("approve")} title={t("approve")} className={iconBtn}><CheckCircle2 className="h-4 w-4" aria-hidden /></button>
                      )}
                      {video.status !== "rejected" && (
                        <button type="button" onClick={() => openReject([video.id])} disabled={pendingAction} aria-label={t("reject")} title={t("reject")} className={iconBtn}><XCircle className="h-4 w-4" aria-hidden /></button>
                      )}
                      <button type="button" onClick={() => bulk.mutate({ action: video.archived ? "unarchive" : "archive", ids: [video.id] })} disabled={pendingAction} aria-label={video.archived ? t("unarchive") : t("bulkArchive")} title={video.archived ? t("unarchive") : t("bulkArchive")} className={iconBtn}>
                        {video.archived ? <ArchiveRestore className="h-4 w-4" aria-hidden /> : <Archive className="h-4 w-4" aria-hidden />}
                      </button>
                      <button type="button" onClick={() => retry.mutate(video.id)} disabled={pendingAction || !video.fileExists} aria-label={t("retryUpload")} title={t("retryUpload")} className={iconBtn}><RotateCcw className="h-4 w-4" aria-hidden /></button>
                      <button type="button" onClick={() => { if (window.confirm(t("confirmDeleteVideo"))) remove.mutate(video.id); }} disabled={pendingAction} aria-label={t("delete")} title={t("delete")} className={`${iconBtn} text-rubric-600`}><Trash2 className="h-4 w-4" aria-hidden /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {videos.length > 0 && view === "grid" && (
        <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {videos.map((video) => (
            <li key={video.id} className={`overflow-hidden rounded-2xl border bg-cream-50 shadow-sm ${selected.has(video.id) ? "border-gold-600 ring-2 ring-gold-500/30" : "border-gold-600/20"}`}>
              <div className="relative">
                <div className="aspect-[9/12] bg-navy-900"><Cover variant={video.cover} className="h-full w-full" /></div>
                <label className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-cream-50/90">
                  <input type="checkbox" checked={selected.has(video.id)} onChange={() => toggleSelection(video.id)} aria-label={video.title} className="h-4 w-4 accent-gold-600" />
                </label>
                <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
                  {video.status && <StatusPill status={video.status} />}
                  {video.archived && <span className="rounded-full bg-navy-950/80 px-2 py-0.5 text-xs font-semibold text-cream-50">{t("archiveLabel")}</span>}
                </div>
                {!video.fileExists && <span className="absolute bottom-2 left-2 rounded-full bg-rubric-500 px-2 py-0.5 text-xs font-semibold text-white">{t("fileMissing")}</span>}
              </div>
              <div className="p-3">
                <p className="line-clamp-2 font-display text-base font-semibold">{video.title}</p>
                <p className="mt-1 text-xs text-stone2-500">{video.uploadedByName || video.teacher.name} · {video.language === "am" ? "አማርኛ" : "English"} · {formatDuration(video.durationSec)}</p>
                <p className="text-xs text-stone2-500">{formatDate(video.uploadedAt || video.createdAt)} · {formatSize(video.fileSize)}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  <Link to={`/app/lessons/${video.id}`} aria-label={t("previewVideo")} className={iconBtn}><Play className="h-4 w-4" aria-hidden /></Link>
                  <button type="button" onClick={() => openEdit(video)} aria-label={t("editMetadata")} className={iconBtn}><Edit3 className="h-4 w-4" aria-hidden /></button>
                  {video.status !== "approved" && <button type="button" onClick={() => bulk.mutate({ action: "approve", ids: [video.id] })} aria-label={t("approve")} className={iconBtn}><CheckCircle2 className="h-4 w-4" aria-hidden /></button>}
                  <button type="button" onClick={() => openReject([video.id])} aria-label={t("reject")} className={iconBtn}><XCircle className="h-4 w-4" aria-hidden /></button>
                  <button type="button" onClick={() => bulk.mutate({ action: video.archived ? "unarchive" : "archive", ids: [video.id] })} aria-label={video.archived ? t("unarchive") : t("bulkArchive")} className={iconBtn}>
                    {video.archived ? <ArchiveRestore className="h-4 w-4" aria-hidden /> : <Archive className="h-4 w-4" aria-hidden />}
                  </button>
                  <button type="button" onClick={() => retry.mutate(video.id)} disabled={!video.fileExists} aria-label={t("retryUpload")} className={iconBtn}><RotateCcw className="h-4 w-4" aria-hidden /></button>
                  <button type="button" onClick={() => { if (window.confirm(t("confirmDeleteVideo"))) remove.mutate(video.id); }} aria-label={t("delete")} className={`${iconBtn} text-rubric-600`}><Trash2 className="h-4 w-4" aria-hidden /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {data && data.totalPages > 1 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-stone2-700">{t("pageOf", { page: data.page, pages: data.totalPages })}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={data.page <= 1} className={btnSecondary}>
              <ChevronLeft className="h-4 w-4" aria-hidden /> {t("previous")}
            </button>
            <button type="button" onClick={() => setPage((current) => Math.min(data.totalPages, current + 1))} disabled={data.page >= data.totalPages} className={btnSecondary}>
              {t("nextPage")} <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}

      <Modal open={rejectIds.length > 0} onClose={() => setRejectIds([])} title={rejectIds.length > 1 ? t("rejectReasonTitle") : t("confirmReject")}>
        <div className="space-y-4">
          <p className="text-sm text-stone2-700">{t("rejectReasonHint")}</p>
          <Textarea label={t("reviewNote")} value={reason} maxLength={500} rows={4} placeholder={t("rejectionPlaceholder")} onChange={(event) => setReason(event.target.value)} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setRejectIds([])} className={btnSecondary}>{t("cancel")}</button>
            <button type="button" onClick={() => bulk.mutate({ action: "reject", ids: rejectIds, reason: reason.trim() })} disabled={bulk.isPending} className={btnDanger}>
              <XCircle className="h-4 w-4" aria-hidden /> {t("reject")}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={t("editMetadata")} wide>
        {editing && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Input label={t("titleLabel")} value={editForm.title} maxLength={160} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} />
              </div>
              <Input label={`${t("titleAmLabel")} (${t("optional")})`} lang="am" value={editForm.titleAm} maxLength={160} onChange={(event) => setEditForm({ ...editForm, titleAm: event.target.value })} />
              <Select label={t("categoryLabel")} value={editForm.categoryId} onChange={(event) => setEditForm({ ...editForm, categoryId: event.target.value })}>
                {facets?.categories.map((category) => <option key={category.id} value={category.id}>{category.en} / {category.am}</option>)}
              </Select>
              <Select label={t("languageLabel")} value={editForm.language} onChange={(event) => setEditForm({ ...editForm, language: event.target.value as Lang })}>
                <option value="en">{t("english")}</option>
                <option value="am">{t("amharic")}</option>
              </Select>
              <Select label={t("filterCourse")} value={editForm.courseId} onChange={(event) => setEditForm({ ...editForm, courseId: event.target.value })}>
                <option value="">{t("selectCourse")}</option>
                {facets?.courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
              </Select>
              <Input label={t("durationLabel")} type="number" min={1} max={300} value={editForm.durationSec} onChange={(event) => setEditForm({ ...editForm, durationSec: Number(event.target.value) })} />
              <Select label={t("status")} value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value as VideoStatus })}>
                <option value="pending">{t("pending")}</option>
                <option value="approved">{t("approved")}</option>
                <option value="rejected">{t("rejected")}</option>
              </Select>
              <Input label={t("attributionLabel")} value={editForm.attribution} maxLength={300} onChange={(event) => setEditForm({ ...editForm, attribution: event.target.value })} />
              <label className="flex items-center gap-2 text-sm font-semibold text-navy-900">
                <input type="checkbox" checked={editForm.archived} onChange={(event) => setEditForm({ ...editForm, archived: event.target.checked })} className="h-5 w-5 accent-gold-600" />
                {t("archiveLabel")}
              </label>
              <div className="sm:col-span-2">
                <Textarea label={`${t("descriptionLabel")} (${t("optional")})`} value={editForm.description} maxLength={2000} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Textarea label={`${t("descriptionAmLabel")} (${t("optional")})`} lang="am" value={editForm.descriptionAm} maxLength={2000} onChange={(event) => setEditForm({ ...editForm, descriptionAm: event.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <span className="text-sm font-semibold text-navy-900">{t("thumbnailLabel")}</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[0, 1, 2, 3].map((variant) => (
                    <button key={variant} type="button" aria-pressed={editForm.cover === variant} onClick={() => setEditForm({ ...editForm, cover: variant })}
                      className={`h-20 w-14 overflow-hidden rounded-lg border-2 ${editForm.cover === variant ? "border-gold-600 ring-2 ring-gold-500/40" : "border-transparent opacity-70 hover:opacity-100"}`}>
                      <Cover variant={variant} className="h-full w-full" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {update.isError && <ErrorBox message={apiError(update.error)} />}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className={btnSecondary}>{t("cancel")}</button>
              <button type="button" onClick={saveEdit} disabled={update.isPending || editForm.title.trim().length < 3 || !editForm.categoryId} className={btnPrimary}>{t("save")}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
