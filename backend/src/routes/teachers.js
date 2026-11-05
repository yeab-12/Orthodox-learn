import { Router } from "express";
import { db, save } from "../store.js";
import { ApiError, courseOut, isPublicVideo, teacherOut, videoOut } from "../lib.js";
import { authRequired, optionalAuth } from "../auth.js";

export const teachersRouter = Router();
teachersRouter.use(optionalAuth);

teachersRouter.get("/", (req, res) => {
  const all = db();
  const list = all.users
    .filter((u) => u.active && (u.role === "teacher" || all.videos.some((v) => v.teacherId === u.id && isPublicVideo(v))))
    .map((u) => teacherOut(u, req.user?.id))
    .sort((a, b) => b.followers - a.followers || a.name.localeCompare(b.name));
  res.json({ teachers: list });
});

teachersRouter.get("/:id", (req, res) => {
  const all = db();
  const teacher = all.users.find((u) => u.id === req.params.id && u.active);
  if (!teacher) throw new ApiError(404, "Teacher not found.");
  const videos = all.videos
    .filter((v) => v.teacherId === teacher.id && isPublicVideo(v))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map((v) => videoOut(v, req.user?.id));
  const courses = all.courses
    .filter((c) => c.teacherId === teacher.id)
    .map((c) => courseOut(c, req.user?.id));
  res.json({ teacher: teacherOut(teacher, req.user?.id), videos, courses });
});

teachersRouter.post("/:id/follow", authRequired, (req, res) => {
  const all = db();
  const teacher = all.users.find((u) => u.id === req.params.id && u.active);
  if (!teacher) throw new ApiError(404, "Teacher not found.");
  if (teacher.id === req.user.id) throw new ApiError(400, "You cannot follow yourself.");
  const index = all.follows.findIndex((f) => f.userId === req.user.id && f.teacherId === teacher.id);
  if (index >= 0) all.follows.splice(index, 1);
  else all.follows.push({ userId: req.user.id, teacherId: teacher.id, createdAt: new Date().toISOString() });
  save();
  res.json({ following: index < 0, followers: all.follows.filter((f) => f.teacherId === teacher.id).length });
});
