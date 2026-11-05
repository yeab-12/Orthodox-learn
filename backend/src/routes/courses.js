import { Router } from "express";
import { db, save, newId } from "../store.js";
import { ApiError, findUser } from "../lib.js";
import { authRequired } from "../auth.js";
import {
  canManageCourse,
  certificateOut,
  certificateFor,
  courseAnalytics,
  courseDetailOut,
  courseProgress,
  courseSummaryOut,
  ensureCourse,
  findCourseEnrollment,
  findLessonProgress,
  finalQuizFor,
  issueCertificate,
  isManager,
  isPublicCourse,
  lessonIsPublic,
  quizMeta,
} from "../courseLib.js";

export const coursesRouter = Router();

function courseById(id) {
  return db().courses.find((course) => course.id === id) ?? null;
}

function enrollmentFor(userId, courseId) {
  return userId ? findCourseEnrollment(userId, courseId) : null;
}

/** Guests only see published public/unlisted courses. Private courses need enrollment. */
function canViewCourse(course, viewer) {
  if (canManageCourse(viewer, course)) return true;
  if (!isPublicCourse(course)) return false;
  const visibility = course.visibility ?? "public";
  if (visibility === "public" || visibility === "unlisted") return true;
  return Boolean(viewer && enrollmentFor(viewer.id, course.id));
}

function requireViewable(course, viewer) {
  if (!course) throw new ApiError(404, "Course not found.");
  if (!canViewCourse(course, viewer)) throw new ApiError(404, "Course not found.");
  return course;
}

/** Learners need an enrolment; managers may preview without one. */
function requireEnrollment(course, viewer) {
  if (canManageCourse(viewer, course)) return enrollmentFor(viewer.id, course.id);
  const enrollment = enrollmentFor(viewer.id, course.id);
  if (!enrollment) throw new ApiError(403, "Enrol in this course before starting a lesson.");
  return enrollment;
}

function syncCompleted(enrollment, videoId, completed) {
  if (!enrollment) return;
  const ids = new Set(enrollment.completedVideoIds ?? []);
  if (completed) ids.add(videoId);
  else ids.delete(videoId);
  enrollment.completedVideoIds = [...ids];
}

function progressPayload(userId, course) {
  const viewer = userId ? findUser(userId) : null;
  return courseProgress(userId, course, { includeHidden: canManageCourse(viewer, course) });
}

function lessonInCourse(course, videoId) {
  const video = db().videos.find((item) => item.id === videoId);
  if (!video || !course.videoIds.includes(videoId)) {
    throw new ApiError(404, "This lesson is not part of the course.");
  }
  return video;
}

function requireVisibleLesson(course, video, viewer) {
  if (canManageCourse(viewer, course)) return video;
  if (!lessonIsPublic(video)) throw new ApiError(404, "Lesson not found.");
  return video;
}

function enrollmentOrCreate(userId, course) {
  let enrollment = findCourseEnrollment(userId, course.id);
  if (!enrollment) {
    enrollment = {
      id: newId("e"),
      userId,
      courseId: course.id,
      completedVideoIds: [],
      enrolledAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    };
    db().enrollments.push(enrollment);
  }
  return enrollment;
}

function lessonRow(userId, course, videoId) {
  let row = findLessonProgress(userId, course.id, videoId);
  if (!row) {
    row = {
      id: newId("lp"),
      userId,
      courseId: course.id,
      videoId,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completed: false,
      watchedSec: 0,
      lastPositionSec: 0,
    };
    db().lessonProgress.push(row);
  }
  return row;
}

coursesRouter.get("/", (req, res) => {
  const viewer = req.user;
  const { q, categoryId, language, difficulty, teacherId, status, enrolled, sort } = req.query;
  const needle = String(q || "").trim().toLowerCase();

  let list = db().courses.filter((course) => {
    if (canManageCourse(viewer, course)) return true;
    if (!isPublicCourse(course)) return false;
    const visibility = course.visibility ?? "public";
    if (visibility === "public") return true;
    return Boolean(viewer && enrollmentFor(viewer.id, course.id));
  });

  if (status && status !== "all") list = list.filter((course) => course.status === status);
  if (categoryId && categoryId !== "all") list = list.filter((course) => course.categoryId === categoryId);
  if (language && language !== "all") list = list.filter((course) => course.language === language);
  if (difficulty && difficulty !== "all") list = list.filter((course) => course.difficulty === difficulty);
  if (teacherId) list = list.filter((course) => course.teacherId === teacherId);
  if (enrolled === "true") list = list.filter((course) => Boolean(enrollmentFor(viewer?.id, course.id)));
  if (needle) {
    list = list.filter((course) =>
      [course.title, course.titleAm, course.description, course.descriptionAm]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }

  const sorted = [...list].sort((a, b) => {
    switch (sort) {
      case "title":
        return String(a.title).localeCompare(String(b.title));
      case "oldest":
        return String(a.createdAt).localeCompare(String(b.createdAt));
      case "ordering":
        return (Number(a.ordering) || 0) - (Number(b.ordering) || 0) ||
          String(a.createdAt).localeCompare(String(b.createdAt));
      case "newest":
      default:
        return String(b.createdAt).localeCompare(String(a.createdAt));
    }
  });

  res.json({ courses: sorted.map((course) => courseSummaryOut(course, viewer)) });
});

coursesRouter.get("/:id", (req, res) => {
  const course = requireViewable(courseById(req.params.id), req.user);
  res.json({ course: courseDetailOut(course, req.user) });
});

coursesRouter.post("/:id/enroll", authRequired, (req, res) => {
  const course = courseById(req.params.id);
  if (!course) throw new ApiError(404, "Course not found.");
  if (!canViewCourse(course, req.user)) throw new ApiError(404, "Course not found.");
  if (!isPublicCourse(course) && !canManageCourse(req.user, course)) {
    throw new ApiError(400, "This course is not open for enrolment.");
  }
  let enrollment = enrollmentFor(req.user.id, course.id);
  if (!enrollment) {
    enrollment = enrollmentOrCreate(req.user.id, course);
    save();
  }
  res.status(201).json({ course: courseDetailOut(course, req.user), enrollmentId: enrollment.id });
});

coursesRouter.get("/:id/progress", authRequired, (req, res) => {
  const course = requireViewable(courseById(req.params.id), req.user);
  const enrollment = requireEnrollment(course, req.user);
  const progress = progressPayload(req.user.id, course);
  res.json({
    enrollment: enrollment ? {
      id: enrollment.id,
      enrolledAt: enrollment.enrolledAt,
      lastActivityAt: enrollment.lastActivityAt ?? null,
    } : null,
    progress: {
      done: progress.done,
      lessonCount: progress.lessonCount,
      lessonPct: progress.lessonPct,
      pct: progress.pct,
      completed: progress.completed,
      completedVideoIds: progress.completedVideoIds,
      quizPassed: progress.quizPassed,
      lastLessonId: progress.lastLessonId,
      lastPositionSec: progress.lastPositionSec,
      lastActivityAt: progress.lastActivityAt,
    },
  });
});

coursesRouter.post("/:id/lessons/:videoId/start", authRequired, (req, res) => {
  const course = requireViewable(courseById(req.params.id), req.user);
  const video = requireVisibleLesson(course, lessonInCourse(course, req.params.videoId), req.user);
  const enrollment = requireEnrollment(course, req.user) ?? { userId: req.user.id, courseId: course.id, completedVideoIds: [] };
  const row = lessonRow(req.user.id, course, video.id);
  if (!row.startedAt) row.startedAt = new Date().toISOString();
  row.updatedAt = new Date().toISOString();
  enrollment.lastLessonId = video.id;
  enrollment.lastActivityAt = row.updatedAt;
  save();
  res.json({
    lesson: { id: video.id, lastPositionSec: row.lastPositionSec, watchedSec: row.watchedSec, completed: row.completed },
  });
});

coursesRouter.post("/:id/lessons/:videoId/progress", authRequired, (req, res) => {
  const course = requireViewable(courseById(req.params.id), req.user);
  const video = requireVisibleLesson(course, lessonInCourse(course, req.params.videoId), req.user);
  const enrollment = requireEnrollment(course, req.user) ?? { userId: req.user.id, courseId: course.id, completedVideoIds: [] };
  const positionSec = Math.max(0, Number(req.body?.positionSec) || 0);
  const durationSec = Math.max(0, Number(req.body?.durationSec) || Number(video.durationSec) || 0);
  const row = lessonRow(req.user.id, course, video.id);
  const now = new Date().toISOString();
  row.watchedSec = Math.max(Number(row.watchedSec) || 0, Math.round(positionSec));
  row.lastPositionSec = Math.round(positionSec);
  row.updatedAt = now;
  row.lastWatchedAt = now;

  const shouldComplete =
    req.body?.completed === true ||
    (req.body?.completed !== false && durationSec > 0 && positionSec / durationSec >= 0.9);
  if (shouldComplete) row.completed = true;
  if (req.body?.completed === false) row.completed = false;
  syncCompleted(enrollment, video.id, row.completed);
  enrollment.lastLessonId = video.id;
  enrollment.lastActivityAt = now;

  let certificate = null;
  if (row.completed) {
    const progress = courseProgress(req.user.id, course);
    certificate = issueCertificate(req.user.id, course, progress);
  }
  save();
  const progress = progressPayload(req.user.id, course);
  res.json({
    lesson: {
      id: video.id,
      completed: row.completed,
      lastPositionSec: row.lastPositionSec,
      watchedSec: row.watchedSec,
    },
    progress: {
      done: progress.done,
      lessonCount: progress.lessonCount,
      lessonPct: progress.lessonPct,
      pct: progress.pct,
      completed: progress.completed,
      quizPassed: progress.quizPassed,
      lastLessonId: progress.lastLessonId,
      lastPositionSec: progress.lastPositionSec,
    },
    certificate: certificateOut(certificate),
  });
});

coursesRouter.post("/:id/lessons/:videoId/complete", authRequired, (req, res) => {
  const course = requireViewable(courseById(req.params.id), req.user);
  const video = requireVisibleLesson(course, lessonInCourse(course, req.params.videoId), req.user);
  const enrollment = requireEnrollment(course, req.user) ?? { userId: req.user.id, courseId: course.id, completedVideoIds: [] };
  const row = lessonRow(req.user.id, course, video.id);
  const requested = typeof req.body?.completed === "boolean" ? req.body.completed : !row.completed;
  row.completed = requested;
  const now = new Date().toISOString();
  row.updatedAt = now;
  if (requested && video.durationSec) row.lastPositionSec = Math.max(row.lastPositionSec ?? 0, video.durationSec);
  syncCompleted(enrollment, video.id, requested);
  enrollment.lastLessonId = video.id;
  enrollment.lastActivityAt = now;

  let certificate = null;
  if (requested) {
    const progress = courseProgress(req.user.id, course);
    certificate = issueCertificate(req.user.id, course, progress);
  }
  save();
  const progress = progressPayload(req.user.id, course);
  res.json({
    completed: requested,
    course: courseDetailOut(course, req.user),
    progress: {
      done: progress.done,
      lessonCount: progress.lessonCount,
      lessonPct: progress.lessonPct,
      pct: progress.pct,
      completed: progress.completed,
    },
    certificate: certificateOut(certificate),
  });
});

coursesRouter.get("/:id/certificate", authRequired, (req, res) => {
  const course = requireViewable(courseById(req.params.id), req.user);
  res.json({ certificate: certificateOut(certificateFor(req.user.id, course.id)) });
});

coursesRouter.post("/:id/certificate", authRequired, (req, res) => {
  const course = requireViewable(courseById(req.params.id), req.user);
  requireEnrollment(course, req.user);
  const progress = courseProgress(req.user.id, course);
  if (!progress.completed) throw new ApiError(400, "Complete every required lesson and pass the final quiz first.");
  const certificate = issueCertificate(req.user.id, course, progress);
  save();
  res.status(201).json({ certificate: certificateOut(certificate) });
});

coursesRouter.get("/:id/quizzes", (req, res) => {
  const course = requireViewable(courseById(req.params.id), req.user);
  const manager = canManageCourse(req.user, course);
  if (!manager) requireEnrollment(course, req.user);
  const list = db().quizzes.filter((quiz) => quiz.courseId === course.id && (manager || (quiz.published && quiz.available)));
  res.json({ quizzes: list.map((quiz) => quizMeta(quiz, req.user?.id)) });
});

coursesRouter.get("/:id/analytics", authRequired, (req, res) => {
  const course = courseById(req.params.id);
  if (!course) throw new ApiError(404, "Course not found.");
  if (!canManageCourse(req.user, course)) throw new ApiError(403, "You do not have permission to view these analytics.");
  res.json({ analytics: courseAnalytics(course) });
});

// Keep the final-quiz summary easy to consume on the client.
coursesRouter.get("/:id/final-quiz", (req, res) => {
  const course = requireViewable(courseById(req.params.id), req.user);
  const quiz = finalQuizFor(course);
  res.json({ quiz: quiz ? quizMeta(quiz, req.user?.id) : null });
});

export { canViewCourse, requireViewable, enrollmentFor, courseById };
