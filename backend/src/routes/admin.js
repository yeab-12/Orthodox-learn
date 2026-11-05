import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { z } from "zod";
import { db, save, newId } from "../store.js";
import { ApiError, courseOut, findUser, notify, publicComment, userOut, videoOut } from "../lib.js";
import { adminOnly } from "../auth.js";
import { demoDir, videosDir } from "../paths.js";

export const adminRouter = Router();
adminRouter.use(adminOnly);

const statuses = ["pending", "approved", "rejected"];

function storedFileExists(video) {
  if (video.demo) return fs.existsSync(path.join(demoDir, "sample.mp4"));
  if (!video.storedName) return false;
  return fs.existsSync(path.join(videosDir, video.storedName));
}

function adminVideoOut(video, viewerId) {
  return { ...videoOut(video, viewerId, { includeStatus: true }), fileExists: storedFileExists(video) };
}

function addVideoToCourse(all, video, courseId) {
  if (courseId) {
    const course = all.courses.find((c) => c.id === courseId);
    if (!course) throw new ApiError(400, "Course not found.");
    if (!course.videoIds.includes(video.id)) course.videoIds.push(video.id);
    video.courseId = course.id;
  } else {
    for (const course of all.courses) course.videoIds = course.videoIds.filter((id) => id !== video.id);
    video.courseId = null;
  }
}

function approveVideo(all, video) {
  video.status = "approved";
  video.archived = false;
  video.approvedAt = new Date().toISOString();
  video.rejectionReason = "";
  const courseId = video.requestedCourseId || video.courseId;
  if (courseId) {
    const course = all.courses.find((c) => c.id === courseId);
    if (course && !course.videoIds.includes(video.id)) {
      course.videoIds.push(video.id);
      video.courseId = course.id;
    }
  }
  const uploader = findUser(video.uploadedBy || video.teacherId);
  if (uploader && uploader.role === "student") uploader.role = "teacher";
  return uploader;
}

function rejectVideo(all, video, reason) {
  video.status = "rejected";
  video.archived = false;
  video.rejectionReason = reason || "The lesson needs changes before it can be published.";
  for (const course of all.courses) course.videoIds = course.videoIds.filter((id) => id !== video.id);
  video.courseId = null;
  return findUser(video.uploadedBy || video.teacherId);
}

function bulkNotify(recipients, approve, count) {
  for (const [userId, total] of recipients) {
    if (!userId) continue;
    if (approve) {
      notify(
        userId,
        `${total} of your lessons were approved and are now public.`,
        `${total} ትምህርቶችዎ ጸድቀው አሁን ለሁሉም ይታያሉ።`,
        "/app/my-uploads",
      );
    } else {
      notify(
        userId,
        `${total} of your lessons need changes before they can be published.`,
        `${total} ትምህርቶችዎ ከመታተማቸው በፊት ማስተካከል ይፈልጋሉ።`,
        "/app/my-uploads",
      );
    }
  }
}

adminRouter.get("/stats", (_req, res) => {
  const all = db();
  res.json({
    users: all.users.length,
    students: all.users.filter((u) => u.role === "student").length,
    teachers: all.users.filter((u) => u.role === "teacher").length,
    videos: all.videos.length,
    approved: all.videos.filter((v) => v.status === "approved" && !v.archived).length,
    pending: all.videos.filter((v) => v.status === "pending").length,
    rejected: all.videos.filter((v) => v.status === "rejected").length,
    archived: all.videos.filter((v) => v.archived).length,
    courses: all.courses.length,
    comments: all.comments.length,
    messages: all.messages.length,
    unreadMessages: all.messages.filter((m) => !m.read).length,
  });
});

/**
 * Admin video library. Supports search, filters, sorting and pagination so it
 * stays responsive with hundreds or thousands of lessons.
 */
adminRouter.get("/videos", (req, res) => {
  const all = db();
  const status = String(req.query.status || "all");
  const archived = String(req.query.archived ?? "all");
  const categoryId = String(req.query.categoryId || "");
  const language = String(req.query.language || "");
  const teacherId = String(req.query.teacherId || req.query.creatorId || "");
  const courseId = String(req.query.courseId || "");
  const q = String(req.query.q || "").trim().toLowerCase();
  const sort = String(req.query.sort || "newest");
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 50));

  let list = [...all.videos];
  if (status && status !== "all") list = list.filter((v) => v.status === status);
  if (archived === "true") list = list.filter((v) => v.archived);
  else if (archived === "false") list = list.filter((v) => !v.archived);
  if (categoryId && categoryId !== "all") list = list.filter((v) => v.categoryId === categoryId);
  if (language && language !== "all") list = list.filter((v) => v.language === language);
  if (teacherId) list = list.filter((v) => v.teacherId === teacherId || v.uploadedBy === teacherId);
  if (courseId) {
    const course = all.courses.find((c) => c.id === courseId);
    list = list.filter((v) => v.courseId === courseId || course?.videoIds.includes(v.id));
  }
  if (q) {
    list = list.filter((v) => {
      const teacher = findUser(v.teacherId)?.name ?? "";
      return [v.title, v.titleAm, v.description, v.descriptionAm, v.originalName, teacher, v.categoryId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }

  const rank = { pending: 0, rejected: 1, approved: 2 };
  if (sort === "oldest") list.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  else if (sort === "title") list.sort((a, b) => String(a.title).localeCompare(String(b.title)));
  else if (sort === "duration") list.sort((a, b) => (a.durationSec || 0) - (b.durationSec || 0));
  else if (sort === "status") list.sort((a, b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3) || String(b.createdAt).localeCompare(String(a.createdAt)));
  else list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  const total = list.length;
  const pageItems = list.slice((page - 1) * pageSize, page * pageSize);

  const creators = all.users
    .filter((u) => u.role === "teacher" || u.role === "admin" || all.videos.some((v) => v.uploadedBy === u.id))
    .map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      videoCount: all.videos.filter((v) => v.uploadedBy === u.id || v.teacherId === u.id).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  res.json({
    videos: pageItems.map((v) => adminVideoOut(v, req.user.id)),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    stats: {
      all: all.videos.length,
      pending: all.videos.filter((v) => v.status === "pending").length,
      approved: all.videos.filter((v) => v.status === "approved" && !v.archived).length,
      rejected: all.videos.filter((v) => v.status === "rejected").length,
      archived: all.videos.filter((v) => v.archived).length,
      failed: all.videos.filter((v) => (v.mediaState ?? "ready") === "failed" || !storedFileExists(v)).length,
    },
    facets: {
      creators,
      categories: all.categories,
      languages: [
        { id: "en", name: "English" },
        { id: "am", name: "አማርኛ" },
      ],
      courses: all.courses.map((c) => ({ id: c.id, title: c.title, titleAm: c.titleAm || c.title })),
    },
  });
});

const updateSchema = z.object({
  title: z.string().trim().min(3, "Enter a title of at least 3 characters.").max(160).optional(),
  titleAm: z.string().trim().max(160).optional(),
  description: z.string().trim().max(2000).optional(),
  descriptionAm: z.string().trim().max(2000).optional(),
  categoryId: z.string().optional(),
  language: z.enum(["en", "am"]).optional(),
  cover: z.coerce.number().int().min(0).max(3).optional(),
  durationSec: z.coerce.number().positive().max(300, "Lessons must be 5 minutes or shorter.").optional(),
  attribution: z.string().trim().max(300).optional(),
  status: z.enum(["approved", "rejected", "pending"]).optional(),
  rejectionReason: z.string().trim().max(500).optional(),
  courseId: z.string().optional(),
  archived: z.boolean().optional(),
}).strict();

adminRouter.patch("/videos/bulk", (req, res) => {
  const parsed = z.object({
    ids: z.array(z.string()).min(1, "Select at least one lesson.").max(500),
    action: z.enum(["approve", "publish", "reject", "pending", "archive", "unarchive", "retry", "assignCourse"]),
    reason: z.string().trim().max(500).optional().default(""),
    courseId: z.string().optional().default(""),
  }).safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);

  const all = db();
  const ids = [...new Set(parsed.data.ids)];
  const targets = ids.map((id) => all.videos.find((v) => v.id === id)).filter(Boolean);
  if (targets.length === 0) throw new ApiError(404, "No matching lessons were found.");

  if (parsed.data.action === "assignCourse" && parsed.data.courseId) {
    if (!all.courses.some((c) => c.id === parsed.data.courseId)) throw new ApiError(400, "Course not found.");
  }

  const approvedRecipients = new Map();
  const rejectedRecipients = new Map();
  let updated = 0;

  for (const video of targets) {
    const before = `${video.status}:${Boolean(video.archived)}:${video.courseId ?? ""}:${video.mediaState ?? "ready"}`;
    const uploaderId = video.uploadedBy || video.teacherId;
    switch (parsed.data.action) {
      case "approve":
      case "publish": {
        approveVideo(all, video);
        approvedRecipients.set(uploaderId, (approvedRecipients.get(uploaderId) ?? 0) + 1);
        break;
      }
      case "reject": {
        rejectVideo(all, video, parsed.data.reason);
        rejectedRecipients.set(uploaderId, (rejectedRecipients.get(uploaderId) ?? 0) + 1);
        break;
      }
      case "pending": {
        video.status = "pending";
        video.archived = false;
        video.rejectionReason = "";
        break;
      }
      case "archive": {
        video.archived = true;
        break;
      }
      case "unarchive": {
        video.archived = false;
        break;
      }
      case "retry": {
        const exists = storedFileExists(video);
        video.retryCount = (video.retryCount ?? 0) + 1;
        video.lastRetryAt = new Date().toISOString();
        if (exists) {
          video.mediaState = "ready";
          video.status = "pending";
          video.archived = false;
          video.rejectionReason = "";
        } else {
          video.mediaState = "failed";
        }
        break;
      }
      case "assignCourse": {
        addVideoToCourse(all, video, parsed.data.courseId);
        break;
      }
      default:
        break;
    }
    const after = `${video.status}:${Boolean(video.archived)}:${video.courseId ?? ""}:${video.mediaState ?? "ready"}`;
    if (before !== after) updated += 1;
  }

  if (approvedRecipients.size) bulkNotify(approvedRecipients, true);
  if (rejectedRecipients.size) bulkNotify(rejectedRecipients, false);
  save();
  res.json({ updated, matched: targets.length, ids: targets.map((v) => v.id) });
});

adminRouter.patch("/videos/:id", (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);
  const all = db();
  const video = all.videos.find((v) => v.id === req.params.id);
  if (!video) throw new ApiError(404, "Lesson not found.");
  const data = parsed.data;

  if (data.categoryId !== undefined && !all.categories.some((c) => c.id === data.categoryId)) {
    throw new ApiError(400, "Choose a valid category.");
  }
  if (data.courseId !== undefined) addVideoToCourse(all, video, data.courseId);

  if (data.title !== undefined) video.title = data.title;
  if (data.titleAm !== undefined) video.titleAm = data.titleAm || video.title;
  if (data.description !== undefined) video.description = data.description;
  if (data.descriptionAm !== undefined) video.descriptionAm = data.descriptionAm;
  if (data.categoryId !== undefined) video.categoryId = data.categoryId;
  if (data.language !== undefined) video.language = data.language;
  if (data.cover !== undefined) video.cover = data.cover;
  if (data.durationSec !== undefined) video.durationSec = Math.round(data.durationSec);
  if (data.attribution !== undefined) video.attribution = data.attribution;
  if (data.archived !== undefined) video.archived = data.archived;

  if (data.status && data.status !== video.status) {
    const uploader = data.status === "approved"
      ? approveVideo(all, video)
      : data.status === "rejected"
        ? rejectVideo(all, video, data.rejectionReason)
        : null;
    if (data.status === "pending") {
      video.status = "pending";
      video.archived = false;
      video.rejectionReason = "";
    }
    if (uploader) {
      if (data.status === "approved") {
        notify(
          uploader.id,
          `Your lesson "${video.title}" was approved and is now public.`,
          `ትምህርትዎ "${video.titleAm || video.title}" ጸድቆ አሁን ለሁሉም ይታያል።`,
          `/app/lessons/${video.id}`,
        );
      } else {
        notify(
          uploader.id,
          `Your lesson "${video.title}" was not approved. Reason: ${video.rejectionReason}`,
          `ትምህርትዎ "${video.titleAm || video.title}" አልጸደቀም። ምክንያት፦ ${video.rejectionReason}`,
          "/app/my-uploads",
        );
      }
    }
  } else if (data.rejectionReason !== undefined) {
    video.rejectionReason = data.rejectionReason;
  }

  save();
  res.json({ video: adminVideoOut(video, req.user.id) });
});

adminRouter.post("/videos/:id/retry", (req, res) => {
  const all = db();
  const video = all.videos.find((v) => v.id === req.params.id);
  if (!video) throw new ApiError(404, "Lesson not found.");
  if (!storedFileExists(video)) {
    video.mediaState = "failed";
    save();
    throw new ApiError(400, "The original media file is missing. Please upload it again.");
  }
  video.mediaState = "ready";
  video.status = "pending";
  video.archived = false;
  video.rejectionReason = "";
  video.retryCount = (video.retryCount ?? 0) + 1;
  video.lastRetryAt = new Date().toISOString();
  const uploader = findUser(video.uploadedBy || video.teacherId);
  if (uploader) {
    notify(
      uploader.id,
      `Your lesson "${video.title}" was queued for review again.`,
      `ትምህርትዎ "${video.titleAm || video.title}" እንደገና ለግምገማ ተመዝግቧል።`,
      "/app/my-uploads",
    );
  }
  save();
  res.json({ video: adminVideoOut(video, req.user.id) });
});

adminRouter.delete("/videos/:id", (req, res) => {
  const all = db();
  const index = all.videos.findIndex((v) => v.id === req.params.id);
  if (index < 0) throw new ApiError(404, "Lesson not found.");
  const video = all.videos[index];
  if (!video.demo && video.storedName) {
    const filePath = path.join(videosDir, video.storedName);
    try {
      if (path.resolve(filePath).startsWith(path.resolve(videosDir))) fs.unlinkSync(filePath);
    } catch {
      /* file may already be gone */
    }
  }
  all.videos.splice(index, 1);
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

adminRouter.get("/users", (req, res) => {
  const all = db();
  res.json({
    users: all.users.map((u) => ({
      ...userOut(u),
      uploads: all.videos.filter((v) => v.uploadedBy === u.id).length,
      comments: all.comments.filter((c) => c.userId === u.id).length,
    })),
  });
});

adminRouter.patch("/users/:id", (req, res) => {
  const parsed = z.object({
    role: z.enum(["student", "teacher", "admin"]).optional(),
    active: z.boolean().optional(),
  }).safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Check the role and try again.");
  if (req.params.id === req.user.id) throw new ApiError(400, "You cannot change your own admin account here.");
  const user = findUser(req.params.id);
  if (!user) throw new ApiError(404, "User not found.");
  if (parsed.data.role) user.role = parsed.data.role;
  if (parsed.data.active !== undefined) user.active = parsed.data.active;
  notify(
    user.id,
    parsed.data.active === false ? "Your account was disabled by an administrator." : "An administrator updated your account.",
    parsed.data.active === false ? "መለያዎ በአስተዳዳሪ ተሰናክሏል።" : "አስተዳዳሪ መለያዎን አዘምኗል።",
    "/app/profile",
  );
  save();
  res.json({ user: userOut(user) });
});

adminRouter.get("/courses", (req, res) => {
  res.json({
    courses: db().courses.map((c) => ({ ...courseOut(c, req.user.id), videoIds: c.videoIds })),
  });
});

const courseSchema = z.object({
  title: z.string().trim().min(3, "Enter a course title.").max(160),
  titleAm: z.string().trim().max(160).optional().default(""),
  description: z.string().trim().max(1000).optional().default(""),
  descriptionAm: z.string().trim().max(1000).optional().default(""),
  teacherId: z.string().min(1, "Choose a teacher."),
  language: z.enum(["en", "am"]),
  cover: z.coerce.number().int().min(0).max(3).optional().default(0),
  videoIds: z.array(z.string()).optional().default([]),
});

adminRouter.post("/courses", (req, res) => {
  const parsed = courseSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);
  const all = db();
  if (!findUser(parsed.data.teacherId)) throw new ApiError(400, "Teacher not found.");
  const course = {
    id: newId("c"),
    ...parsed.data,
    titleAm: parsed.data.titleAm || parsed.data.title,
    descriptionAm: parsed.data.descriptionAm || parsed.data.description,
    videoIds: parsed.data.videoIds.filter((id) => all.videos.some((v) => v.id === id)),
    createdAt: new Date().toISOString(),
  };
  all.courses.push(course);
  for (const id of course.videoIds) {
    const video = all.videos.find((v) => v.id === id);
    if (video) video.courseId = course.id;
  }
  save();
  res.status(201).json({ course: courseOut(course, req.user.id) });
});

adminRouter.patch("/courses/:id", (req, res) => {
  const parsed = courseSchema.partial().safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);
  const all = db();
  const course = all.courses.find((c) => c.id === req.params.id);
  if (!course) throw new ApiError(404, "Course not found.");
  if (parsed.data.teacherId && !findUser(parsed.data.teacherId)) throw new ApiError(400, "Teacher not found.");
  Object.assign(course, parsed.data);
  if (parsed.data.videoIds) {
    for (const video of all.videos) {
      if (video.courseId === course.id && !parsed.data.videoIds.includes(video.id)) video.courseId = null;
    }
    for (const id of parsed.data.videoIds) {
      const video = all.videos.find((v) => v.id === id);
      if (video) video.courseId = course.id;
    }
  }
  save();
  res.json({ course: courseOut(course, req.user.id) });
});

adminRouter.delete("/courses/:id", (req, res) => {
  const all = db();
  const index = all.courses.findIndex((c) => c.id === req.params.id);
  if (index < 0) throw new ApiError(404, "Course not found.");
  const [course] = all.courses.splice(index, 1);
  for (const video of all.videos) if (video.courseId === course.id) video.courseId = null;
  all.enrollments = all.enrollments.filter((e) => e.courseId !== course.id);
  save();
  res.json({ deleted: true });
});

adminRouter.get("/messages", (_req, res) => {
  res.json({
    messages: [...db().messages].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
  });
});

adminRouter.patch("/messages/:id", (req, res) => {
  const message = db().messages.find((m) => m.id === req.params.id);
  if (!message) throw new ApiError(404, "Message not found.");
  message.read = true;
  save();
  res.json({ message });
});

adminRouter.get("/comments", (_req, res) => {
  res.json({
    comments: [...db().comments]
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map(publicComment),
  });
});

adminRouter.delete("/comments/:id", (req, res) => {
  const all = db();
  const index = all.comments.findIndex((c) => c.id === req.params.id);
  if (index < 0) throw new ApiError(404, "Comment not found.");
  all.comments.splice(index, 1);
  save();
  res.json({ deleted: true });
});
