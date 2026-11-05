import crypto from "node:crypto";
import { db, newId } from "./store.js";
import { findUser, isPublicVideo, videoOut } from "./lib.js";

export const COURSE_STATUSES = ["draft", "pending", "published", "archived"];
export const COURSE_VISIBILITIES = ["public", "unlisted", "private"];
export const DIFFICULTIES = ["beginner", "intermediate", "advanced"];
export const QUESTION_TYPES = ["multiple_choice", "true_false", "multiple_select", "short_answer"];
export const QUIZ_TYPES = ["lesson", "final", "practice"];

/** Fill in fields added after the first version of the app. */
export function ensureCourse(course) {
  if (!course) return course;
  if (!COURSE_STATUSES.includes(course.status)) course.status = "published";
  if (!COURSE_VISIBILITIES.includes(course.visibility)) course.visibility = "public";
  if (!DIFFICULTIES.includes(course.difficulty)) course.difficulty = "beginner";
  if (!course.categoryId) {
    const firstVideo = (course.videoIds ?? [])
      .map((id) => db().videos.find((v) => v.id === id))
      .find(Boolean);
    course.categoryId = firstVideo?.categoryId ?? "theology";
  }
  if (!Array.isArray(course.objectives)) course.objectives = [];
  if (!Array.isArray(course.prerequisites)) course.prerequisites = [];
  if (!Number.isFinite(Number(course.estimatedDuration))) course.estimatedDuration = 0;
  if (!Number.isFinite(Number(course.ordering))) course.ordering = 0;
  if (typeof course.certificateEnabled !== "boolean") course.certificateEnabled = true;
  if (course.finalQuizId === undefined) course.finalQuizId = null;
  if (!Array.isArray(course.videoIds)) course.videoIds = [];
  if (!course.updatedAt) course.updatedAt = course.createdAt;
  return course;
}

/** Called once when the API starts. Adds new collections without writing the file. */
export function normalizeState(data) {
  for (const key of ["quizzes", "quizAttempts", "lessonProgress", "certificates"]) {
    if (!Array.isArray(data[key])) data[key] = [];
  }
  for (const course of data.courses ?? []) ensureCourse(course);
  for (const video of data.videos ?? []) {
    if (!video.lessonStatus) video.lessonStatus = "published";
    if (!Array.isArray(video.objectives)) video.objectives = [];
    if (!Array.isArray(video.resources)) video.resources = [];
  }
  for (const enrollment of data.enrollments ?? []) {
    if (!Array.isArray(enrollment.completedVideoIds)) enrollment.completedVideoIds = [];
  }
  for (const quiz of data.quizzes ?? []) {
    if (!Array.isArray(quiz.questions)) quiz.questions = [];
    if (!QUESTION_TYPES.includes(quiz.type) && !QUIZ_TYPES.includes(quiz.type)) quiz.type = "practice";
    if (!Number.isFinite(Number(quiz.passingScore))) quiz.passingScore = 70;
    if (!Number.isFinite(Number(quiz.timeLimitMin))) quiz.timeLimitMin = 0;
    if (!Number.isFinite(Number(quiz.maxAttempts))) quiz.maxAttempts = 0;
    if (typeof quiz.published !== "boolean") quiz.published = true;
    if (typeof quiz.available !== "boolean") quiz.available = true;
    if (typeof quiz.showAnswers !== "boolean") quiz.showAnswers = true;
    for (const question of quiz.questions) {
      if (!Array.isArray(question.options)) question.options = [];
      if (!Array.isArray(question.acceptedAnswers)) question.acceptedAnswers = [];
    }
  }
  return data;
}

export function isManager(user) {
  return Boolean(user) && (user.role === "admin" || user.role === "teacher");
}

export function canManageCourse(user, course) {
  if (!user || !course) return false;
  if (user.role === "admin") return true;
  return user.role === "teacher" && course.teacherId === user.id;
}

export function isPublicCourse(course) {
  return Boolean(course) && (course.status ?? "published") === "published";
}

export function lessonIsPublic(video) {
  return isPublicVideo(video) && (video.lessonStatus ?? "published") === "published";
}

export function courseLessons(course, { includeHidden = false } = {}) {
  const all = db();
  return course.videoIds
    .map((id) => all.videos.find((v) => v.id === id))
    .filter(Boolean)
    .filter((video) => includeHidden || lessonIsPublic(video));
}

export function findCourseEnrollment(userId, courseId) {
  return db().enrollments.find((e) => e.userId === userId && e.courseId === courseId) ?? null;
}

export function findQuiz(id) {
  return db().quizzes.find((quiz) => quiz.id === id) ?? null;
}

export function quizForCourse(course, type = null) {
  const list = db().quizzes.filter((quiz) => quiz.courseId === course.id && quiz.published && quiz.available);
  if (!type) return list;
  return list.filter((quiz) => quiz.type === type);
}

export function finalQuizFor(course) {
  if (!course?.finalQuizId) return null;
  const quiz = findQuiz(course.finalQuizId);
  return quiz && quiz.published && quiz.available ? quiz : null;
}

export function findLessonProgress(userId, courseId, videoId) {
  return db().lessonProgress.find(
    (row) => row.userId === userId && row.courseId === courseId && row.videoId === videoId,
  ) ?? null;
}

function attemptRows(userId, quizId) {
  return db().quizAttempts
    .filter((attempt) => attempt.userId === userId && attempt.quizId === quizId)
    .sort((a, b) => (a.attemptNumber ?? 0) - (b.attemptNumber ?? 0));
}

export function quizAttemptSummary(userId, quiz) {
  if (!userId) {
    return { attempts: [], attemptsUsed: 0, bestPercentage: 0, passed: false, lastAttempt: null };
  }
  const rows = attemptRows(userId, quiz.id).filter((attempt) => attempt.submittedAt);
  const best = rows.reduce((value, attempt) => Math.max(value, attempt.percentage ?? 0), 0);
  return {
    attempts: rows,
    attemptsUsed: rows.length,
    bestPercentage: best,
    passed: rows.some((attempt) => attempt.passed),
    lastAttempt: rows.length ? rows[rows.length - 1] : null,
  };
}

/**
 * Course progress. Lesson completion is counted from LessonProgress and the
 * older enrollment.completedVideoIds field, so old data keeps working.
 */
export function courseProgress(userId, course, { includeHidden = false } = {}) {
  const all = db();
  const lessons = courseLessons(course, { includeHidden });
  const enrollment = userId ? findCourseEnrollment(userId, course.id) : null;
  const rows = userId
    ? all.lessonProgress.filter((row) => row.userId === userId && row.courseId === course.id)
    : [];
  const completedIds = new Set(rows.filter((row) => row.completed).map((row) => row.videoId));
  for (const id of enrollment?.completedVideoIds ?? []) completedIds.add(id);

  const done = lessons.filter((video) => completedIds.has(video.id)).length;
  const quiz = finalQuizFor(course);
  const quizRows = userId && quiz ? attemptRows(userId, quiz.id).filter((a) => a.submittedAt) : [];
  const quizPassed = quiz ? quizRows.some((attempt) => attempt.passed) : false;
  const totalUnits = lessons.length + (quiz ? 1 : 0);
  const doneUnits = done + (quiz && quizPassed ? 1 : 0);
  const lessonPct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
  const pct = totalUnits ? Math.round((doneUnits / totalUnits) * 100) : 0;
  const completed = lessons.length > 0 && done === lessons.length && (!quiz || quizPassed);

  const sortedRows = [...rows].sort((a, b) =>
    String(b.updatedAt ?? b.lastWatchedAt ?? "").localeCompare(String(a.updatedAt ?? a.lastWatchedAt ?? "")),
  );
  const lastRow = sortedRows[0] ?? null;
  const nextLesson =
    lessons.find((video) => !completedIds.has(video.id)) ??
    (lessons.length ? lessons[lessons.length - 1] : null);
  const lastLessonId = enrollment?.lastLessonId && lessons.some((v) => v.id === enrollment.lastLessonId)
    ? enrollment.lastLessonId
    : lastRow?.videoId ?? nextLesson?.id ?? null;
  const positionRow = lastLessonId
    ? rows.find((row) => row.videoId === lastLessonId) ?? lastRow
    : lastRow;
  const lastPositionSec = positionRow
    ? Math.max(0, Number(positionRow.lastPositionSec) || 0)
    : 0;

  return {
    lessons,
    enrollment,
    done,
    lessonCount: lessons.length,
    lessonPct,
    pct,
    completed,
    quiz,
    quizPassed,
    quizAttempts: quizRows,
    bestQuizPercentage: quizRows.reduce((value, attempt) => Math.max(value, attempt.percentage ?? 0), 0),
    totalUnits,
    doneUnits,
    completedVideoIds: [...completedIds],
    lastRow,
    lastLessonId,
    lastPositionSec,
    lastActivityAt: enrollment?.lastActivityAt ?? lastRow?.updatedAt ?? null,
  };
}

export function certificateFor(userId, courseId) {
  return db().certificates.find((cert) => cert.userId === userId && cert.courseId === courseId) ?? null;
}

export function certificateOut(cert) {
  if (!cert) return null;
  const course = db().courses.find((c) => c.id === cert.courseId);
  const student = findUser(cert.userId);
  const teacher = findUser(cert.teacherId);
  return {
    id: cert.id,
    userId: cert.userId,
    courseId: cert.courseId,
    studentName: cert.studentName,
    courseTitle: cert.courseTitle,
    courseTitleAm: cert.courseTitleAm ?? cert.courseTitle,
    teacherName: cert.teacherName,
    teacherNameAm: teacher?.name ?? cert.teacherName,
    issuedAt: cert.issuedAt,
    platform: "Tewahedo Learn",
    score: cert.score ?? null,
    course: course ? {
      id: course.id,
      title: course.title,
      titleAm: course.titleAm || course.title,
      cover: course.cover ?? 0,
    } : null,
    student: student ? { id: student.id, name: student.name } : null,
  };
}

/** Create a certificate only when the database says the course is complete. */
export function issueCertificate(userId, course, progress = null) {
  const user = findUser(userId);
  if (!user || !course || course.certificateEnabled === false) return null;
  const current = certificateFor(userId, course.id);
  if (current) return current;
  const state = progress ?? courseProgress(userId, course);
  if (!state.completed) return null;
  const teacher = findUser(course.teacherId);
  const cert = {
    id: `cert_${crypto.randomBytes(6).toString("hex")}`,
    userId,
    courseId: course.id,
    studentName: user.name,
    courseTitle: course.title,
    courseTitleAm: course.titleAm || course.title,
    teacherId: course.teacherId,
    teacherName: teacher?.name ?? "Tewahedo Learn",
    issuedAt: new Date().toISOString(),
    score: state.bestQuizPercentage || null,
  };
  db().certificates.unshift(cert);
  return cert;
}

export function quizMeta(quiz, userId) {
  const summary = quizAttemptSummary(userId, quiz);
  const totalPoints = quiz.questions.reduce((sum, question) => sum + (Number(question.points) || 0), 0);
  return {
    id: quiz.id,
    courseId: quiz.courseId,
    lessonId: quiz.lessonId ?? null,
    type: quiz.type ?? "practice",
    title: quiz.title,
    titleAm: quiz.titleAm || quiz.title,
    description: quiz.description ?? "",
    descriptionAm: quiz.descriptionAm ?? "",
    passingScore: Number(quiz.passingScore) || 70,
    timeLimitMin: Number(quiz.timeLimitMin) || 0,
    maxAttempts: Number(quiz.maxAttempts) || 0,
    available: quiz.available !== false,
    published: quiz.published !== false,
    showAnswers: quiz.showAnswers !== false,
    questionCount: quiz.questions.length,
    totalPoints,
    attemptsUsed: summary.attemptsUsed,
    bestPercentage: summary.bestPercentage,
    passed: summary.passed,
    lastAttempt: summary.lastAttempt ? {
      id: summary.lastAttempt.id,
      percentage: summary.lastAttempt.percentage,
      passed: summary.lastAttempt.passed,
      submittedAt: summary.lastAttempt.submittedAt,
    } : null,
    createdAt: quiz.createdAt,
    updatedAt: quiz.updatedAt,
  };
}

function publicQuestion(question, { includeAnswers = false } = {}) {
  return {
    id: question.id,
    type: question.type,
    text: question.text,
    textAm: question.textAm ?? "",
    points: Number(question.points) || 1,
    order: Number(question.order) || 0,
    options: (question.options ?? []).map((option) => ({
      id: option.id,
      text: option.text,
      textAm: option.textAm ?? "",
      ...(includeAnswers ? { correct: Boolean(option.correct) } : {}),
    })),
    ...(includeAnswers ? {
      explanation: question.explanation ?? "",
      acceptedAnswers: question.acceptedAnswers ?? [],
    } : {}),
  };
}

export function quizOut(quiz, userId, { includeAnswers = false } = {}) {
  if (!quiz) return null;
  const viewer = userId ? findUser(userId) : null;
  const course = db().courses.find((c) => c.id === quiz.courseId);
  const manager = canManageCourse(viewer, course);
  const answers = includeAnswers || manager;
  return {
    ...quizMeta(quiz, userId),
    canAttempt:
      quiz.published !== false &&
      quiz.available !== false &&
      (Number(quiz.maxAttempts) <= 0 || quizAttemptSummary(userId, quiz).attemptsUsed < Number(quiz.maxAttempts)),
    questions: [...quiz.questions]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((question) => publicQuestion(question, { includeAnswers: answers })),
  };
}

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function questionCorrect(question, answer) {
  const options = question.options ?? [];
  const correctIds = options.filter((option) => option.correct).map((option) => option.id);
  const selectedIds = [...new Set(answer?.optionIds ?? [])].filter((id) => options.some((o) => o.id === id));
  const points = Number(question.points) || 0;

  if (question.type === "short_answer") {
    const accepted = (question.acceptedAnswers ?? []).map(normalizeText).filter(Boolean);
    const typed = normalizeText(answer?.text);
    const correct = Boolean(typed) && accepted.some((value) => value === typed);
    return { correct, pointsAwarded: correct ? points : 0, correctOptionIds: [], correctText: accepted[0] ?? "" };
  }
  if (question.type === "multiple_select") {
    const correct = correctIds.length > 0 &&
      correctIds.length === selectedIds.length &&
      correctIds.every((id) => selectedIds.includes(id));
    return { correct, pointsAwarded: correct ? points : 0, correctOptionIds: correctIds, correctText: "" };
  }
  const correct = correctIds.length === 1 && selectedIds.length === 1 && selectedIds[0] === correctIds[0];
  return { correct, pointsAwarded: correct ? points : 0, correctOptionIds: correctIds, correctText: "" };
}

/**
 * Server-side grading. The browser never sends a score.
 */
export function gradeQuiz(quiz, answers = []) {
  const ordered = [...quiz.questions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const byQuestion = new Map(answers.map((answer) => [answer.questionId, answer]));
  let score = 0;
  let totalPoints = 0;
  const graded = ordered.map((question) => {
    const points = Number(question.points) || 0;
    totalPoints += points;
    const answer = byQuestion.get(question.id);
    const result = questionCorrect(question, answer);
    score += result.pointsAwarded;
    return {
      questionId: question.id,
      type: question.type,
      text: question.text,
      textAm: question.textAm ?? "",
      points,
      pointsAwarded: result.pointsAwarded,
      correct: result.correct,
      optionIds: [...new Set(answer?.optionIds ?? [])],
      answerText: String(answer?.text ?? ""),
      correctOptionIds: result.correctOptionIds,
      correctText: result.correctText,
      explanation: question.explanation ?? "",
    };
  });
  const percentage = totalPoints ? Math.round((score / totalPoints) * 100) : 0;
  const passingScore = Number(quiz.passingScore) || 70;
  return {
    score,
    totalPoints,
    percentage,
    passed: percentage >= passingScore,
    passingScore,
    answers: graded,
  };
}

export function attemptOut(attempt, { includeAnswers = false } = {}) {
  if (!attempt) return null;
  const quiz = findQuiz(attempt.quizId);
  const user = findUser(attempt.userId);
  const result = includeAnswers && attempt.graded ? {
    answers: attempt.answers.map((answer) => ({
      questionId: answer.questionId,
      type: answer.type,
      text: answer.text ?? "",
      textAm: answer.textAm ?? "",
      points: answer.points,
      pointsAwarded: answer.pointsAwarded,
      correct: answer.correct,
      optionIds: answer.optionIds ?? [],
      answerText: answer.answerText ?? "",
      correctOptionIds: answer.correctOptionIds ?? [],
      correctText: answer.correctText ?? "",
      explanation: answer.explanation ?? "",
    })),
  } : {};
  return {
    id: attempt.id,
    quizId: attempt.quizId,
    quizTitle: quiz?.title ?? "",
    courseId: attempt.courseId,
    userId: attempt.userId,
    studentName: user?.name ?? "Student",
    attemptNumber: attempt.attemptNumber,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt ?? null,
    durationSec: attempt.durationSec ?? null,
    score: attempt.score ?? null,
    totalPoints: attempt.totalPoints ?? null,
    percentage: attempt.percentage ?? null,
    passed: attempt.passed ?? null,
    gradingComplete: Boolean(attempt.submittedAt),
    ...result,
  };
}

export function courseSummaryOut(course, viewer) {
  ensureCourse(course);
  const viewerUser = viewer?.id ? findUser(viewer.id) : null;
  const manager = canManageCourse(viewerUser, course);
  const progress = courseProgress(viewer?.id, course, { includeHidden: manager });
  const teacher = findUser(course.teacherId);
  const category = db().categories.find((c) => c.id === course.categoryId) ?? null;
  const quiz = finalQuizFor(course);
  const cert = viewer?.id ? certificateFor(viewer.id, course.id) : null;
  return {
    id: course.id,
    title: course.title,
    titleAm: course.titleAm || course.title,
    description: course.description ?? "",
    descriptionAm: course.descriptionAm ?? "",
    teacherId: course.teacherId,
    teacher: teacher ? { id: teacher.id, name: teacher.name, bio: teacher.bio ?? "" } : null,
    categoryId: course.categoryId ?? "",
    category,
    cover: course.cover ?? 0,
    language: course.language ?? "en",
    difficulty: course.difficulty ?? "beginner",
    estimatedDuration: Number(course.estimatedDuration) || 0,
    objectives: course.objectives ?? [],
    prerequisites: course.prerequisites ?? [],
    status: course.status ?? "published",
    visibility: course.visibility ?? "public",
    ordering: Number(course.ordering) || 0,
    certificateEnabled: course.certificateEnabled !== false,
    lessonCount: progress.lessonCount,
    totalLessonCount: course.videoIds.length,
    totalDurationSec: progress.lessons.reduce((sum, video) => sum + (Number(video.durationSec) || 0), 0),
    done: progress.done,
    progressPct: progress.pct,
    lessonPct: progress.lessonPct,
    completed: progress.completed,
    enrolled: Boolean(progress.enrollment),
    enrolledAt: progress.enrollment?.enrolledAt ?? null,
    lastActivityAt: progress.lastActivityAt,
    lastLessonId: progress.lastLessonId,
    lastPositionSec: progress.lastPositionSec,
    finalQuiz: quiz ? quizMeta(quiz, viewer?.id) : null,
    quizzes: quizForCourse(course).map((item) => quizMeta(item, viewer?.id)),
    certificate: certificateOut(cert),
    createdAt: course.createdAt,
    updatedAt: course.updatedAt ?? course.createdAt,
  };
}

export function courseDetailOut(course, viewer) {
  ensureCourse(course);
  const viewerUser = viewer?.id ? findUser(viewer.id) : null;
  const manager = canManageCourse(viewerUser, course);
  const progress = courseProgress(viewer?.id, course, { includeHidden: manager });
  const out = courseSummaryOut(course, viewer);
  out.lessons = progress.lessons.map((video, index) => {
    const row = viewer?.id ? findLessonProgress(viewer.id, course.id, video.id) : null;
    return {
      ...videoOut(video, viewer?.id, { includeStatus: manager }),
      order: index + 1,
      completed: Boolean(row?.completed) || (progress.enrollment?.completedVideoIds ?? []).includes(video.id),
      lastPositionSec: Math.max(0, Number(row?.lastPositionSec) || 0),
      watchedSec: Math.max(0, Number(row?.watchedSec) || 0),
      lessonStatus: video.lessonStatus ?? "published",
      objectives: video.objectives ?? [],
      resources: video.resources ?? [],
      quiz: quizForCourse(course, "lesson").find((quiz) => quiz.lessonId === video.id)
        ? quizMeta(quizForCourse(course, "lesson").find((quiz) => quiz.lessonId === video.id), viewer?.id)
        : null,
    };
  });
  return out;
}

export function courseAnalytics(course) {
  const all = db();
  const lessons = courseLessons(course, { includeHidden: true });
  const enrollments = all.enrollments.filter((e) => e.courseId === course.id);
  const now = Date.now();
  const month = 30 * 86_400_000;

  let progressTotal = 0;
  let completedCourses = 0;
  let activeStudents = 0;
  const lessonStats = new Map(lessons.map((lesson) => [lesson.id, {
    lessonId: lesson.id,
    title: lesson.title,
    started: 0,
    completed: 0,
    views: lesson.views ?? 0,
  }]));

  for (const enrollment of enrollments) {
    const state = courseProgress(enrollment.userId, course);
    progressTotal += state.pct;
    if (state.completed) completedCourses += 1;
    const last = enrollment.lastActivityAt
      ? new Date(enrollment.lastActivityAt).getTime()
      : new Date(enrollment.enrolledAt).getTime();
    if (now - last <= month) activeStudents += 1;
    for (const row of all.lessonProgress.filter((r) => r.userId === enrollment.userId && r.courseId === course.id)) {
      const stat = lessonStats.get(row.videoId);
      if (!stat) continue;
      stat.started += 1;
      if (row.completed) stat.completed += 1;
    }
  }

  const quizzes = all.quizzes.filter((quiz) => quiz.courseId === course.id);
  const attempts = all.quizAttempts.filter((attempt) => attempt.courseId === course.id && attempt.submittedAt);
  const averageQuizScore = attempts.length
    ? Math.round(attempts.reduce((sum, attempt) => sum + (attempt.percentage ?? 0), 0) / attempts.length)
    : 0;
  const quizPassRate = attempts.length
    ? Math.round((attempts.filter((attempt) => attempt.passed).length / attempts.length) * 100)
    : 0;

  const lessonRows = [...lessonStats.values()]
    .map((stat) => ({
      ...stat,
      completionRate: stat.started ? Math.round((stat.completed / stat.started) * 100) : 0,
      dropoffRate: stat.started ? Math.round(((stat.started - stat.completed) / stat.started) * 100) : 0,
    }))
    .sort((a, b) => b.views - a.views || b.started - a.started);

  return {
    courseId: course.id,
    title: course.title,
    enrollments: enrollments.length,
    activeStudents,
    completedCourses,
    completionRate: enrollments.length ? Math.round((completedCourses / enrollments.length) * 100) : 0,
    averageProgress: enrollments.length ? Math.round(progressTotal / enrollments.length) : 0,
    lessonCompletionRate: (() => {
      const started = lessonRows.reduce((sum, row) => sum + row.started, 0);
      const completed = lessonRows.reduce((sum, row) => sum + row.completed, 0);
      return started ? Math.round((completed / started) * 100) : 0;
    })(),
    averageQuizScore,
    quizPassRate,
    quizAttempts: attempts.length,
    lessons: lessonRows,
    mostViewedLessons: [...lessonRows].sort((a, b) => b.views - a.views).slice(0, 5),
    highDropoffLessons: [...lessonRows].filter((row) => row.started > 0).sort((a, b) => b.dropoffRate - a.dropoffRate).slice(0, 5),
    quizzes: quizzes.map((quiz) => quizMeta(quiz, null)),
  };
}

export function enrollmentOut(enrollment) {
  const user = findUser(enrollment.userId);
  const course = db().courses.find((c) => c.id === enrollment.courseId);
  const progress = course ? courseProgress(enrollment.userId, course) : null;
  return {
    id: enrollment.id,
    userId: enrollment.userId,
    userName: user?.name ?? "Deleted student",
    userEmail: user?.email ?? "",
    courseId: enrollment.courseId,
    courseTitle: course?.title ?? "",
    enrolledAt: enrollment.enrolledAt,
    lastActivityAt: enrollment.lastActivityAt ?? null,
    completed: progress?.completed ?? false,
    progressPct: progress?.pct ?? 0,
    done: progress?.done ?? 0,
    lessonCount: progress?.lessonCount ?? 0,
    lastLessonId: progress?.lastLessonId ?? null,
    certificateId: certificateFor(enrollment.userId, enrollment.courseId)?.id ?? null,
  };
}

/** Build a fresh course record from validated input. */
export function buildCourse(input, teacherId) {
  return ensureCourse({
    id: newId("c"),
    title: input.title,
    titleAm: input.titleAm || input.title,
    description: input.description ?? "",
    descriptionAm: input.descriptionAm ?? "",
    teacherId,
    categoryId: input.categoryId || "theology",
    cover: input.cover ?? 0,
    language: input.language ?? "en",
    difficulty: input.difficulty ?? "beginner",
    estimatedDuration: Number(input.estimatedDuration) || 0,
    objectives: (input.objectives ?? []).filter(Boolean),
    prerequisites: (input.prerequisites ?? []).filter(Boolean),
    status: input.status ?? "draft",
    visibility: input.visibility ?? "public",
    ordering: Number(input.ordering) || 0,
    certificateEnabled: input.certificateEnabled !== false,
    finalQuizId: input.finalQuizId || null,
    videoIds: (input.videoIds ?? []).filter(Boolean),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export function touchCourse(course) {
  course.updatedAt = new Date().toISOString();
}

export function newQuestion(input, order) {
  const type = QUESTION_TYPES.includes(input.type) ? input.type : "multiple_choice";
  const options = (input.options ?? [])
    .filter((option) => String(option.text ?? "").trim())
    .map((option) => ({
      id: option.id || newId("opt"),
      text: String(option.text).trim(),
      textAm: String(option.textAm ?? "").trim(),
      correct: Boolean(option.correct),
    }));
  if (type === "true_false" && options.length === 0) {
    options.push(
      { id: newId("opt"), text: "True", textAm: "እውነት", correct: Boolean(input.correctTrue) },
      { id: newId("opt"), text: "False", textAm: "ሐሰት", correct: !input.correctTrue },
    );
  }
  return {
    id: input.id || newId("q"),
    type,
    text: String(input.text ?? "").trim(),
    textAm: String(input.textAm ?? "").trim(),
    points: Math.max(1, Math.min(100, Number(input.points) || 1)),
    order: Number.isFinite(Number(input.order)) ? Number(input.order) : order,
    explanation: String(input.explanation ?? "").trim(),
    options,
    acceptedAnswers: (input.acceptedAnswers ?? []).map((value) => String(value).trim()).filter(Boolean),
  };
}
