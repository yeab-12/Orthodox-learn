import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { z } from "zod";
import { db, save } from "../store.js";
import { ApiError, asyncHandler, findUser, isPublicVideo, notify, publicComment, videoOut } from "../lib.js";
import { authRequired, optionalAuth } from "../auth.js";
import { uploadsDir } from "../paths.js";

export const videosRouter = Router();
videosRouter.use(optionalAuth);

videosRouter.get("/", (req, res) => {
  const all = db();
  const { q, categoryId, language, teacherId, courseId } = req.query;
  const needle = String(q || "").trim().toLowerCase();
  const limit = Math.min(Number(req.query.limit) || 60, 100);
  let list = all.videos.filter(isPublicVideo);
  list = list.filter((video) => (video.lessonStatus ?? "published") === "published");
  if (categoryId && categoryId !== "all") list = list.filter((v) => v.categoryId === categoryId);
  if (language && language !== "all") list = list.filter((v) => v.language === language);
  if (teacherId) list = list.filter((v) => v.teacherId === teacherId);
  if (courseId) list = list.filter((v) => v.courseId === courseId || all.courses.find((c) => c.id === courseId)?.videoIds.includes(v.id));
  if (needle) {
    list = list.filter((v) => {
      const teacher = findUser(v.teacherId)?.name ?? "";
      return [v.title, v.titleAm, v.description, v.descriptionAm, teacher, v.categoryId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }
  list = [...list].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, limit);
  res.json({ videos: list.map((v) => videoOut(v, req.user?.id)) });
});

// Personal routes must come before "/:id".
videosRouter.get("/me/videos", authRequired, (req, res) => {
  const list = db().videos
    .filter((v) => v.uploadedBy === req.user.id)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  res.json({ videos: list.map((v) => videoOut(v, req.user.id, { includeStatus: true })) });
});

videosRouter.get("/me/saved", authRequired, (req, res) => {
  const all = db();
  const ids = all.saves
    .filter((s) => s.userId === req.user.id)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map((s) => s.videoId);
  const videos = ids
    .map((id) => all.videos.find((v) => v.id === id))
    .filter((v) => v && isPublicVideo(v))
    .map((v) => videoOut(v, req.user.id));
  res.json({ videos });
});

// Owners can remove their own upload before or after review. Admins use /admin/videos/:id.
videosRouter.delete("/:id", authRequired, (req, res) => {
  const all = db();
  const index = all.videos.findIndex((v) => v.id === req.params.id && v.uploadedBy === req.user.id);
  if (index < 0) throw new ApiError(404, "Upload not found.");
  const [video] = all.videos.splice(index, 1);
  if (video.storedName) {
    const filePath = path.join(uploadsDir, "videos", video.storedName);
    try {
      if (path.resolve(filePath).startsWith(path.resolve(uploadsDir))) fs.unlinkSync(filePath);
    } catch {
      /* the file may already be gone */
    }
  }
  all.comments = all.comments.filter((c) => c.videoId !== video.id);
  all.likes = all.likes.filter((l) => l.videoId !== video.id);
  all.saves = all.saves.filter((s) => s.videoId !== video.id);
  for (const course of all.courses) course.videoIds = course.videoIds.filter((id) => id !== video.id);
  for (const enrollment of all.enrollments) {
    enrollment.completedVideoIds = enrollment.completedVideoIds.filter((id) => id !== video.id);
  }
  save();
  res.json({ deleted: true });
});

videosRouter.get("/:id", optionalAuth, (req, res) => {
  const all = db();
  const video = all.videos.find((v) => v.id === req.params.id);
  if (!video) throw new ApiError(404, "Lesson not found.");
  const isOwner = req.user && (video.uploadedBy === req.user.id || video.teacherId === req.user.id);
  const isAdmin = req.user?.role === "admin";
  const isDraft = (video.lessonStatus ?? "published") !== "published";
  if ((!isPublicVideo(video) || isDraft) && !isOwner && !isAdmin) throw new ApiError(404, "Lesson not found.");
  res.json({ video: videoOut(video, req.user?.id, { includeStatus: isOwner || isAdmin }) });
});

videosRouter.post("/:id/view", (req, res) => {
  const video = db().videos.find((v) => v.id === req.params.id);
  if (!video) throw new ApiError(404, "Lesson not found.");
  // Pending, rejected and archived lessons can be previewed by their owner or
  // an admin, but preview views should not count as public views.
  if (!isPublicVideo(video)) return res.json({ views: video.views ?? 0 });
  video.views = (video.views ?? 0) + 1;
  save();
  res.json({ views: video.views });
});

videosRouter.post("/:id/like", authRequired, (req, res) => {
  const all = db();
  const video = all.videos.find((v) => v.id === req.params.id && isPublicVideo(v));
  if (!video) throw new ApiError(404, "Lesson not found.");
  const index = all.likes.findIndex((l) => l.userId === req.user.id && l.videoId === video.id);
  if (index >= 0) {
    all.likes.splice(index, 1);
  } else {
    all.likes.push({ userId: req.user.id, videoId: video.id, createdAt: new Date().toISOString() });
  }
  save();
  res.json({ liked: index < 0, likes: all.likes.filter((l) => l.videoId === video.id).length });
});

videosRouter.post("/:id/save", authRequired, (req, res) => {
  const all = db();
  const video = all.videos.find((v) => v.id === req.params.id && isPublicVideo(v));
  if (!video) throw new ApiError(404, "Lesson not found.");
  const index = all.saves.findIndex((s) => s.userId === req.user.id && s.videoId === video.id);
  if (index >= 0) {
    all.saves.splice(index, 1);
  } else {
    all.saves.push({ userId: req.user.id, videoId: video.id, createdAt: new Date().toISOString() });
  }
  save();
  res.json({ saved: index < 0 });
});

videosRouter.get("/:id/comments", (req, res) => {
  const all = db();
  const video = all.videos.find((v) => v.id === req.params.id);
  if (!video) throw new ApiError(404, "Lesson not found.");
  const isOwner = req.user && (video.uploadedBy === req.user.id || video.teacherId === req.user.id);
  const isAdmin = req.user?.role === "admin";
  const isDraft = (video.lessonStatus ?? "published") !== "published";
  if ((!isPublicVideo(video) || isDraft) && !isOwner && !isAdmin) throw new ApiError(404, "Lesson not found.");
  const comments = all.comments
    .filter((c) => c.videoId === video.id)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map(publicComment);
  res.json({ comments });
});

videosRouter.post("/:id/comments", authRequired, asyncHandler(async (req, res) => {
  const parsed = z.object({ text: z.string().trim().min(1, "Write a comment first.").max(500, "Keep comments under 500 characters.") }).safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);
  const all = db();
  const video = all.videos.find((v) => v.id === req.params.id && isPublicVideo(v));
  if (!video) throw new ApiError(404, "Lesson not found.");
  const comment = {
    id: `cm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    videoId: video.id,
    userId: req.user.id,
    text: parsed.data.text,
    createdAt: new Date().toISOString(),
  };
  all.comments.push(comment);
  const ownerId = video.uploadedBy || video.teacherId;
  if (ownerId && ownerId !== req.user.id) {
    notify(ownerId, `${req.user.name} commented on "${video.title}".`, `${req.user.name} በ"${video.titleAm || video.title}" ላይ አስተያየት ሰጡ።`, `/app/lessons/${video.id}`);
  }
  save();
  res.status(201).json({ comment: publicComment(comment) });
}));
