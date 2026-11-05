import { Router } from "express";
import { z } from "zod";
import { db, save, newId } from "../store.js";
import { ApiError, asyncHandler, courseOut, findUser, isPublicVideo, notify, publicComment, teacherOut, videoOut } from "../lib.js";
import { authRequired, optionalAuth } from "../auth.js";

export const miscRouter = Router();

miscRouter.get("/health", (_req, res) => {
  res.json({ ok: true, service: "tewahedo-learn-api", time: new Date().toISOString() });
});

miscRouter.get("/categories", (_req, res) => {
  res.json({ categories: db().categories });
});

miscRouter.get("/search", optionalAuth, (req, res) => {
  const needle = String(req.query.q || "").trim().toLowerCase();
  if (!needle) return res.json({ videos: [], courses: [], teachers: [] });
  const all = db();
  const videos = all.videos
    .filter(isPublicVideo)
    .filter((v) => {
      const teacher = findUser(v.teacherId)?.name ?? "";
      return [v.title, v.titleAm, v.description, v.descriptionAm, teacher]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    })
    .slice(0, 20)
    .map((v) => videoOut(v, req.user?.id));
  const courses = all.courses
    .filter((c) => [c.title, c.titleAm, c.description, c.descriptionAm].some((value) => String(value).toLowerCase().includes(needle)))
    .slice(0, 10)
    .map((c) => courseOut(c, req.user?.id));
  const teachers = all.users
    .filter((u) => u.active && (u.role === "teacher" || all.videos.some((v) => v.teacherId === u.id)))
    .filter((u) => [u.name, u.bio].some((value) => String(value).toLowerCase().includes(needle)))
    .slice(0, 10)
    .map((u) => teacherOut(u, req.user?.id));
  res.json({ videos, courses, teachers });
});

miscRouter.get("/community", optionalAuth, (req, res) => {
  const all = db();
  const publicIds = new Set(all.videos.filter(isPublicVideo).map((v) => v.id));
  const comments = [...all.comments]
    .filter((c) => publicIds.has(c.videoId))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 30)
    .map(publicComment);
  const teachers = all.users
    .filter((u) => u.active && u.role === "teacher")
    .map((u) => teacherOut(u, req.user?.id))
    .sort((a, b) => b.followers - a.followers || a.name.localeCompare(b.name))
    .slice(0, 4);
  res.json({ comments, teachers, members: all.users.length });
});

const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  message: z.string().trim().min(10, "Write at least 10 characters.").max(2000, "Keep the message under 2000 characters."),
});

miscRouter.post("/contact", asyncHandler(async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);
  const all = db();
  const message = {
    id: newId("msg"),
    ...parsed.data,
    read: false,
    createdAt: new Date().toISOString(),
  };
  all.messages.push(message);
  for (const admin of all.users.filter((u) => u.role === "admin")) {
    notify(admin.id, `New contact message from ${message.name}.`, `ከ${message.name} አዲስ የመልእክት ጥያቄ መጥቷል።`, "/app/admin");
  }
  save();
  res.status(201).json({ message: { id: message.id } });
}));

miscRouter.get("/notifications", authRequired, (req, res) => {
  const list = db().notifications
    .filter((n) => n.userId === req.user.id)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 50);
  res.json({
    notifications: list,
    unread: list.filter((n) => !n.read).length,
  });
});

miscRouter.patch("/notifications/:id/read", authRequired, (req, res) => {
  const item = db().notifications.find((n) => n.id === req.params.id && n.userId === req.user.id);
  if (!item) throw new ApiError(404, "Notification not found.");
  item.read = true;
  save();
  res.json({ notification: item });
});

miscRouter.post("/notifications/read-all", authRequired, (req, res) => {
  const all = db();
  for (const item of all.notifications) if (item.userId === req.user.id) item.read = true;
  save();
  res.json({ ok: true });
});

miscRouter.delete("/comments/:id", authRequired, (req, res) => {
  const all = db();
  const index = all.comments.findIndex((c) => c.id === req.params.id);
  if (index < 0) throw new ApiError(404, "Comment not found.");
  const comment = all.comments[index];
  if (comment.userId !== req.user.id && req.user.role !== "admin" && req.user.role !== "teacher") {
    throw new ApiError(403, "You can only delete your own comment.");
  }
  all.comments.splice(index, 1);
  save();
  res.json({ deleted: true });
});
