import path from "node:path";
import fs from "node:fs";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { db, save, newId } from "../store.js";
import { ApiError, videoOut } from "../lib.js";
import { authRequired } from "../auth.js";
import { videosDir, uploadsDir } from "../paths.js";

export const uploadsRouter = Router();

const maxMb = Number(process.env.MAX_UPLOAD_MB) || 200;
const MAX_SECONDS = 300;
const ALLOWED_EXTENSIONS = [
  ".mp4", ".webm", ".mov", ".m4v", ".mkv", ".ogv", ".ogg",
  ".mp3", ".m4a", ".wav", ".aac",
];
const allowedExt = new Set(ALLOWED_EXTENSIONS);

uploadsRouter.get("/limits", (_req, res) => {
  res.json({
    maxMb,
    maxDurationSec: MAX_SECONDS,
    extensions: ALLOWED_EXTENSIONS,
    accept: "video/*,audio/*,.mkv,.m4v,.ogv,.ogg,.wav,.aac",
  });
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, videosDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = allowedExt.has(ext) ? ext : ".mp4";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExt.has(ext)) return cb(null, true);
    const isMediaMime = file.mimetype.startsWith("video/") || file.mimetype.startsWith("audio/");
    if (isMediaMime && !ext) return cb(null, true);
    cb(new Error(`Choose a supported video or audio file (${ALLOWED_EXTENSIONS.join(", ")}).`));
  },
});

const metaSchema = z.object({
  title: z.string().trim().max(160, "Keep the title under 160 characters.").optional().default(""),
  titleAm: z.string().trim().max(160).optional().default(""),
  description: z.string().trim().max(2000, "Keep the description under 2000 characters.").optional().default(""),
  descriptionAm: z.string().trim().max(2000).optional().default(""),
  categoryId: z.string().min(1, "Choose a category."),
  language: z.enum(["en", "am"]).optional().default("en"),
  durationSec: z.coerce.number().positive("The video duration could not be read.").max(MAX_SECONDS, "Lessons must be 5 minutes or shorter."),
  courseId: z.string().optional().default(""),
  attribution: z.string().trim().max(300).optional().default(""),
  cover: z.coerce.number().int().min(0).max(3).optional().default(0),
  batchId: z.string().trim().max(80).optional().default(""),
});

function removeFile(file) {
  if (!file?.path) return;
  try {
    if (path.resolve(file.path).startsWith(path.resolve(uploadsDir))) fs.unlinkSync(file.path);
  } catch {
    /* best effort */
  }
}

function titleFromFilename(name) {
  return path
    .parse(name || "lesson")
    .name
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

uploadsRouter.post("/", authRequired, (req, res, next) => {
  upload.single("file")(req, res, (error) => {
    if (error) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return next(new ApiError(413, `The file is too large. The limit is ${maxMb} MB.`));
      }
      return next(new ApiError(400, error.message || "The upload failed."));
    }
    try {
      if (!req.file) throw new ApiError(400, "Choose a video or audio file.");
      const parsed = metaSchema.safeParse(req.body);
      if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message, parsed.error.flatten().fieldErrors);
      const data = parsed.data;
      const title = data.title || titleFromFilename(req.file.originalname);
      if (title.length < 3) throw new ApiError(400, "Enter a title of at least 3 characters.");
      const all = db();
      if (!all.categories.some((c) => c.id === data.categoryId)) throw new ApiError(400, "Choose a valid category.");
      const course = data.courseId ? all.courses.find((c) => c.id === data.courseId) : null;
      if (data.courseId && !course) throw new ApiError(400, "Choose a valid course.");

      const now = new Date().toISOString();
      const video = {
        id: newId("v"),
        title,
        titleAm: data.titleAm || title,
        teacherId: req.user.id,
        uploadedBy: req.user.id,
        categoryId: data.categoryId,
        language: data.language,
        durationSec: Math.round(data.durationSec),
        cover: data.cover,
        description: data.description,
        descriptionAm: data.descriptionAm,
        attribution: data.attribution,
        status: "pending",
        archived: false,
        videoUrl: `/uploads/videos/${req.file.filename}`,
        storedName: req.file.filename,
        originalName: path.basename(req.file.originalname || req.file.filename).slice(0, 255),
        fileSize: req.file.size ?? null,
        mimeType: req.file.mimetype ?? "",
        mediaType: req.file.mimetype.startsWith("audio/") ? "audio" : "video",
        mediaState: "ready",
        retryCount: 0,
        demo: false,
        views: 0,
        batchId: data.batchId || "",
        requestedCourseId: course?.id ?? "",
        createdAt: now,
        uploadedAt: now,
      };
      all.videos.push(video);
      all.notifications.unshift({
        id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        userId: req.user.id,
        text: `Your lesson "${video.title}" was uploaded and is waiting for review.`,
        textAm: `ትምህርትዎ "${video.titleAm}" ተሰቅሏል፤ ግምት በመጠባበቅ ላይ ነው።`,
        href: "/app/my-uploads",
        read: false,
        createdAt: now,
      });
      save();
      res.status(201).json({ video: videoOut(video, req.user.id, { includeStatus: true }) });
    } catch (err) {
      removeFile(req.file);
      next(err);
    }
  });
});
