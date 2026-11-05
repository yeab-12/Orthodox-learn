import { Router } from "express";
import { z } from "zod";
import { db, save } from "../store.js";
import { ApiError, findUser } from "../lib.js";
import { authRequired } from "../auth.js";
import {
  canManageCourse,
  attemptOut,
  findCourseEnrollment,
  findQuiz,
  gradeQuiz,
  isPublicCourse,
  issueCertificate,
  quizAttemptSummary,
  quizMeta,
  quizOut,
} from "../courseLib.js";

export const quizzesRouter = Router();

const answerSchema = z.object({
  questionId: z.string().min(1),
  optionIds: z.array(z.string()).optional().default([]),
  text: z.string().max(2000).optional().default(""),
});

const submitSchema = z.object({
  attemptId: z.string().min(1, "A quiz attempt is required."),
  answers: z.array(answerSchema).max(500).optional().default([]),
  timeSpentSec: z.coerce.number().int().min(0).max(86_400).optional().default(0),
});

function quizWithAccess(id, viewer, { allowUnpublished = false } = {}) {
  const quiz = findQuiz(id);
  if (!quiz) throw new ApiError(404, "Quiz not found.");
  const course = db().courses.find((item) => item.id === quiz.courseId);
  if (!course) throw new ApiError(404, "Quiz not found.");
  const manager = canManageCourse(viewer, course);
  if (!manager) {
    if (quiz.published === false || quiz.available === false) throw new ApiError(404, "Quiz not found.");
    if (!allowUnpublished && !isPublicCourse(course)) throw new ApiError(404, "Quiz not found.");
  }
  return { quiz, course, manager };
}

function requireEnrolledLearner(user, course, manager) {
  if (manager) return null;
  const enrollment = findCourseEnrollment(user.id, course.id);
  if (!enrollment) throw new ApiError(403, "Enrol in this course before taking its quizzes.");
  return enrollment;
}

function attemptsUsed(userId, quiz) {
  return quizAttemptSummary(userId, quiz).attemptsUsed;
}

quizzesRouter.get("/:id", authRequired, (req, res) => {
  const { quiz, course, manager } = quizWithAccess(req.params.id, req.user);
  requireEnrolledLearner(req.user, course, manager);
  res.json({ quiz: quizOut(quiz, req.user.id, { includeAnswers: manager }) });
});

quizzesRouter.post("/:id/start", authRequired, (req, res) => {
  const { quiz, course, manager } = quizWithAccess(req.params.id, req.user);
  requireEnrolledLearner(req.user, course, manager);

  if (quiz.available === false) throw new ApiError(400, "This quiz is not available right now.");
  if (quiz.published === false && !manager) throw new ApiError(400, "This quiz is not published yet.");

  const existing = db().quizAttempts.find(
    (attempt) => attempt.userId === req.user.id && attempt.quizId === quiz.id && !attempt.submittedAt,
  );
  if (existing) {
    return res.json({
      attempt: attemptOut(existing),
      quiz: quizOut(quiz, req.user.id, { includeAnswers: manager }),
      resumed: true,
    });
  }

  const max = Number(quiz.maxAttempts) || 0;
  if (!manager && max > 0 && attemptsUsed(req.user.id, quiz) >= max) {
    throw new ApiError(400, "You have used all available attempts for this quiz.");
  }

  const previous = db().quizAttempts.filter((attempt) => attempt.userId === req.user.id && attempt.quizId === quiz.id);
  const attempt = {
    id: `qa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    quizId: quiz.id,
    courseId: quiz.courseId,
    userId: req.user.id,
    attemptNumber: previous.length + 1,
    startedAt: new Date().toISOString(),
    submittedAt: null,
    answers: [],
    graded: false,
  };
  db().quizAttempts.push(attempt);
  save();
  res.status(201).json({
    attempt: attemptOut(attempt),
    quiz: quizOut(quiz, req.user.id, { includeAnswers: manager }),
    resumed: false,
  });
});

quizzesRouter.post("/:id/submit", authRequired, (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);
  const { quiz, course, manager } = quizWithAccess(req.params.id, req.user);
  requireEnrolledLearner(req.user, course, manager);

  const attempt = db().quizAttempts.find(
    (row) => row.id === parsed.data.attemptId && row.quizId === quiz.id && row.userId === req.user.id,
  );
  if (!attempt) throw new ApiError(404, "Quiz attempt not found.");
  if (attempt.submittedAt) throw new ApiError(409, "This attempt has already been submitted.");

  const result = gradeQuiz(quiz, parsed.data.answers);
  const submittedAt = new Date().toISOString();
  const startedAt = attempt.startedAt ? new Date(attempt.startedAt).getTime() : Date.now();
  attempt.answers = result.answers;
  attempt.score = result.score;
  attempt.totalPoints = result.totalPoints;
  attempt.percentage = result.percentage;
  attempt.passed = result.passed;
  attempt.passingScore = result.passingScore;
  attempt.submittedAt = submittedAt;
  attempt.durationSec = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
  attempt.timeSpentSec = parsed.data.timeSpentSec;
  attempt.graded = true;

  const enrollment = findCourseEnrollment(req.user.id, course.id);
  if (enrollment) enrollment.lastActivityAt = submittedAt;

  let certificate = null;
  if (quiz.type === "final" && result.passed && enrollment) {
    certificate = issueCertificate(req.user.id, course);
  }

  save();
  const showAnswers = manager || quiz.showAnswers !== false;
  res.json({
    attempt: attemptOut(attempt, { includeAnswers: showAnswers }),
    quiz: quizMeta(quiz, req.user.id),
    certificate: certificate ? {
      id: certificate.id,
      courseId: certificate.courseId,
      courseTitle: certificate.courseTitle,
      issuedAt: certificate.issuedAt,
    } : null,
  });
});

quizzesRouter.get("/:id/attempts", authRequired, (req, res) => {
  const quiz = findQuiz(req.params.id);
  if (!quiz) throw new ApiError(404, "Quiz not found.");
  const course = db().courses.find((item) => item.id === quiz.courseId);
  const manager = canManageCourse(req.user, course);
  if (!manager) {
    if (quiz.published === false || quiz.available === false) throw new ApiError(404, "Quiz not found.");
    requireEnrolledLearner(req.user, course, manager);
  }
  const rows = db().quizAttempts
    .filter((attempt) => attempt.quizId === quiz.id && attempt.userId === req.user.id)
    .sort((a, b) => (b.attemptNumber ?? 0) - (a.attemptNumber ?? 0));
  res.json({
    attempts: rows.map((attempt) => attemptOut(attempt, {
      includeAnswers: manager || quiz.showAnswers !== false,
    })),
    summary: quizAttemptSummary(req.user.id, quiz),
  });
});

quizzesRouter.get("/:id/attempts/:attemptId", authRequired, (req, res) => {
  const quiz = findQuiz(req.params.id);
  if (!quiz) throw new ApiError(404, "Quiz not found.");
  const attempt = db().quizAttempts.find(
    (row) => row.id === req.params.attemptId && row.quizId === quiz.id,
  );
  if (!attempt) throw new ApiError(404, "Quiz attempt not found.");
  const course = db().courses.find((item) => item.id === quiz.courseId);
  const manager = canManageCourse(req.user, course);
  const owner = attempt.userId === req.user.id;
  if (!owner && !manager) throw new ApiError(403, "You can only view your own quiz results.");
  res.json({
    attempt: attemptOut(attempt, {
      includeAnswers: Boolean(attempt.submittedAt) && (manager || quiz.showAnswers !== false),
    }),
  });
});

/** Managers can review every attempt for a quiz from the analytics screen. */
quizzesRouter.get("/:id/results", authRequired, (req, res) => {
  const quiz = findQuiz(req.params.id);
  if (!quiz) throw new ApiError(404, "Quiz not found.");
  const course = db().courses.find((item) => item.id === quiz.courseId);
  if (!canManageCourse(req.user, course)) throw new ApiError(403, "You do not have permission to view these results.");
  const rows = db().quizAttempts
    .filter((attempt) => attempt.quizId === quiz.id && attempt.submittedAt)
    .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
  res.json({
    quiz: quizMeta(quiz, req.user.id),
    results: rows.map((attempt) => {
      const student = findUser(attempt.userId);
      return {
        ...attemptOut(attempt, { includeAnswers: false }),
        studentName: student?.name ?? "Deleted student",
      };
    }),
  });
});
