import "dotenv/config";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { dbExists, readDbFile, save, setDb } from "./store.js";
import { seedData } from "./seed.js";
import { hashPassword, optionalAuth } from "./auth.js";
import { ApiError } from "./lib.js";
import { uploadsDir } from "./paths.js";
import { authRouter } from "./routes/auth.js";
import { videosRouter } from "./routes/videos.js";
import { coursesRouter } from "./routes/courses.js";
import { quizzesRouter } from "./routes/quizzes.js";
import { learningRouter } from "./routes/learning.js";
import { manageRouter } from "./routes/manage.js";
import { teachersRouter } from "./routes/teachers.js";
import { uploadsRouter } from "./routes/uploads.js";
import { adminRouter } from "./routes/admin.js";
import { miscRouter } from "./routes/misc.js";
import { normalizeState } from "./courseLib.js";

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoDir = path.resolve(backendDir, "..");
const port = Number(process.env.PORT) || 4000;

if (!dbExists()) {
  const seeded = seedData({
    adminHash: await hashPassword(process.env.ADMIN_PASSWORD || "Tewahedo2026!"),
    studentHash: await hashPassword(process.env.DEMO_STUDENT_PASSWORD || "Student2026!"),
    teacherHash: await hashPassword("teacher-demo-only"),
  });
  setDb(normalizeState(seeded));
  save();
  console.log("Created the database and seeded demo data.");
} else {
  const data = readDbFile();
  for (const key of ["users", "categories", "videos", "courses", "enrollments", "likes", "saves", "comments", "follows", "notifications", "messages"]) {
    if (!Array.isArray(data[key])) data[key] = [];
  }
  setDb(data);
  // Fill new course, lesson, quiz and progress fields in memory so existing
  // databases keep working without being rewritten on startup.
  normalizeState(data);
}

const app = express();
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } }));

const origins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || origins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
// Attach req.user for every request so authRequired/adminOnly work on all routers.
app.use(optionalAuth);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many attempts. Please wait 15 minutes and try again." },
});
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many messages. Please try again later." },
});

app.use("/uploads", express.static(uploadsDir, {
  acceptRanges: true,
  maxAge: "1h",
  dotfiles: "deny",
  setHeaders(res) {
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=3600");
  },
}));

app.use("/api/v1/auth/login", authLimiter);
app.use("/api/v1/auth/register", authLimiter);
app.use("/api/v1/contact", contactLimiter);

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/videos", videosRouter);
app.use("/api/v1/courses", coursesRouter);
app.use("/api/v1/quizzes", quizzesRouter);
app.use("/api/v1/learning", learningRouter);
app.use("/api/v1/manage", manageRouter);
app.use("/api/v1/teachers", teachersRouter);
app.use("/api/v1/uploads", uploadsRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1", miscRouter);

app.use("/api", (_req, _res, next) => next(new ApiError(404, "API route not found.")));

const distDir = path.join(repoDir, "frontend", "dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { maxAge: "1h", index: false }));
  app.get("*", (_req, res) => res.sendFile(path.join(distDir, "index.html")));
}

app.use((error, req, res, _next) => {
  if (error instanceof ApiError) {
    return res.status(error.status).json({ error: error.message, details: error.details });
  }
  if (error?.name === "MulterError") {
    return res.status(400).json({ error: error.code === "LIMIT_FILE_SIZE" ? "The file is too large." : error.message });
  }
  console.error(`[${req.method} ${req.originalUrl}]`, error);
  return res.status(500).json({ error: "Something went wrong on the server. Please try again." });
});

app.listen(port, () => {
  console.log(`Tewahedo Learn API: http://localhost:${port}`);
  console.log(`Admin login: ${process.env.ADMIN_EMAIL || "admin@tewahedo.app"} (password is in backend/.env)`);
  if (fs.existsSync(distDir)) console.log(`Web app (production build): http://localhost:${port}`);
  else console.log("Frontend dev server: http://localhost:5173 (run npm run dev in frontend/)");
});
