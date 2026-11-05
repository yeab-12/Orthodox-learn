import { Router } from "express";
import { db } from "../store.js";
import { ApiError, findUser } from "../lib.js";
import { authRequired } from "../auth.js";
import {
  certificateFor,
  certificateOut,
  courseProgress,
  courseSummaryOut,
  issueCertificate,
} from "../courseLib.js";

export const learningRouter = Router();

/** Public certificate verification: confirms the ID without exposing account data. */
learningRouter.get("/verify/:id", (req, res) => {
  const cert = db().certificates.find((item) => item.id === req.params.id);
  if (!cert) {
    return res.status(404).json({ valid: false, error: "Certificate not found." });
  }
  res.json({
    valid: true,
    certificate: {
      id: cert.id,
      studentName: cert.studentName,
      courseTitle: cert.courseTitle,
      courseTitleAm: cert.courseTitleAm,
      teacherName: cert.teacherName,
      issuedAt: cert.issuedAt,
      platform: "Tewahedo Learn",
    },
  });
});

learningRouter.use(authRequired);

function dayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function currentStreak(dates) {
  const days = new Set(dates.map(dayKey).filter(Boolean));
  if (days.size === 0) return 0;
  const cursor = new Date();
  let streak = 0;
  // A streak stays alive if the learner studied today or yesterday.
  if (!days.has(cursor.toISOString().slice(0, 10))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (!days.has(cursor.toISOString().slice(0, 10))) return 0;
  }
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function buildDashboard(user) {
  const all = db();
  const enrollments = all.enrollments.filter((enrollment) => enrollment.userId === user.id);
  const courses = [];
  let lessonsCompleted = 0;

  for (const enrollment of enrollments) {
    const course = all.courses.find((item) => item.id === enrollment.courseId);
    if (!course) continue;
    // Issue certificates lazily for learners who completed a course before this feature existed.
    const progress = courseProgress(user.id, course);
    if (progress.completed) issueCertificate(user.id, course, progress);
    const summary = courseSummaryOut(course, user);
    lessonsCompleted += summary.done;
    courses.push({
      ...summary,
      resumeLessonId: summary.lastLessonId,
      resumePositionSec: summary.lastPositionSec,
      lastActivityAt: enrollment.lastActivityAt ?? summary.lastActivityAt,
    });
  }

  const attempts = all.quizAttempts.filter((attempt) => attempt.userId === user.id && attempt.submittedAt);
  const quizAverage = attempts.length
    ? Math.round(attempts.reduce((sum, attempt) => sum + (attempt.percentage ?? 0), 0) / attempts.length)
    : 0;

  const recent = [];
  for (const row of all.lessonProgress.filter((item) => item.userId === user.id)) {
    const course = all.courses.find((item) => item.id === row.courseId);
    const video = all.videos.find((item) => item.id === row.videoId);
    recent.push({
      type: row.completed ? "lesson_completed" : "lesson_progress",
      at: row.updatedAt ?? row.lastWatchedAt ?? row.startedAt,
      courseId: row.courseId,
      courseTitle: course?.title ?? "",
      courseTitleAm: course?.titleAm ?? course?.title ?? "",
      lessonId: row.videoId,
      lessonTitle: video?.title ?? "",
      lessonTitleAm: video?.titleAm ?? video?.title ?? "",
      detail: row.completed ? "completed" : "in_progress",
    });
  }
  for (const attempt of attempts) {
    const quiz = all.quizzes.find((item) => item.id === attempt.quizId);
    const course = all.courses.find((item) => item.id === attempt.courseId);
    recent.push({
      type: "quiz_submitted",
      at: attempt.submittedAt,
      courseId: attempt.courseId,
      courseTitle: course?.title ?? "",
      courseTitleAm: course?.titleAm ?? course?.title ?? "",
      quizId: attempt.quizId,
      quizTitle: quiz?.title ?? "",
      quizTitleAm: quiz?.titleAm ?? quiz?.title ?? "",
      detail: attempt.passed ? "passed" : "failed",
      percentage: attempt.percentage,
      passed: attempt.passed,
    });
  }
  recent.sort((a, b) => String(b.at).localeCompare(String(a.at)));

  const certificates = all.certificates
    .filter((cert) => cert.userId === user.id)
    .map(certificateOut)
    .sort((a, b) => String(b.issuedAt).localeCompare(String(a.issuedAt)));

  const inProgress = courses.filter((course) => course.enrolled && !course.completed && course.done > 0);
  const notStarted = courses.filter((course) => course.enrolled && !course.completed && course.done === 0);
  const completedCourses = courses.filter((course) => course.completed);

  const activityDates = recent.map((item) => item.at);

  return {
    stats: {
      enrolledCourses: courses.length,
      inProgress: inProgress.length,
      completedCourses: completedCourses.length,
      notStarted: notStarted.length,
      lessonsCompleted,
      quizAverage,
      quizAttempts: attempts.length,
      quizPassed: attempts.filter((attempt) => attempt.passed).length,
      certificates: certificates.length,
      streak: currentStreak(activityDates),
    },
    continueLearning: [...courses]
      .filter((course) => !course.completed)
      .sort((a, b) => String(b.lastActivityAt ?? b.enrolledAt).localeCompare(String(a.lastActivityAt ?? a.enrolledAt)))
      .slice(0, 4),
    recentActivity: recent.slice(0, 12),
    certificates,
    courses,
  };
}

learningRouter.get("/dashboard", (req, res) => {
  const filter = String(req.query.filter || "all");
  const data = buildDashboard(req.user);
  const filtered = data.courses.filter((course) => {
    if (filter === "completed") return course.completed;
    if (filter === "in_progress") return !course.completed && course.done > 0;
    if (filter === "not_started") return !course.completed && course.done === 0;
    return true;
  });
  res.json({ ...data, courses: filtered, filter });
});

learningRouter.get("/certificates", (req, res) => {
  const certificates = db().certificates
    .filter((cert) => cert.userId === req.user.id)
    .map(certificateOut)
    .sort((a, b) => String(b.issuedAt).localeCompare(String(a.issuedAt)));
  res.json({ certificates });
});

/** Learners can only read their own certificates; administrators may audit any. */
learningRouter.get("/certificates/:id", (req, res) => {
  const cert = db().certificates.find((item) => item.id === req.params.id);
  if (!cert) throw new ApiError(404, "Certificate not found.");
  if (cert.userId !== req.user.id && req.user.role !== "admin") {
    throw new ApiError(403, "You can only view your own certificates.");
  }
  res.json({ certificate: certificateOut(cert) });
});

learningRouter.get("/courses/:id", (req, res) => {
  const course = db().courses.find((item) => item.id === req.params.id);
  if (!course) throw new ApiError(404, "Course not found.");
  const enrollment = db().enrollments.find(
    (item) => item.courseId === course.id && item.userId === req.user.id,
  );
  if (!enrollment) throw new ApiError(403, "You are not enrolled in this course.");
  const progress = courseProgress(req.user.id, course);
  const certificate = certificateFor(req.user.id, course.id);
  res.json({
    progress: {
      done: progress.done,
      lessonCount: progress.lessonCount,
      lessonPct: progress.lessonPct,
      pct: progress.pct,
      completed: progress.completed,
      quizPassed: progress.quizPassed,
      lastLessonId: progress.lastLessonId,
      lastPositionSec: progress.lastPositionSec,
      lastActivityAt: progress.lastActivityAt,
    },
    certificate: certificateOut(certificate),
  });
});

learningRouter.get("/students/:id", (req, res) => {
  if (req.user.role !== "admin") throw new ApiError(403, "You can only view your own progress.");
  const user = findUser(req.params.id);
  if (!user) throw new ApiError(404, "Student not found.");
  res.json(buildDashboard(user));
});
