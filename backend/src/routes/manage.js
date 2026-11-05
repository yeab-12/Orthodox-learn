import { Router } from "express";
import { z } from "zod";
import { db, save, newId } from "../store.js";
import { ApiError, findUser, videoOut } from "../lib.js";
import { authRequired } from "../auth.js";
import {
  COURSE_STATUSES,
  COURSE_VISIBILITIES,
  DIFFICULTIES,
  QUESTION_TYPES,
  QUIZ_TYPES,
  canManageCourse,
  courseAnalytics,
  courseDetailOut,
  courseSummaryOut,
  enrollmentOut,
  findQuiz,
  newQuestion,
  quizMeta,
  quizOut,
  touchCourse,
} from "../courseLib.js";

export const manageRouter = Router();
manageRouter.use(authRequired);

function requireManager(req, _res, next) {
  if (req.user.role !== "admin" && req.user.role !== "teacher") {
    return next(new ApiError(403, "Course management requires a teacher or administrator account."));
  }
  next();
}
manageRouter.use(requireManager);

function managedCourse(id, user) {
  const course = db().courses.find((item) => item.id === id);
  if (!course) throw new ApiError(404, "Course not found.");
  if (!canManageCourse(user, course)) throw new ApiError(404, "Course not found.");
  return course;
}

function teacherUser(id) {
  const user = findUser(id);
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    throw new ApiError(400, "Choose a valid teacher.");
  }
  return user;
}

function normalizeStrings(values) {
  return (values ?? []).map((value) => String(value).trim()).filter(Boolean);
}

function normalizeResources(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => {
      if (typeof value === "string") return { title: value.trim(), url: "" };
      return {
        title: String(value?.title ?? "").trim(),
        url: String(value?.url ?? "").trim(),
      };
    })
    .filter((item) => item.title || item.url);
}

function ensureCategory(id) {
  if (!id) return "theology";
  if (!db().categories.some((category) => category.id === id)) throw new ApiError(400, "Choose a valid category.");
  return id;
}

function canEditVideo(user, video) {
  if (user.role === "admin") return true;
  return video.teacherId === user.id || video.uploadedBy === user.id;
}

function ensureCanAttachVideo(user, video) {
  if (user.role === "admin") return video;
  if (video.teacherId !== user.id && video.uploadedBy !== user.id) {
    throw new ApiError(403, "You can only attach lessons that you own.");
  }
  return video;
}

function courseVideoIds(input, user) {
  const ids = [...new Set((input ?? []).filter(Boolean))];
  return ids.map((id) => {
    const video = db().videos.find((item) => item.id === id);
    if (!video) throw new ApiError(400, `Lesson ${id} was not found.`);
    ensureCanAttachVideo(user, video);
    return id;
  });
}

const courseFields = {
  title: z.string().trim().min(3, "Enter a course title.").max(160),
  titleAm: z.string().trim().max(160).optional(),
  description: z.string().trim().max(5000).optional(),
  descriptionAm: z.string().trim().max(5000).optional(),
  teacherId: z.string().min(1).optional(),
  categoryId: z.string().max(60).optional(),
  cover: z.coerce.number().int().min(0).max(3).optional(),
  language: z.enum(["en", "am"]).optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  estimatedDuration: z.coerce.number().int().min(0).max(1_000_000).optional(),
  objectives: z.array(z.string().max(400)).max(40).optional(),
  prerequisites: z.array(z.string().max(400)).max(40).optional(),
  status: z.enum(COURSE_STATUSES).optional(),
  visibility: z.enum(COURSE_VISIBILITIES).optional(),
  ordering: z.coerce.number().int().min(0).max(100_000).optional(),
  certificateEnabled: z.boolean().optional(),
  finalQuizId: z.string().nullable().optional(),
  videoIds: z.array(z.string()).max(500).optional(),
};

const courseCreateSchema = z.object({ ...courseFields, title: courseFields.title });
const coursePatchSchema = z.object(courseFields).partial();

function statusFor(user, current, requested) {
  if (!requested) return current ?? "draft";
  if (user.role === "admin") return requested;
  if (requested === "draft" || requested === "pending") return requested;
  if (requested === current) return current;
  throw new ApiError(403, "Only an administrator can publish or archive a course. Submit it for review instead.");
}

manageRouter.get("/courses", (req, res) => {
  const all = db();
  const { q, status, language, difficulty, teacherId, sort } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(5, Number(req.query.pageSize) || 10));
  const needle = String(q || "").trim().toLowerCase();

  let courses = all.courses.filter((course) => canManageCourse(req.user, course));
  if (status && status !== "all") courses = courses.filter((course) => (course.status ?? "published") === status);
  if (language && language !== "all") courses = courses.filter((course) => course.language === language);
  if (difficulty && difficulty !== "all") courses = courses.filter((course) => (course.difficulty ?? "beginner") === difficulty);
  if (teacherId) courses = courses.filter((course) => course.teacherId === teacherId);
  if (needle) {
    courses = courses.filter((course) =>
      [course.title, course.titleAm, course.description, course.descriptionAm]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }

  const enriched = courses.map((course) => {
    const analytics = courseAnalytics(course);
    return {
      ...courseSummaryOut(course, req.user),
      videoIds: [...course.videoIds],
      enrollments: analytics.enrollments,
      averageProgress: analytics.averageProgress,
      completionRate: analytics.completionRate,
      quizCount: all.quizzes.filter((quiz) => quiz.courseId === course.id).length,
    };
  });

  enriched.sort((a, b) => {
    switch (sort) {
      case "oldest":
        return String(a.createdAt).localeCompare(String(b.createdAt));
      case "title":
        return String(a.title).localeCompare(String(b.title));
      case "enrollments":
        return b.enrollments - a.enrollments;
      case "progress":
        return b.averageProgress - a.averageProgress;
      case "status":
        return String(a.status).localeCompare(String(b.status));
      case "newest":
      default:
        return String(b.createdAt).localeCompare(String(a.createdAt));
    }
  });

  const total = enriched.length;
  const start = (page - 1) * pageSize;
  res.json({
    courses: enriched.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    stats: {
      all: all.courses.filter((course) => canManageCourse(req.user, course)).length,
      published: all.courses.filter((course) => canManageCourse(req.user, course) && course.status === "published").length,
      draft: all.courses.filter((course) => canManageCourse(req.user, course) && course.status === "draft").length,
      pending: all.courses.filter((course) => canManageCourse(req.user, course) && course.status === "pending").length,
      archived: all.courses.filter((course) => canManageCourse(req.user, course) && course.status === "archived").length,
    },
  });
});

manageRouter.post("/courses", (req, res) => {
  const parsed = courseCreateSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message, parsed.error.flatten().fieldErrors);
  const input = parsed.data;
  const teacherId = req.user.role === "admin" ? input.teacherId || req.user.id : req.user.id;
  const teacher = teacherUser(teacherId);
  const course = {
    id: newId("c"),
    title: input.title,
    titleAm: input.titleAm || input.title,
    description: input.description ?? "",
    descriptionAm: input.descriptionAm ?? "",
    teacherId: teacher.id,
    categoryId: ensureCategory(input.categoryId),
    cover: input.cover ?? 0,
    language: input.language ?? "en",
    difficulty: input.difficulty ?? "beginner",
    estimatedDuration: Number(input.estimatedDuration) || 0,
    objectives: normalizeStrings(input.objectives),
    prerequisites: normalizeStrings(input.prerequisites),
    status: statusFor(req.user, "draft", input.status),
    visibility: input.visibility ?? "public",
    ordering: Number(input.ordering) || 0,
    certificateEnabled: input.certificateEnabled !== false,
    finalQuizId: null,
    videoIds: courseVideoIds(input.videoIds, req.user),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db().courses.push(course);
  for (const id of course.videoIds) {
    const video = db().videos.find((item) => item.id === id);
    if (video) video.courseId = course.id;
  }
  save();
  res.status(201).json({ course: courseSummaryOut(course, req.user) });
});

manageRouter.get("/courses/:id", (req, res) => {
  const course = managedCourse(req.params.id, req.user);
  const detail = courseDetailOut(course, req.user);
  detail.videoIds = [...course.videoIds];
  detail.quizzes = db().quizzes
    .filter((quiz) => quiz.courseId === course.id)
    .map((quiz) => quizOut(quiz, req.user.id, { includeAnswers: true }));
  detail.enrollments = db().enrollments.filter((item) => item.courseId === course.id).length;
  res.json({ course: detail });
});

manageRouter.patch("/courses/:id", (req, res) => {
  const parsed = coursePatchSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message, parsed.error.flatten().fieldErrors);
  const course = managedCourse(req.params.id, req.user);
  const input = parsed.data;

  if (input.teacherId && input.teacherId !== course.teacherId) {
    if (req.user.role !== "admin") throw new ApiError(403, "Only an administrator can reassign a course.");
    course.teacherId = teacherUser(input.teacherId).id;
  }
  if (input.categoryId !== undefined) course.categoryId = ensureCategory(input.categoryId);
  if (input.status !== undefined) course.status = statusFor(req.user, course.status, input.status);
  if (input.finalQuizId !== undefined) {
    if (input.finalQuizId) {
      const quiz = db().quizzes.find((item) => item.id === input.finalQuizId && item.courseId === course.id);
      if (!quiz) throw new ApiError(400, "Choose a quiz from this course.");
    }
    course.finalQuizId = input.finalQuizId || null;
  }
  if (input.videoIds !== undefined) {
    course.videoIds = courseVideoIds(input.videoIds, req.user);
    for (const video of db().videos) {
      if (video.courseId === course.id && !course.videoIds.includes(video.id)) video.courseId = null;
    }
    for (const id of course.videoIds) {
      const video = db().videos.find((item) => item.id === id);
      if (video) video.courseId = course.id;
    }
  }

  if (input.title !== undefined) course.title = input.title;
  if (input.titleAm !== undefined) course.titleAm = input.titleAm || course.title;
  if (input.description !== undefined) course.description = input.description;
  if (input.descriptionAm !== undefined) course.descriptionAm = input.descriptionAm;
  if (input.cover !== undefined) course.cover = input.cover;
  if (input.language !== undefined) course.language = input.language;
  if (input.difficulty !== undefined) course.difficulty = input.difficulty;
  if (input.estimatedDuration !== undefined) course.estimatedDuration = input.estimatedDuration;
  if (input.objectives !== undefined) course.objectives = normalizeStrings(input.objectives);
  if (input.prerequisites !== undefined) course.prerequisites = normalizeStrings(input.prerequisites);
  if (input.visibility !== undefined) course.visibility = input.visibility;
  if (input.ordering !== undefined) course.ordering = input.ordering;
  if (input.certificateEnabled !== undefined) course.certificateEnabled = input.certificateEnabled;
  touchCourse(course);
  save();
  res.json({ course: courseSummaryOut(course, req.user) });
});

/** Archive by default. A permanent delete is available to administrators only. */
manageRouter.delete("/courses/:id", (req, res) => {
  const course = managedCourse(req.params.id, req.user);
  const permanent = req.query.permanent === "true" || req.query.permanent === "1";
  if (!permanent) {
    course.status = "archived";
    touchCourse(course);
    save();
    return res.json({ archived: true, course: courseSummaryOut(course, req.user) });
  }
  if (req.user.role !== "admin") throw new ApiError(403, "Only an administrator can permanently delete a course.");
  const all = db();
  const quizIds = new Set(all.quizzes.filter((quiz) => quiz.courseId === course.id).map((quiz) => quiz.id));
  all.courses = all.courses.filter((item) => item.id !== course.id);
  all.quizzes = all.quizzes.filter((quiz) => quiz.courseId !== course.id);
  all.quizAttempts = all.quizAttempts.filter((attempt) => !quizIds.has(attempt.quizId) && attempt.courseId !== course.id);
  all.lessonProgress = all.lessonProgress.filter((row) => row.courseId !== course.id);
  for (const video of all.videos) {
    if (video.courseId === course.id) video.courseId = null;
  }
  save();
  res.json({ deleted: true });
});

manageRouter.post("/courses/:id/publish", (req, res) => {
  const course = managedCourse(req.params.id, req.user);
  const status = z.enum(COURSE_STATUSES).safeParse(req.body?.status);
  if (!status.success) throw new ApiError(400, "Choose a valid status.");
  course.status = statusFor(req.user, course.status, status.data);
  touchCourse(course);
  save();
  res.json({ course: courseSummaryOut(course, req.user) });
});

/* ------------------------------------------------------------------ */
/* Lessons                                                             */
/* ------------------------------------------------------------------ */

manageRouter.get("/library", (req, res) => {
  const all = db();
  const { q } = req.query;
  const needle = String(q || "").trim().toLowerCase();
  let videos = all.videos.filter((video) => !video.archived);
  if (req.user.role !== "admin") {
    videos = videos.filter((video) =>
      video.teacherId === req.user.id ||
      video.uploadedBy === req.user.id ||
      (video.status ?? "approved") === "approved",
    );
  }
  if (needle) {
    videos = videos.filter((video) =>
      [video.title, video.titleAm, video.originalName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }
  res.json({
    videos: videos
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 100)
      .map((video) => videoOut(video, req.user.id, { includeStatus: true })),
  });
});

manageRouter.get("/courses/:id/lessons", (req, res) => {
  const course = managedCourse(req.params.id, req.user);
  const detail = courseDetailOut(course, req.user);
  res.json({ lessons: detail.lessons, videoIds: [...course.videoIds] });
});

const lessonSchema = z.object({
  videoId: z.string().optional(),
  title: z.string().trim().min(2, "Enter a lesson title.").max(200),
  titleAm: z.string().trim().max(200).optional(),
  description: z.string().trim().max(5000).optional(),
  descriptionAm: z.string().trim().max(5000).optional(),
  categoryId: z.string().max(60).optional(),
  language: z.enum(["en", "am"]).optional(),
  cover: z.coerce.number().int().min(0).max(3).optional(),
  durationSec: z.coerce.number().int().min(0).max(100_000).optional(),
  mediaType: z.enum(["video", "audio"]).optional(),
  objectives: z.array(z.string().max(400)).max(40).optional(),
  resources: z.array(z.union([z.string(), z.object({ title: z.string().optional(), url: z.string().optional() })])).max(40).optional(),
  downloadTitle: z.string().max(200).optional(),
  downloadUrl: z.string().max(2000).optional(),
  lessonStatus: z.enum(["published", "draft"]).optional(),
});

manageRouter.post("/courses/:id/lessons", (req, res) => {
  const parsed = lessonSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message, parsed.error.flatten().fieldErrors);
  const course = managedCourse(req.params.id, req.user);
  const input = parsed.data;
  const all = db();

  let video;
  if (input.videoId) {
    video = all.videos.find((item) => item.id === input.videoId);
    if (!video) throw new ApiError(404, "Lesson not found.");
    ensureCanAttachVideo(req.user, video);
  } else {
    video = {
      id: newId("v"),
      title: input.title,
      titleAm: input.titleAm || input.title,
      teacherId: course.teacherId,
      uploadedBy: req.user.id,
      categoryId: ensureCategory(input.categoryId || course.categoryId),
      language: input.language ?? course.language ?? "en",
      durationSec: Number(input.durationSec) || 0,
      cover: input.cover ?? 0,
      description: input.description ?? "",
      descriptionAm: input.descriptionAm ?? "",
      videoUrl: null,
      mediaType: input.mediaType ?? "video",
      demo: false,
      status: "approved",
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
    };
    all.videos.push(video);
  }

  video.courseId = course.id;
  if (input.videoId) {
    if (input.title) video.title = input.title;
    if (input.titleAm !== undefined) video.titleAm = input.titleAm || video.title;
    if (input.description !== undefined) video.description = input.description;
    if (input.descriptionAm !== undefined) video.descriptionAm = input.descriptionAm;
    if (input.categoryId !== undefined) video.categoryId = ensureCategory(input.categoryId);
    if (input.language !== undefined) video.language = input.language;
    if (input.cover !== undefined) video.cover = input.cover;
    if (input.durationSec !== undefined) video.durationSec = input.durationSec;
    if (input.mediaType !== undefined) video.mediaType = input.mediaType;
  }
  if (input.objectives !== undefined) video.objectives = normalizeStrings(input.objectives);
  if (input.resources !== undefined) video.resources = normalizeResources(input.resources);
  if (input.downloadTitle !== undefined) video.downloadTitle = input.downloadTitle;
  if (input.downloadUrl !== undefined) video.downloadUrl = input.downloadUrl;
  video.lessonStatus = input.lessonStatus ?? "published";
  if (video.status !== "approved") {
    video.status = "approved";
    video.archived = false;
    video.approvedAt = new Date().toISOString();
  }

  if (!course.videoIds.includes(video.id)) course.videoIds.push(video.id);
  touchCourse(course);
  save();
  res.status(201).json({ lesson: videoOut(video, req.user.id, { includeStatus: true }), videoIds: [...course.videoIds] });
});

manageRouter.patch("/courses/:id/lessons/:videoId", (req, res) => {
  const parsed = lessonSchema.partial().safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);
  const course = managedCourse(req.params.id, req.user);
  const video = db().videos.find((item) => item.id === req.params.videoId);
  if (!video || !course.videoIds.includes(video.id)) throw new ApiError(404, "Lesson not found in this course.");
  if (!canEditVideo(req.user, video)) throw new ApiError(403, "You can only edit lessons that you own.");
  const input = parsed.data;

  if (input.title !== undefined) video.title = input.title;
  if (input.titleAm !== undefined) video.titleAm = input.titleAm || video.title;
  if (input.description !== undefined) video.description = input.description;
  if (input.descriptionAm !== undefined) video.descriptionAm = input.descriptionAm;
  if (input.categoryId !== undefined) video.categoryId = ensureCategory(input.categoryId);
  if (input.language !== undefined) video.language = input.language;
  if (input.cover !== undefined) video.cover = input.cover;
  if (input.durationSec !== undefined) video.durationSec = input.durationSec;
  if (input.mediaType !== undefined) video.mediaType = input.mediaType;
  if (input.objectives !== undefined) video.objectives = normalizeStrings(input.objectives);
  if (input.resources !== undefined) video.resources = normalizeResources(input.resources);
  if (input.downloadTitle !== undefined) video.downloadTitle = input.downloadTitle;
  if (input.downloadUrl !== undefined) video.downloadUrl = input.downloadUrl;
  if (input.lessonStatus !== undefined) video.lessonStatus = input.lessonStatus;
  touchCourse(course);
  save();
  res.json({ lesson: videoOut(video, req.user.id, { includeStatus: true }), videoIds: [...course.videoIds] });
});

manageRouter.delete("/courses/:id/lessons/:videoId", (req, res) => {
  const course = managedCourse(req.params.id, req.user);
  const video = db().videos.find((item) => item.id === req.params.videoId);
  if (!video || !course.videoIds.includes(video.id)) throw new ApiError(404, "Lesson not found in this course.");
  if (!canEditVideo(req.user, video)) throw new ApiError(403, "You can only remove lessons that you own.");
  course.videoIds = course.videoIds.filter((id) => id !== video.id);
  const usedElsewhere = db().courses.some((item) => item.id !== course.id && item.videoIds.includes(video.id));
  if (!usedElsewhere && video.courseId === course.id) video.courseId = null;
  touchCourse(course);
  save();
  res.json({ removed: true, videoIds: [...course.videoIds] });
});

manageRouter.post("/courses/:id/lessons/reorder", (req, res) => {
  const course = managedCourse(req.params.id, req.user);
  const ids = Array.isArray(req.body?.videoIds) ? req.body.videoIds.filter((id) => course.videoIds.includes(id)) : [];
  if (ids.length !== course.videoIds.length || new Set(ids).size !== course.videoIds.length) {
    throw new ApiError(400, "Send every lesson in the course exactly once.");
  }
  course.videoIds = ids;
  touchCourse(course);
  save();
  res.json({ videoIds: [...course.videoIds] });
});

manageRouter.post("/courses/:id/lessons/:videoId/move", (req, res) => {
  const course = managedCourse(req.params.id, req.user);
  const direction = req.body?.direction === "up" ? -1 : req.body?.direction === "down" ? 1 : 0;
  if (!direction) throw new ApiError(400, "Choose up or down.");
  const index = course.videoIds.indexOf(req.params.videoId);
  if (index < 0) throw new ApiError(404, "Lesson not found in this course.");
  const next = index + direction;
  if (next < 0 || next >= course.videoIds.length) throw new ApiError(400, "This lesson cannot move further.");
  [course.videoIds[index], course.videoIds[next]] = [course.videoIds[next], course.videoIds[index]];
  touchCourse(course);
  save();
  res.json({ videoIds: [...course.videoIds] });
});

/* ------------------------------------------------------------------ */
/* Quizzes                                                             */
/* ------------------------------------------------------------------ */

function quizCourse(quiz) {
  return db().courses.find((course) => course.id === quiz.courseId) ?? null;
}

function managedQuiz(id, user) {
  const quiz = findQuiz(id);
  if (!quiz) throw new ApiError(404, "Quiz not found.");
  const course = quizCourse(quiz);
  if (!canManageCourse(user, course)) throw new ApiError(404, "Quiz not found.");
  return { quiz, course };
}

const quizSchema = z.object({
  title: z.string().trim().min(3, "Enter a quiz title.").max(200),
  titleAm: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  descriptionAm: z.string().trim().max(2000).optional(),
  type: z.enum(QUIZ_TYPES).optional(),
  lessonId: z.string().nullable().optional(),
  passingScore: z.coerce.number().int().min(1).max(100).optional(),
  timeLimitMin: z.coerce.number().int().min(0).max(600).optional(),
  maxAttempts: z.coerce.number().int().min(0).max(100).optional(),
  available: z.boolean().optional(),
  published: z.boolean().optional(),
  showAnswers: z.boolean().optional(),
});

manageRouter.get("/courses/:id/quizzes", (req, res) => {
  const course = managedCourse(req.params.id, req.user);
  res.json({
    quizzes: db().quizzes
      .filter((quiz) => quiz.courseId === course.id)
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
      .map((quiz) => quizOut(quiz, req.user.id, { includeAnswers: true })),
  });
});

manageRouter.post("/courses/:id/quizzes", (req, res) => {
  const parsed = quizSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message, parsed.error.flatten().fieldErrors);
  const course = managedCourse(req.params.id, req.user);
  const input = parsed.data;
  const type = input.type ?? "practice";
  if (type === "final" && course.finalQuizId) {
    throw new ApiError(409, "This course already has a final quiz. Delete or reassign the existing one first.");
  }
  if (input.lessonId && !course.videoIds.includes(input.lessonId)) {
    throw new ApiError(400, "Choose a lesson from this course.");
  }
  const quiz = {
    id: newId("quiz"),
    courseId: course.id,
    lessonId: type === "lesson" ? input.lessonId ?? null : null,
    type,
    title: input.title,
    titleAm: input.titleAm || input.title,
    description: input.description ?? "",
    descriptionAm: input.descriptionAm ?? "",
    passingScore: input.passingScore ?? 70,
    timeLimitMin: input.timeLimitMin ?? 0,
    maxAttempts: input.maxAttempts ?? 0,
    available: input.available !== false,
    published: input.published === true,
    showAnswers: input.showAnswers !== false,
    questions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (quiz.published) throw new ApiError(400, "Add at least one question before publishing the quiz.");
  db().quizzes.push(quiz);
  if (type === "final") course.finalQuizId = quiz.id;
  touchCourse(course);
  save();
  res.status(201).json({ quiz: quizOut(quiz, req.user.id, { includeAnswers: true }) });
});

manageRouter.patch("/quizzes/:id", (req, res) => {
  const parsed = quizSchema.partial().safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);
  const { quiz, course } = managedQuiz(req.params.id, req.user);
  const input = parsed.data;

  if (input.type && input.type !== quiz.type) {
    if (input.type === "final" && course.finalQuizId && course.finalQuizId !== quiz.id) {
      throw new ApiError(409, "This course already has a final quiz.");
    }
    if (quiz.type === "final" && course.finalQuizId === quiz.id) course.finalQuizId = null;
    quiz.type = input.type;
    if (input.type === "final") course.finalQuizId = quiz.id;
  }
  if (input.lessonId !== undefined) {
    if (input.lessonId && !course.videoIds.includes(input.lessonId)) throw new ApiError(400, "Choose a lesson from this course.");
    quiz.lessonId = input.lessonId;
  }
  if (quiz.type !== "lesson" && quiz.lessonId) quiz.lessonId = null;

  if (input.published === true && quiz.questions.length === 0) {
    throw new ApiError(400, "Add at least one question before publishing the quiz.");
  }
  if (input.title !== undefined) quiz.title = input.title;
  if (input.titleAm !== undefined) quiz.titleAm = input.titleAm || quiz.title;
  if (input.description !== undefined) quiz.description = input.description;
  if (input.descriptionAm !== undefined) quiz.descriptionAm = input.descriptionAm;
  if (input.passingScore !== undefined) quiz.passingScore = input.passingScore;
  if (input.timeLimitMin !== undefined) quiz.timeLimitMin = input.timeLimitMin;
  if (input.maxAttempts !== undefined) quiz.maxAttempts = input.maxAttempts;
  if (input.available !== undefined) quiz.available = input.available;
  if (input.published !== undefined) quiz.published = input.published;
  if (input.showAnswers !== undefined) quiz.showAnswers = input.showAnswers;
  quiz.updatedAt = new Date().toISOString();
  touchCourse(course);
  save();
  res.json({ quiz: quizOut(quiz, req.user.id, { includeAnswers: true }) });
});

manageRouter.delete("/quizzes/:id", (req, res) => {
  const { quiz, course } = managedQuiz(req.params.id, req.user);
  const attempts = db().quizAttempts.filter((attempt) => attempt.quizId === quiz.id).length;
  if (attempts > 0) {
    throw new ApiError(409, "This quiz has saved attempts. Unpublish it instead of deleting it so students keep their history.");
  }
  db().quizzes = db().quizzes.filter((item) => item.id !== quiz.id);
  if (course.finalQuizId === quiz.id) course.finalQuizId = null;
  touchCourse(course);
  save();
  res.json({ deleted: true });
});

const optionSchema = z.object({
  id: z.string().optional(),
  text: z.string().trim().min(1, "Every option needs text.").max(500),
  textAm: z.string().trim().max(500).optional(),
  correct: z.boolean().optional(),
});

const questionSchema = z.object({
  type: z.enum(QUESTION_TYPES),
  text: z.string().trim().min(3, "Enter the question text.").max(3000),
  textAm: z.string().trim().max(3000).optional(),
  points: z.coerce.number().int().min(1).max(100).optional(),
  order: z.coerce.number().int().min(0).optional(),
  explanation: z.string().trim().max(4000).optional(),
  options: z.array(optionSchema).max(20).optional(),
  acceptedAnswers: z.array(z.string().trim().max(300)).max(20).optional(),
  correctTrue: z.boolean().optional(),
});

function normalizeQuestion(input, existing = null, order = 0) {
  const type = input.type ?? existing?.type ?? "multiple_choice";
  let options = input.options ?? existing?.options ?? [];
  if (type === "true_false" && (options.length === 0 || input.correctTrue !== undefined)) {
    const correctTrue = input.correctTrue
      ?? options.find((option) => option.correct)?.text?.toLowerCase() !== "false";
    options = [
      { text: "True", textAm: "እውነት", correct: correctTrue },
      { text: "False", textAm: "ሐሰት", correct: !correctTrue },
    ];
  }
  options = options.map((option) => ({
    id: option.id || newId("opt"),
    text: String(option.text ?? "").trim(),
    textAm: String(option.textAm ?? "").trim(),
    correct: Boolean(option.correct),
  }));

  if (type !== "short_answer") {
    if (options.length < 2) throw new ApiError(400, "Add at least two answer choices.");
    const correct = options.filter((option) => option.correct).length;
    if (type === "multiple_select" && correct < 1) throw new ApiError(400, "Mark at least one correct answer.");
    if (type !== "multiple_select" && correct !== 1) throw new ApiError(400, "Mark exactly one correct answer.");
    if (type === "true_false" && options.length !== 2) throw new ApiError(400, "True/false questions need exactly two choices.");
  }

  const accepted = normalizeStrings(input.acceptedAnswers ?? existing?.acceptedAnswers ?? []);
  if (type === "short_answer" && accepted.length === 0) {
    throw new ApiError(400, "Add at least one accepted answer for a short-answer question.");
  }

  return newQuestion({
    id: existing?.id,
    type,
    text: input.text ?? existing?.text ?? "",
    textAm: input.textAm ?? existing?.textAm ?? "",
    points: input.points ?? existing?.points ?? 1,
    order: input.order ?? existing?.order ?? order,
    explanation: input.explanation ?? existing?.explanation ?? "",
    options,
    acceptedAnswers: accepted,
  }, order);
}

manageRouter.post("/quizzes/:id/questions", (req, res) => {
  const parsed = questionSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message, parsed.error.flatten().fieldErrors);
  const { quiz } = managedQuiz(req.params.id, req.user);
  const order = quiz.questions.reduce((max, question) => Math.max(max, Number(question.order) || 0), -1) + 1;
  quiz.questions.push(normalizeQuestion(parsed.data, null, order));
  quiz.updatedAt = new Date().toISOString();
  save();
  res.status(201).json({ questions: [...quiz.questions].sort((a, b) => a.order - b.order) });
});

manageRouter.patch("/quizzes/:id/questions/:questionId", (req, res) => {
  const parsed = questionSchema.partial().safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);
  const { quiz } = managedQuiz(req.params.id, req.user);
  const index = quiz.questions.findIndex((question) => question.id === req.params.questionId);
  if (index < 0) throw new ApiError(404, "Question not found.");
  quiz.questions[index] = normalizeQuestion(parsed.data, quiz.questions[index], quiz.questions[index].order);
  quiz.updatedAt = new Date().toISOString();
  save();
  res.json({ questions: [...quiz.questions].sort((a, b) => a.order - b.order) });
});

manageRouter.delete("/quizzes/:id/questions/:questionId", (req, res) => {
  const { quiz } = managedQuiz(req.params.id, req.user);
  const index = quiz.questions.findIndex((question) => question.id === req.params.questionId);
  if (index < 0) throw new ApiError(404, "Question not found.");
  quiz.questions.splice(index, 1);
  quiz.questions = quiz.questions.map((question, order) => ({ ...question, order }));
  quiz.updatedAt = new Date().toISOString();
  save();
  res.json({ questions: [...quiz.questions].sort((a, b) => a.order - b.order) });
});

manageRouter.post("/quizzes/:id/questions/reorder", (req, res) => {
  const { quiz } = managedQuiz(req.params.id, req.user);
  const ids = Array.isArray(req.body?.questionIds) ? req.body.questionIds : [];
  if (ids.length !== quiz.questions.length || new Set(ids).size !== quiz.questions.length) {
    throw new ApiError(400, "Send every question exactly once.");
  }
  const map = new Map(quiz.questions.map((question) => [question.id, question]));
  quiz.questions = ids.map((id, order) => ({ ...map.get(id), order }));
  quiz.updatedAt = new Date().toISOString();
  save();
  res.json({ questions: quiz.questions });
});

/* ------------------------------------------------------------------ */
/* Enrolments and analytics                                            */
/* ------------------------------------------------------------------ */

manageRouter.get("/courses/:id/enrollments", (req, res) => {
  const course = managedCourse(req.params.id, req.user);
  const rows = db().enrollments
    .filter((enrollment) => enrollment.courseId === course.id)
    .map(enrollmentOut)
    .sort((a, b) => String(b.lastActivityAt ?? b.enrolledAt).localeCompare(String(a.lastActivityAt ?? a.enrolledAt)));
  res.json({ enrollments: rows, total: rows.length });
});

manageRouter.get("/courses/:id/analytics", (req, res) => {
  const course = managedCourse(req.params.id, req.user);
  res.json({ analytics: courseAnalytics(course) });
});

manageRouter.get("/overview", (req, res) => {
  const all = db();
  const courses = all.courses.filter((course) => canManageCourse(req.user, course));
  const analytics = courses.map(courseAnalytics);
  const attempts = all.quizAttempts.filter((attempt) =>
    attempt.submittedAt && courses.some((course) => course.id === attempt.courseId));
  res.json({
    stats: {
      courses: courses.length,
      published: courses.filter((course) => course.status === "published").length,
      draft: courses.filter((course) => course.status === "draft").length,
      pending: courses.filter((course) => course.status === "pending").length,
      archived: courses.filter((course) => course.status === "archived").length,
      enrollments: analytics.reduce((sum, item) => sum + item.enrollments, 0),
      activeStudents: analytics.reduce((sum, item) => sum + item.activeStudents, 0),
      completions: analytics.reduce((sum, item) => sum + item.completedCourses, 0),
      certificates: all.certificates.filter((cert) => courses.some((course) => course.id === cert.courseId)).length,
      averageQuizScore: attempts.length
        ? Math.round(attempts.reduce((sum, attempt) => sum + (attempt.percentage ?? 0), 0) / attempts.length)
        : 0,
      quizPassRate: attempts.length
        ? Math.round((attempts.filter((attempt) => attempt.passed).length / attempts.length) * 100)
        : 0,
    },
    courses: courses.map((course, index) => ({
      ...courseSummaryOut(course, req.user),
      enrollments: analytics[index].enrollments,
      averageProgress: analytics[index].averageProgress,
      completionRate: analytics[index].completionRate,
    })),
  });
});

export { managedCourse, managedQuiz };
