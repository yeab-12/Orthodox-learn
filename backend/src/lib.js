import { db } from "./store.js";

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function findUser(id) {
  return db().users.find((u) => u.id === id);
}

export function categoryOf(id) {
  return db().categories.find((c) => c.id === id) ?? null;
}

export function userOut(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    bio: u.bio ?? "",
    language: u.language ?? "en",
    active: u.active,
    createdAt: u.createdAt,
  };
}

export function teacherOut(t, viewerId) {
  const all = db();
  return {
    id: t.id,
    name: t.name,
    bio: t.bio ?? "",
    language: t.language ?? "en",
    role: t.role,
    videoCount: all.videos.filter((v) => v.teacherId === t.id && isPublicVideo(v)).length,
    courseCount: all.courses.filter((c) => c.teacherId === t.id).length,
    followers: all.follows.filter((f) => f.teacherId === t.id).length,
    following: viewerId ? all.follows.some((f) => f.userId === viewerId && f.teacherId === t.id) : false,
    createdAt: t.createdAt,
  };
}

/**
 * True when a lesson can be shown to the public. Old records without a status
 * are treated as approved so the feed keeps working after upgrades.
 */
export function isPublicVideo(v) {
  return Boolean(v) && (v.status ?? "approved") === "approved" && !v.archived;
}

export function videoOut(v, viewerId, { includeStatus = false } = {}) {
  if (!v) return null;
  const all = db();
  const teacher = findUser(v.teacherId);
  const cat = categoryOf(v.categoryId);
  const owner = viewerId && (v.uploadedBy === viewerId || v.teacherId === viewerId);
  const admin = viewerId && findUser(viewerId)?.role === "admin";
  const canSeePrivate = Boolean(owner || admin || includeStatus);
  const out = {
    id: v.id,
    title: v.title,
    titleAm: v.titleAm || v.title,
    teacherId: v.teacherId,
    teacher: teacher ? {
      id: teacher.id,
      name: teacher.name,
      following: viewerId ? all.follows.some((f) => f.userId === viewerId && f.teacherId === teacher.id) : false,
    } : { id: v.teacherId, name: "Unknown teacher", following: false },
    categoryId: v.categoryId,
    category: cat,
    language: v.language,
    durationSec: v.durationSec,
    cover: v.cover ?? 0,
    description: v.description ?? "",
    descriptionAm: v.descriptionAm ?? "",
    videoUrl: v.videoUrl ?? null,
    mediaType: v.mediaType ?? "video",
    demo: Boolean(v.demo),
    // Status and archive state are safe public metadata. The review note and
    // uploader details stay private to the owner and administrators.
    status: v.status ?? "approved",
    archived: Boolean(v.archived),
    lessonStatus: v.lessonStatus ?? "published",
    objectives: Array.isArray(v.objectives) ? v.objectives : [],
    resources: Array.isArray(v.resources) ? v.resources : [],
    downloadTitle: v.downloadTitle ?? "",
    downloadUrl: v.downloadUrl ?? "",
    attribution: v.attribution ?? "",
    likes: all.likes.filter((l) => l.videoId === v.id).length,
    views: v.views ?? 0,
    comments: all.comments.filter((c) => c.videoId === v.id).length,
    liked: viewerId ? all.likes.some((l) => l.userId === viewerId && l.videoId === v.id) : false,
    saved: viewerId ? all.saves.some((s) => s.userId === viewerId && s.videoId === v.id) : false,
    courseId: v.courseId ?? all.courses.find((c) => c.videoIds.includes(v.id))?.id ?? null,
    createdAt: v.createdAt,
  };
  if (canSeePrivate) {
    out.rejectionReason = v.rejectionReason ?? "";
    out.uploadedBy = v.uploadedBy ?? null;
    out.uploadedByName = teacher?.name ?? "";
    out.originalName = v.originalName ?? "";
    out.fileSize = v.fileSize ?? null;
    out.mimeType = v.mimeType ?? "";
    out.uploadedAt = v.uploadedAt ?? v.createdAt;
    out.approvedAt = v.approvedAt ?? null;
    out.requestedCourseId = v.requestedCourseId ?? "";
    out.batchId = v.batchId ?? "";
    out.mediaState = v.mediaState ?? "ready";
    out.retryCount = v.retryCount ?? 0;
    out.lastRetryAt = v.lastRetryAt ?? null;
  }
  return out;
}

export function courseOut(c, viewerId, { lessons = false } = {}) {
  const all = db();
  const teacher = findUser(c.teacherId);
  const ids = c.videoIds.filter((id) => all.videos.some((v) => v.id === id && isPublicVideo(v)));
  const enrollment = viewerId
    ? all.enrollments.find((e) => e.userId === viewerId && e.courseId === c.id)
    : null;
  const done = enrollment
    ? ids.filter((id) => enrollment.completedVideoIds.includes(id)).length
    : 0;
  const out = {
    id: c.id,
    title: c.title,
    titleAm: c.titleAm || c.title,
    description: c.description ?? "",
    descriptionAm: c.descriptionAm ?? "",
    teacherId: c.teacherId,
    teacher: teacher ? { id: teacher.id, name: teacher.name } : null,
    cover: c.cover ?? 0,
    language: c.language,
    lessonCount: ids.length,
    done,
    enrolled: Boolean(enrollment),
    createdAt: c.createdAt,
  };
  if (lessons) {
    out.lessons = ids
      .map((id) => all.videos.find((v) => v.id === id))
      .filter(Boolean)
      .map((v) => ({
        ...videoOut(v, viewerId),
        completed: enrollment ? enrollment.completedVideoIds.includes(v.id) : false,
      }));
  }
  return out;
}

export function notify(userId, text, textAm, href) {
  const all = db();
  all.notifications.unshift({
    id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId,
    text,
    textAm: textAm || text,
    href: href || "/app",
    read: false,
    createdAt: new Date().toISOString(),
  });
}

export function publicComment(c) {
  const user = findUser(c.userId);
  const video = db().videos.find((v) => v.id === c.videoId);
  return {
    id: c.id,
    videoId: c.videoId,
    videoTitle: video?.title ?? "",
    text: c.text,
    createdAt: c.createdAt,
    user: user ? { id: user.id, name: user.name, role: user.role } : { id: c.userId, name: "Deleted user", role: "student" },
  };
}

export function isInsideUploads(filePath, uploadsDir) {
  if (!filePath) return false;
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.startsWith(`${uploadsDir.replace(/\\/g, "/")}/`);
}
