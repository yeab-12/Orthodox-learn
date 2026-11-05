import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tewahedo-course-test-"));
let child;
let base = "";
let adminToken = "";
let studentToken = "";
let teacherOneToken = "";
let teacherTwoToken = "";

const state = {
  courseId: "",
  lessonIds: [],
  draftLessonId: "",
  quizId: "",
  answers: [],
  attemptId: "",
  certificateId: "",
  practiceQuizId: "",
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function waitForHealth() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${base}/api/v1/health`);
      if (response.ok) return;
    } catch {
      /* server is still starting */
    }
    await wait(250);
  }
  throw new Error("The test API did not start in time.");
}

async function api(pathname, { token, method = "GET", body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${base}/api/v1${pathname}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: response.status, data };
}

function expectStatus(response, status, label) {
  assert.equal(
    response.status,
    status,
    `${label} expected ${status}, received ${response.status}: ${JSON.stringify(response.data)}`,
  );
  return response.data;
}

async function login(email, password) {
  const data = expectStatus(
    await api("/auth/login", { method: "POST", body: { email, password } }),
    200,
    `login ${email}`,
  );
  return data.token;
}

before(async () => {
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ["src/index.js"], {
    cwd: backendDir,
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: path.join(tempRoot, "data"),
      UPLOADS_DIR: path.join(tempRoot, "uploads"),
      JWT_SECRET: "test-only-secret",
      ADMIN_EMAIL: "admin@tewahedo.app",
      ADMIN_PASSWORD: "Tewahedo2026!",
      DEMO_STUDENT_EMAIL: "student@tewahedo.app",
      DEMO_STUDENT_PASSWORD: "Student2026!",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[api] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[api] ${chunk}`));
  await waitForHealth();
  adminToken = await login("admin@tewahedo.app", "Tewahedo2026!");
  studentToken = await login("student@tewahedo.app", "Student2026!");
  teacherOneToken = await login("teacher.a@tewahedo.app", "teacher-demo-only");
  teacherTwoToken = await login("teacher.b@tewahedo.app", "teacher-demo-only");
});

after(async () => {
  if (child) {
    child.kill();
    await wait(300);
  }
  try {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  } catch {
    /* temporary folder may still be locked briefly on Windows */
  }
});

test("admin creates a full course, adds lessons and reorders them", async () => {
  const created = expectStatus(
    await api("/manage/courses", {
      token: adminToken,
      method: "POST",
      body: {
        title: "Complete Workflow Course",
        titleAm: "የሙሉ ሂደት ኮርስ",
        description: "Created by the automated workflow test.",
        descriptionAm: "በራስ-ሰር የሂደት ሙከራ የተፈጠረ።",
        teacherId: "t1",
        categoryId: "prayer",
        language: "en",
        difficulty: "intermediate",
        estimatedDuration: 1800,
        objectives: ["Learn the basics", "Practise daily"],
        prerequisites: ["No prior study"],
        status: "published",
        visibility: "public",
        ordering: 5,
        certificateEnabled: true,
      },
    }),
    201,
    "create course",
  );

  state.courseId = created.course.id;
  assert.equal(created.course.teacherId, "t1");
  assert.equal(created.course.status, "published");
  assert.equal(created.course.difficulty, "intermediate");
  assert.deepEqual(created.course.objectives, ["Learn the basics", "Practise daily"]);

  const lessons = [
    {
      title: "Workflow Lesson One",
      titleAm: "የሂደት ትምህርት አንድ",
      description: "First lesson",
      durationSec: 100,
      objectives: ["Understand the first idea"],
      resources: [{ title: "Reading sheet", url: "https://example.org/one.pdf" }],
      downloadTitle: "Lesson notes",
      downloadUrl: "https://example.org/notes.pdf",
    },
    {
      title: "Workflow Lesson Two",
      titleAm: "የሂደት ትምህርት ሁለት",
      description: "Second lesson",
      durationSec: 100,
    },
    {
      title: "Workflow Draft Lesson",
      titleAm: "የሂደት ረቂቅ ትምህርት",
      description: "Hidden until published",
      durationSec: 100,
      lessonStatus: "draft",
    },
  ];

  for (const lesson of lessons) {
    const data = expectStatus(
      await api(`/manage/courses/${state.courseId}/lessons`, {
        token: adminToken,
        method: "POST",
        body: lesson,
      }),
      201,
      `add lesson ${lesson.title}`,
    );
    state.lessonIds.push(data.lesson.id);
    if (lesson.lessonStatus === "draft") state.draftLessonId = data.lesson.id;
  }

  assert.equal(state.lessonIds.length, 3);
  const [first, second, third] = state.lessonIds;

  const reordered = expectStatus(
    await api(`/manage/courses/${state.courseId}/lessons/reorder`, {
      token: adminToken,
      method: "POST",
      body: { videoIds: [third, first, second] },
    }),
    200,
    "reorder lessons",
  );
  assert.deepEqual(reordered.videoIds, [third, first, second]);

  const moved = expectStatus(
    await api(`/manage/courses/${state.courseId}/lessons/${third}/move`, {
      token: adminToken,
      method: "POST",
      body: { direction: "down" },
    }),
    200,
    "move lesson",
  );
  assert.deepEqual(moved.videoIds, [first, third, second]);

  expectStatus(
    await api(`/manage/courses/${state.courseId}/lessons/reorder`, {
      token: adminToken,
      method: "POST",
      body: { videoIds: [first, second, third] },
    }),
    200,
    "restore lesson order",
  );

  const detail = expectStatus(
    await api(`/manage/courses/${state.courseId}`, { token: adminToken }),
    200,
    "manager course detail",
  );
  assert.equal(detail.course.lessons.length, 3);
  assert.equal(detail.course.lessons[0].id, first);
  assert.equal(detail.course.lessons[0].objectives[0], "Understand the first idea");
  assert.equal(detail.course.lessons[0].downloadUrl, "https://example.org/notes.pdf");

  const patched = expectStatus(
    await api(`/manage/courses/${state.courseId}`, {
      token: adminToken,
      method: "PATCH",
      body: { description: "Updated by the workflow test.", difficulty: "advanced" },
    }),
    200,
    "patch course",
  );
  assert.equal(patched.course.difficulty, "advanced");
  assert.equal(patched.course.description, "Updated by the workflow test.");
});

test("course management is limited to admins and the owning teacher", async () => {
  expectStatus(
    await api("/manage/courses", { token: studentToken }),
    403,
    "student cannot open management",
  );
  expectStatus(
    await api(`/manage/courses/${state.courseId}`, { token: teacherTwoToken }),
    404,
    "another teacher cannot open the course",
  );
  expectStatus(
    await api(`/manage/courses/${state.courseId}`, {
      token: teacherTwoToken,
      method: "PATCH",
      body: { title: "Hijacked title" },
    }),
    404,
    "another teacher cannot edit the course",
  );

  const owned = expectStatus(
    await api(`/manage/courses/${state.courseId}`, { token: teacherOneToken }),
    200,
    "owner can open the course",
  );
  assert.equal(owned.course.id, state.courseId);

  const teacherEdit = expectStatus(
    await api(`/manage/courses/${state.courseId}`, {
      token: teacherOneToken,
      method: "PATCH",
      body: { visibility: "public" },
    }),
    200,
    "owner can edit safe fields",
  );
  assert.equal(teacherEdit.course.visibility, "public");

  expectStatus(
    await api(`/manage/courses/${state.courseId}/publish`, {
      token: teacherOneToken,
      method: "POST",
      body: { status: "archived" },
    }),
    403,
    "teachers cannot archive or publish courses",
  );

  expectStatus(
    await api(`/manage/courses/${state.courseId}`, {
      token: teacherTwoToken,
      method: "DELETE",
    }),
    404,
    "another teacher cannot archive the course",
  );
});

test("quiz builder stores every question type and publishes safely", async () => {
  const quiz = expectStatus(
    await api(`/manage/courses/${state.courseId}/quizzes`, {
      token: adminToken,
      method: "POST",
      body: {
        title: "Workflow Final Quiz",
        titleAm: "የሂደት የመጨረሻ ፈተና",
        description: "Covers the whole course.",
        type: "final",
        passingScore: 70,
        maxAttempts: 1,
        timeLimitMin: 15,
      },
    }),
    201,
    "create final quiz",
  );
  state.quizId = quiz.quiz.id;
  assert.equal(quiz.quiz.published, false);
  assert.equal(quiz.quiz.questionCount, 0);

  expectStatus(
    await api(`/manage/courses/${state.courseId}/quizzes`, {
      token: adminToken,
      method: "POST",
      body: { title: "Second final quiz", type: "final" },
    }),
    409,
    "a course can only have one final quiz",
  );

  const questions = [
    {
      type: "multiple_choice",
      text: "Which day is the Lord's Day?",
      textAm: "የጌታ ቀን የትኛው ነው?",
      points: 2,
      explanation: "Sunday commemorates the resurrection.",
      options: [
        { text: "Sunday", textAm: "እሁድ", correct: true },
        { text: "Monday", textAm: "ሰኞ", correct: false },
        { text: "Friday", textAm: "ዓርብ", correct: false },
      ],
    },
    {
      type: "true_false",
      text: "The Church fasts during Lent.",
      textAm: "ቤተ ክርስቲያን በዓቢይ ጾም ትጾማለች።",
      points: 2,
      explanation: "Lent is one of the major fasting seasons.",
      options: [
        { text: "True", textAm: "እውነት", correct: true },
        { text: "False", textAm: "ሐሰት", correct: false },
      ],
    },
    {
      type: "multiple_select",
      text: "Which are fruits of prayer?",
      textAm: "የጸሎት ፍሬዎች የትኞቹ ናቸው?",
      points: 2,
      explanation: "Prayer brings peace and patience.",
      options: [
        { text: "Peace", textAm: "ሰላም", correct: true },
        { text: "Patience", textAm: "ትዕግስት", correct: true },
        { text: "Anxiety", textAm: "ጭንቀት", correct: false },
      ],
    },
    {
      type: "short_answer",
      text: "What is another name for the book of Psalms?",
      textAm: "የመዝሙራት መጽሐፍ ሌላ ስም ምንድን ነው?",
      points: 2,
      explanation: "It is also called the Psalter.",
      acceptedAnswers: ["Psalter", "መዝሙር"],
    },
  ];

  const stored = [];
  for (const question of questions) {
    const data = expectStatus(
      await api(`/manage/quizzes/${state.quizId}/questions`, {
        token: adminToken,
        method: "POST",
        body: question,
      }),
      201,
      `add ${question.type} question`,
    );
    assert.equal(data.questions.length, stored.length + 1);
    stored.push(data.questions[data.questions.length - 1]);
  }

  assert.equal(stored.length, 4);
  assert.equal(stored.reduce((sum, question) => sum + question.points, 0), 8);

  const mcq = stored.find((question) => question.type === "multiple_choice");
  const trueFalse = stored.find((question) => question.type === "true_false");
  const multi = stored.find((question) => question.type === "multiple_select");
  const short = stored.find((question) => question.type === "short_answer");

  state.answers = [
    { questionId: mcq.id, optionIds: [mcq.options.find((option) => option.correct).id] },
    { questionId: trueFalse.id, optionIds: [trueFalse.options.find((option) => option.correct).id] },
    {
      questionId: multi.id,
      optionIds: multi.options.filter((option) => option.correct).map((option) => option.id),
    },
    { questionId: short.id, text: "psalter" },
  ];

  const published = expectStatus(
    await api(`/manage/quizzes/${state.quizId}`, {
      token: adminToken,
      method: "PATCH",
      body: { published: true, passingScore: 70, maxAttempts: 1 },
    }),
    200,
    "publish quiz",
  );
  assert.equal(published.quiz.published, true);
  assert.equal(published.quiz.questionCount, 4);
  assert.equal(published.quiz.totalPoints, 8);

  expectStatus(
    await api(`/manage/quizzes/${state.quizId}/questions`, {
      token: studentToken,
      method: "POST",
      body: { ...questions[0], text: "Students cannot add questions" },
    }),
    403,
    "students cannot author questions",
  );

  expectStatus(
    await api(`/manage/courses/${state.courseId}/analytics`, { token: studentToken }),
    403,
    "students cannot view course analytics",
  );
});

test("draft lessons stay hidden from guests and learners", async () => {
  const guestList = expectStatus(await api("/courses"), 200, "guest course list");
  const guestCourse = guestList.courses.find((course) => course.id === state.courseId);
  assert.ok(guestCourse);
  assert.equal(guestCourse.lessonCount, 2);

  const guestDetail = expectStatus(
    await api(`/courses/${state.courseId}`),
    200,
    "guest course detail",
  );
  assert.equal(guestDetail.course.lessons.length, 2);
  assert.equal(
    guestDetail.course.lessons.some((lesson) => lesson.id === state.draftLessonId),
    false,
  );

  const managerDetail = expectStatus(
    await api(`/manage/courses/${state.courseId}`, { token: adminToken }),
    200,
    "manager detail includes drafts",
  );
  assert.equal(managerDetail.course.lessons.length, 3);
});

test("students enrol, resume lessons and completion waits for the final quiz", async () => {
  const before = expectStatus(
    await api(`/courses/${state.courseId}`, { token: studentToken }),
    200,
    "course detail before enrolment",
  );
  assert.equal(before.course.enrolled, false);
  assert.equal(before.course.completed, false);

  expectStatus(
    await api(`/courses/${state.courseId}/certificate`, {
      token: studentToken,
      method: "POST",
    }),
    403,
    "cannot claim a certificate before enrolment",
  );

  const enrolled = expectStatus(
    await api(`/courses/${state.courseId}/enroll`, { token: studentToken, method: "POST" }),
    201,
    "enrol",
  );
  assert.equal(enrolled.course.enrolled, true);
  assert.ok(enrolled.enrollmentId);

  expectStatus(
    await api(`/courses/${state.courseId}/lessons/${state.lessonIds[0]}/start`, {
      token: studentToken,
      method: "POST",
    }),
    200,
    "start first lesson",
  );

  const watched = expectStatus(
    await api(`/courses/${state.courseId}/lessons/${state.lessonIds[0]}/progress`, {
      token: studentToken,
      method: "POST",
      body: { positionSec: 92, durationSec: 100 },
    }),
    200,
    "save watch progress",
  );
  assert.equal(watched.lesson.completed, true);
  assert.equal(watched.lesson.lastPositionSec, 92);
  assert.equal(watched.progress.done, 1);
  assert.equal(watched.progress.completed, false);

  expectStatus(
    await api(`/courses/${state.courseId}/lessons/${state.lessonIds[0]}/progress`, {
      token: studentToken,
      method: "POST",
      body: { positionSec: 30, durationSec: 100, completed: false },
    }),
    200,
    "mark progress as not completed",
  );

  const completed = expectStatus(
    await api(`/courses/${state.courseId}/lessons/${state.lessonIds[0]}/complete`, {
      token: studentToken,
      method: "POST",
      body: { completed: true },
    }),
    200,
    "complete first lesson",
  );
  assert.equal(completed.progress.done, 1);

  const second = expectStatus(
    await api(`/courses/${state.courseId}/lessons/${state.lessonIds[1]}/complete`, {
      token: studentToken,
      method: "POST",
      body: { completed: true },
    }),
    200,
    "complete second lesson",
  );
  assert.equal(second.progress.done, 2);
  assert.equal(second.progress.lessonPct, 100);
  assert.equal(second.progress.completed, false, "the final quiz is still required");

  const noCertificate = expectStatus(
    await api(`/courses/${state.courseId}/certificate`, { token: studentToken }),
    200,
    "certificate lookup before completion",
  );
  assert.equal(noCertificate.certificate, null);

  expectStatus(
    await api(`/courses/${state.courseId}/certificate`, {
      token: studentToken,
      method: "POST",
    }),
    400,
    "cannot claim a certificate before passing the final quiz",
  );
});

test("quiz answers are graded on the server and attempts are saved", async () => {
  const quiz = expectStatus(
    await api(`/quizzes/${state.quizId}`, { token: studentToken }),
    200,
    "student quiz fetch",
  );
  assert.equal(quiz.quiz.questions.length, 4);
  for (const question of quiz.quiz.questions) {
    assert.equal("explanation" in question, false, "explanations stay hidden before submission");
    for (const option of question.options) {
      assert.equal("correct" in option, false, "correct answers stay hidden before submission");
    }
  }

  expectStatus(
    await api(`/courses/${state.courseId}/certificate`, { token: studentToken }),
    200,
    "certificate endpoint remains readable",
  );

  const started = expectStatus(
    await api(`/quizzes/${state.quizId}/start`, { token: studentToken, method: "POST" }),
    201,
    "start quiz",
  );
  state.attemptId = started.attempt.id;
  assert.equal(started.attempt.submittedAt, null);

  const submitted = expectStatus(
    await api(`/quizzes/${state.quizId}/submit`, {
      token: studentToken,
      method: "POST",
      body: {
        attemptId: state.attemptId,
        answers: state.answers,
        // A malicious score must be ignored by the server.
        score: 0,
        percentage: 0,
        passed: false,
      },
    }),
    200,
    "submit quiz",
  );

  assert.equal(submitted.attempt.percentage, 100);
  assert.equal(submitted.attempt.score, 8);
  assert.equal(submitted.attempt.totalPoints, 8);
  assert.equal(submitted.attempt.passed, true);
  assert.equal(submitted.attempt.answers.length, 4);
  assert.ok(submitted.attempt.answers.every((answer) => answer.correct === true));
  assert.ok(submitted.attempt.answers.every((answer) => typeof answer.explanation === "string"));
  assert.ok(submitted.certificate, "the certificate is issued after lessons and the final quiz");
  state.certificateId = submitted.certificate.id;

  expectStatus(
    await api(`/quizzes/${state.quizId}/start`, { token: studentToken, method: "POST" }),
    400,
    "attempt limit is enforced",
  );

  const attempts = expectStatus(
    await api(`/quizzes/${state.quizId}/attempts`, { token: studentToken }),
    200,
    "attempt history",
  );
  assert.equal(attempts.attempts.length, 1);
  assert.equal(attempts.summary.attemptsUsed, 1);
  assert.equal(attempts.summary.bestPercentage, 100);
  assert.equal(attempts.summary.passed, true);

  expectStatus(
    await api(`/quizzes/${state.quizId}/attempts/${state.attemptId}`, { token: teacherTwoToken }),
    403,
    "another user cannot read the attempt",
  );

  const course = expectStatus(
    await api(`/courses/${state.courseId}`, { token: studentToken }),
    200,
    "completed course detail",
  );
  assert.equal(course.course.completed, true);
  assert.equal(course.course.progressPct, 100);
  assert.equal(course.course.finalQuiz.passed, true);
});

test("certificates are issued once, listed per learner and publicly verifiable", async () => {
  const own = expectStatus(
    await api(`/learning/certificates/${state.certificateId}`, { token: studentToken }),
    200,
    "learner reads certificate",
  );
  assert.equal(own.certificate.courseId, state.courseId);
  assert.equal(own.certificate.platform, "Tewahedo Learn");
  assert.equal(own.certificate.studentName, "Demo Student");

  expectStatus(
    await api(`/learning/certificates/${state.certificateId}`, { token: teacherTwoToken }),
    403,
    "another user cannot read the certificate",
  );

  const publicVerify = expectStatus(
    await api(`/learning/verify/${state.certificateId}`),
    200,
    "public certificate verification",
  );
  assert.equal(publicVerify.valid, true);
  assert.equal(publicVerify.certificate.courseTitle, "Complete Workflow Course");
  assert.equal(publicVerify.certificate.platform, "Tewahedo Learn");

  const missing = await api(`/learning/verify/cert_does_not_exist`);
  assert.equal(missing.status, 404);
  assert.equal(missing.data.valid, false);

  const dashboard = expectStatus(
    await api("/learning/dashboard", { token: studentToken }),
    200,
    "learner dashboard",
  );
  assert.ok(dashboard.stats.completedCourses >= 1);
  assert.ok(dashboard.stats.lessonsCompleted >= 2);
  assert.equal(dashboard.stats.quizAverage, 100);
  assert.ok(dashboard.certificates.some((cert) => cert.id === state.certificateId));
  assert.ok(dashboard.courses.some((course) => course.id === state.courseId && course.completed));
  assert.ok(dashboard.recentActivity.some((item) => item.type === "quiz_submitted"));

  const filtered = expectStatus(
    await api("/learning/dashboard?filter=completed", { token: studentToken }),
    200,
    "completed filter",
  );
  assert.ok(filtered.courses.every((course) => course.completed));

  const other = expectStatus(
    await api("/learning/dashboard", { token: teacherTwoToken }),
    200,
    "second learner dashboard",
  );
  assert.equal(other.stats.enrolledCourses, 0);
  assert.equal(other.courses.length, 0);
  assert.equal(other.certificates.length, 0);
});

test("course analytics reflect real enrolment and quiz data", async () => {
  const analytics = expectStatus(
    await api(`/manage/courses/${state.courseId}/analytics`, { token: adminToken }),
    200,
    "admin course analytics",
  ).analytics;
  assert.equal(analytics.enrollments, 1);
  assert.equal(analytics.completedCourses, 1);
  assert.equal(analytics.completionRate, 100);
  assert.equal(analytics.averageProgress, 100);
  assert.equal(analytics.averageQuizScore, 100);
  assert.equal(analytics.quizPassRate, 100);
  assert.ok(analytics.lessonCompletionRate > 0);
  assert.ok(Array.isArray(analytics.mostViewedLessons));
  assert.ok(Array.isArray(analytics.highDropoffLessons));

  const owned = expectStatus(
    await api(`/manage/courses/${state.courseId}/analytics`, { token: teacherOneToken }),
    200,
    "owning teacher analytics",
  );
  assert.equal(owned.analytics.enrollments, 1);

  const enrollments = expectStatus(
    await api(`/manage/courses/${state.courseId}/enrollments`, { token: adminToken }),
    200,
    "course enrolments",
  );
  assert.equal(enrollments.total, 1);
  assert.equal(enrollments.enrollments[0].userName, "Demo Student");
  assert.equal(enrollments.enrollments[0].completed, true);

  const overview = expectStatus(await api("/manage/overview", { token: adminToken }), 200, "overview");
  assert.ok(overview.stats.courses >= 1);
  assert.ok(overview.stats.enrollments >= 1);
});

test("practice quizzes allow retries until the attempt limit", async () => {
  const created = expectStatus(
    await api(`/manage/courses/${state.courseId}/quizzes`, {
      token: adminToken,
      method: "POST",
      body: {
        title: "Workflow Practice Quiz",
        type: "practice",
        passingScore: 50,
        maxAttempts: 2,
      },
    }),
    201,
    "create practice quiz",
  );
  state.practiceQuizId = created.quiz.id;

  const question = expectStatus(
    await api(`/manage/quizzes/${state.practiceQuizId}/questions`, {
      token: adminToken,
      method: "POST",
      body: {
        type: "multiple_choice",
        text: "How many attempts does this quiz allow?",
        points: 1,
        options: [
          { text: "Two", correct: true },
          { text: "Five", correct: false },
        ],
      },
    }),
    201,
    "add practice question",
  ).questions[0];

  expectStatus(
    await api(`/manage/quizzes/${state.practiceQuizId}`, {
      token: adminToken,
      method: "PATCH",
      body: { published: true },
    }),
    200,
    "publish practice quiz",
  );

  const wrongOption = question.options.find((option) => !option.correct).id;
  const correctOption = question.options.find((option) => option.correct).id;

  const first = expectStatus(
    await api(`/quizzes/${state.practiceQuizId}/start`, { token: studentToken, method: "POST" }),
    201,
    "start first practice attempt",
  );
  const firstResult = expectStatus(
    await api(`/quizzes/${state.practiceQuizId}/submit`, {
      token: studentToken,
      method: "POST",
      body: {
        attemptId: first.attempt.id,
        answers: [{ questionId: question.id, optionIds: [wrongOption] }],
      },
    }),
    200,
    "submit wrong answer",
  );
  assert.equal(firstResult.attempt.percentage, 0);
  assert.equal(firstResult.attempt.passed, false);

  const second = expectStatus(
    await api(`/quizzes/${state.practiceQuizId}/start`, { token: studentToken, method: "POST" }),
    201,
    "start retry",
  );
  const retry = expectStatus(
    await api(`/quizzes/${state.practiceQuizId}/submit`, {
      token: studentToken,
      method: "POST",
      body: {
        attemptId: second.attempt.id,
        answers: [{ questionId: question.id, optionIds: [correctOption] }],
      },
    }),
    200,
    "submit correct retry",
  );
  assert.equal(retry.attempt.percentage, 100);
  assert.equal(retry.attempt.passed, true);

  expectStatus(
    await api(`/quizzes/${state.practiceQuizId}/start`, { token: studentToken, method: "POST" }),
    400,
    "third attempt is refused",
  );

  const attempts = expectStatus(
    await api(`/quizzes/${state.practiceQuizId}/attempts`, { token: studentToken }),
    200,
    "practice attempt history",
  );
  assert.equal(attempts.attempts.length, 2);
  assert.equal(attempts.summary.passed, true);
});

test("archiving hides a course without deleting its lessons or certificate", async () => {
  const archived = expectStatus(
    await api(`/manage/courses/${state.courseId}`, { token: adminToken, method: "DELETE" }),
    200,
    "archive course",
  );
  assert.equal(archived.archived, true);
  assert.equal(archived.course.status, "archived");

  expectStatus(
    await api(`/courses/${state.courseId}`),
    404,
    "archived courses are hidden from guests",
  );

  const list = expectStatus(await api("/courses"), 200, "public list after archive");
  assert.equal(list.courses.some((course) => course.id === state.courseId), false);

  const lessonStillExists = expectStatus(
    await api(`/videos/${state.lessonIds[0]}`, { token: adminToken }),
    200,
    "lesson media record survives archiving",
  );
  assert.equal(lessonStillExists.video.id, state.lessonIds[0]);

  expectStatus(
    await api(`/manage/courses/${state.courseId}/publish`, {
      token: adminToken,
      method: "POST",
      body: { status: "published" },
    }),
    200,
    "republish course",
  );
  const restored = expectStatus(
    await api(`/courses/${state.courseId}`),
    200,
    "republished course is public again",
  );
  assert.equal(restored.course.status, "published");
});

test("permanent deletion is admin-only and keeps issued certificates", async () => {
  expectStatus(
    await api(`/manage/courses/${state.courseId}?permanent=true`, {
      token: teacherOneToken,
      method: "DELETE",
    }),
    403,
    "teachers cannot permanently delete",
  );

  expectStatus(
    await api(`/manage/courses/${state.courseId}?permanent=true`, {
      token: adminToken,
      method: "DELETE",
    }),
    200,
    "admin permanent delete",
  );

  expectStatus(
    await api(`/manage/courses/${state.courseId}`, { token: adminToken }),
    404,
    "course is gone",
  );
  expectStatus(
    await api(`/quizzes/${state.quizId}`, { token: adminToken }),
    404,
    "course quizzes are gone",
  );

  const verify = expectStatus(
    await api(`/learning/verify/${state.certificateId}`),
    200,
    "certificate stays verifiable",
  );
  assert.equal(verify.valid, true);

  const lessonStillExists = expectStatus(
    await api(`/videos/${state.lessonIds[0]}`, { token: adminToken }),
    200,
    "lessons stay in the library",
  );
  assert.equal(lessonStillExists.video.id, state.lessonIds[0]);
});
