export type Lang = "en" | "am";
export type Role = "student" | "teacher" | "admin";
export type VideoStatus = "pending" | "approved" | "rejected";
export type LessonStatus = "published" | "draft";
export type CourseStatus = "draft" | "pending" | "published" | "archived";
export type CourseVisibility = "public" | "unlisted" | "private";
export type Difficulty = "beginner" | "intermediate" | "advanced";
export type QuizType = "lesson" | "final" | "practice";
export type QuestionType = "multiple_choice" | "true_false" | "multiple_select" | "short_answer";

export interface Category {
  id: string;
  en: string;
  am: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  bio: string;
  language: Lang;
  active: boolean;
  createdAt: string;
}

export interface Teacher {
  id: string;
  name: string;
  bio: string;
  language: Lang;
  role: Role;
  videoCount: number;
  courseCount: number;
  followers: number;
  following: boolean;
  createdAt: string;
}

export interface Video {
  id: string;
  title: string;
  titleAm: string;
  teacherId: string;
  teacher: { id: string; name: string; following?: boolean };
  categoryId: string;
  category: Category | null;
  language: Lang;
  durationSec: number;
  cover: number;
  description: string;
  descriptionAm: string;
  videoUrl: string | null;
  mediaType: "video" | "audio";
  demo: boolean;
  likes: number;
  views: number;
  comments: number;
  liked: boolean;
  saved: boolean;
  courseId: string | null;
  createdAt: string;
  status?: VideoStatus;
  archived?: boolean;
  rejectionReason?: string;
  uploadedBy?: string | null;
  uploadedByName?: string;
  attribution?: string;
  originalName?: string;
  fileSize?: number | null;
  mimeType?: string;
  uploadedAt?: string;
  approvedAt?: string | null;
  requestedCourseId?: string;
  batchId?: string;
  mediaState?: "ready" | "failed";
  retryCount?: number;
  lastRetryAt?: string | null;
  lessonStatus?: LessonStatus;
  objectives?: string[];
  resources?: LessonResource[];
  downloadTitle?: string;
  downloadUrl?: string;
  quiz?: QuizMeta | null;
}

export interface LessonResource {
  title: string;
  url: string;
}

export interface AdminVideo extends Video {
  fileExists: boolean;
}

export interface AdminVideoFacets {
  creators: { id: string; name: string; role: Role; videoCount: number }[];
  categories: Category[];
  languages: { id: Lang; name: string }[];
  courses: { id: string; title: string; titleAm: string }[];
}

export interface AdminVideoList {
  videos: AdminVideo[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: {
    all: number;
    pending: number;
    approved: number;
    rejected: number;
    archived: number;
    failed: number;
  };
  facets: AdminVideoFacets;
}

export interface LessonVideo extends Video {
  completed: boolean;
  order?: number;
  lastPositionSec?: number;
  watchedSec?: number;
}

export interface Course {
  id: string;
  title: string;
  titleAm: string;
  description: string;
  descriptionAm: string;
  teacherId: string;
  teacher: { id: string; name: string; bio?: string } | null;
  categoryId?: string;
  category?: Category | null;
  cover: number;
  language: Lang;
  difficulty: Difficulty;
  estimatedDuration: number;
  objectives: string[];
  prerequisites: string[];
  status: CourseStatus;
  visibility: CourseVisibility;
  ordering: number;
  certificateEnabled: boolean;
  lessonCount: number;
  totalLessonCount?: number;
  totalDurationSec?: number;
  done: number;
  progressPct: number;
  lessonPct: number;
  completed: boolean;
  enrolled: boolean;
  enrolledAt?: string | null;
  lastActivityAt?: string | null;
  lastLessonId?: string | null;
  lastPositionSec?: number;
  finalQuiz?: QuizMeta | null;
  quizzes?: QuizMeta[];
  certificate?: Certificate | null;
  createdAt: string;
  updatedAt?: string;
  lessons?: LessonVideo[];
  videoIds?: string[];
  resumeLessonId?: string | null;
  resumePositionSec?: number;
}

export interface QuizOption {
  id: string;
  text: string;
  textAm: string;
  correct?: boolean;
}

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  text: string;
  textAm: string;
  points: number;
  order: number;
  options: QuizOption[];
  explanation?: string;
  acceptedAnswers?: string[];
}

export interface QuizSummaryAttempt {
  id: string;
  percentage: number | null;
  passed: boolean | null;
  submittedAt: string | null;
}

export interface QuizMeta {
  id: string;
  courseId: string;
  lessonId: string | null;
  type: QuizType;
  title: string;
  titleAm: string;
  description: string;
  descriptionAm: string;
  passingScore: number;
  timeLimitMin: number;
  maxAttempts: number;
  available: boolean;
  published: boolean;
  showAnswers: boolean;
  questionCount: number;
  totalPoints: number;
  attemptsUsed: number;
  bestPercentage: number;
  passed: boolean;
  lastAttempt: QuizSummaryAttempt | null;
  createdAt: string;
  updatedAt: string;
  canAttempt?: boolean;
}

export interface Quiz extends QuizMeta {
  questions: QuizQuestion[];
}

export interface GradedAnswer {
  questionId: string;
  type: QuestionType;
  text: string;
  textAm: string;
  points: number;
  pointsAwarded: number;
  correct: boolean;
  optionIds: string[];
  answerText: string;
  correctOptionIds: string[];
  correctText: string;
  explanation: string;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  quizTitle: string;
  courseId: string;
  userId: string;
  studentName: string;
  attemptNumber: number;
  startedAt: string;
  submittedAt: string | null;
  durationSec: number | null;
  score: number | null;
  totalPoints: number | null;
  percentage: number | null;
  passed: boolean | null;
  gradingComplete: boolean;
  answers?: GradedAnswer[];
}

export interface Certificate {
  id: string;
  userId: string;
  courseId: string;
  studentName: string;
  courseTitle: string;
  courseTitleAm: string;
  teacherName: string;
  teacherNameAm?: string;
  issuedAt: string;
  platform: string;
  score: number | null;
  course: { id: string; title: string; titleAm: string; cover: number } | null;
  student: { id: string; name: string } | null;
}

export interface PublicCertificate {
  id: string;
  studentName: string;
  courseTitle: string;
  courseTitleAm: string;
  teacherName: string;
  issuedAt: string;
  platform: string;
}

export interface MyLearningStats {
  enrolledCourses: number;
  inProgress: number;
  completedCourses: number;
  notStarted: number;
  lessonsCompleted: number;
  quizAverage: number;
  quizAttempts: number;
  quizPassed: number;
  certificates: number;
  streak: number;
}

export interface ActivityItem {
  type: "lesson_completed" | "lesson_progress" | "quiz_submitted";
  at: string;
  courseId: string;
  courseTitle: string;
  courseTitleAm: string;
  lessonId?: string;
  lessonTitle?: string;
  lessonTitleAm?: string;
  quizId?: string;
  quizTitle?: string;
  quizTitleAm?: string;
  detail: string;
  percentage?: number;
  passed?: boolean;
}

export interface MyLearningDashboard {
  stats: MyLearningStats;
  continueLearning: Course[];
  recentActivity: ActivityItem[];
  certificates: Certificate[];
  courses: Course[];
  filter: string;
}

export interface ManageCourse extends Course {
  videoIds: string[];
  enrollments: number;
  averageProgress?: number;
  completionRate?: number;
  quizCount?: number;
}

export interface ManageCourseStats {
  all: number;
  published: number;
  draft: number;
  pending: number;
  archived: number;
}

export interface ManageCourseList {
  courses: ManageCourse[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: ManageCourseStats;
}

export interface ManageOverview {
  stats: {
    courses: number;
    published: number;
    draft: number;
    pending: number;
    archived: number;
    enrollments: number;
    activeStudents: number;
    completions: number;
    certificates: number;
    averageQuizScore: number;
    quizPassRate: number;
  };
  courses: ManageCourse[];
}

export interface EnrollmentRow {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  courseId: string;
  courseTitle: string;
  enrolledAt: string;
  lastActivityAt: string | null;
  completed: boolean;
  progressPct: number;
  done: number;
  lessonCount: number;
  lastLessonId: string | null;
  certificateId: string | null;
}

export interface AnalyticsLessonRow {
  lessonId: string;
  title: string;
  started: number;
  completed: number;
  views: number;
  completionRate: number;
  dropoffRate: number;
}

export interface CourseAnalytics {
  courseId: string;
  title: string;
  enrollments: number;
  activeStudents: number;
  completedCourses: number;
  completionRate: number;
  averageProgress: number;
  lessonCompletionRate: number;
  averageQuizScore: number;
  quizPassRate: number;
  quizAttempts: number;
  lessons: AnalyticsLessonRow[];
  mostViewedLessons: AnalyticsLessonRow[];
  highDropoffLessons: AnalyticsLessonRow[];
  quizzes: QuizMeta[];
}

export interface Comment {
  id: string;
  videoId: string;
  videoTitle: string;
  text: string;
  createdAt: string;
  user: { id: string; name: string; role: Role };
}

export interface NotificationItem {
  id: string;
  userId: string;
  text: string;
  textAm: string;
  href: string;
  read: boolean;
  createdAt: string;
}

export interface Summary {
  saved: number;
  completed: number;
  uploads: number;
  pendingUploads: number;
  courses: number;
  notifications: number;
}

export interface AdminStats {
  users: number;
  students: number;
  teachers: number;
  videos: number;
  approved: number;
  pending: number;
  rejected: number;
  archived?: number;
  courses: number;
  comments: number;
  messages: number;
  unreadMessages: number;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface AdminUser extends User {
  uploads: number;
  comments: number;
}
