import { Router } from "express";
import { z } from "zod";
import { db, save, newId } from "../store.js";
import { ApiError, asyncHandler, findUser, notify, userOut } from "../lib.js";
import { authRequired, checkPassword, hashPassword, loginResponse } from "../auth.js";

export const authRouter = Router();

const email = z.string().trim().toLowerCase().email("Enter a valid email address.");
const password = z.string().min(8, "Use at least 8 characters.").max(200);
const name = z.string().trim().min(2, "Enter your name.").max(80);

const registerSchema = z.object({ name, email, password });
const loginSchema = z.object({ email, password });

authRouter.post("/register", asyncHandler(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message, parsed.error.flatten().fieldErrors);
  const { name: fullName, email: mail, password: pass } = parsed.data;
  const all = db();
  if (all.users.some((u) => u.email === mail)) throw new ApiError(409, "An account with this email already exists.");

  const user = {
    id: newId("u"),
    name: fullName,
    email: mail,
    passwordHash: await hashPassword(pass),
    role: "student",
    active: true,
    bio: "",
    language: req.body.language === "am" ? "am" : "en",
    createdAt: new Date().toISOString(),
  };
  all.users.push(user);
  notify(
    user.id,
    "Welcome to Tewahedo Learn. Browse the feed, save lessons and follow a course.",
    "ወደ ተዋሕዶ ትምህርት እንኳን በደህና መጡ። ትምህርቶችን ይመልከቱ፣ ያስቀምጡ እና ኮርስ ይከተሉ።",
    "/app/explore",
  );
  save();
  res.status(201).json(loginResponse(user));
}));

authRouter.post("/login", asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, "Enter a valid email and password.", parsed.error.flatten().fieldErrors);
  const user = db().users.find((u) => u.email === parsed.data.email);
  if (!user || !(await checkPassword(parsed.data.password, user.passwordHash))) {
    throw new ApiError(401, "Email or password is not correct.");
  }
  if (!user.active) throw new ApiError(403, "This account has been disabled. Contact the administrator.");
  res.json(loginResponse(user));
}));

authRouter.get("/me", authRequired, (req, res) => {
  res.json({ user: userOut(req.user) });
});

authRouter.patch("/me", authRequired, asyncHandler(async (req, res) => {
  const schema = z.object({
    name: name.optional(),
    bio: z.string().max(500).optional(),
    language: z.enum(["en", "am"]).optional(),
    currentPassword: z.string().optional(),
    newPassword: password.optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0].message);
  const user = findUser(req.user.id);
  if (parsed.data.newPassword) {
    if (!parsed.data.currentPassword) throw new ApiError(400, "Enter your current password.");
    if (!(await checkPassword(parsed.data.currentPassword, user.passwordHash))) {
      throw new ApiError(400, "Current password is not correct.");
    }
    if (parsed.data.currentPassword === parsed.data.newPassword) {
      throw new ApiError(400, "Choose a new password that is different from the old one.");
    }
    user.passwordHash = await hashPassword(parsed.data.newPassword);
  }
  if (parsed.data.name !== undefined) user.name = parsed.data.name;
  if (parsed.data.bio !== undefined) user.bio = parsed.data.bio;
  if (parsed.data.language !== undefined) user.language = parsed.data.language;
  save();
  res.json({ user: userOut(user) });
}));

authRouter.get("/me/summary", authRequired, (req, res) => {
  const all = db();
  const myVideos = all.videos.filter((v) => v.uploadedBy === req.user.id);
  const enrollments = all.enrollments.filter((e) => e.userId === req.user.id);
  res.json({
    saved: all.saves.filter((s) => s.userId === req.user.id).length,
    completed: enrollments.reduce((n, e) => n + e.completedVideoIds.length, 0),
    uploads: myVideos.length,
    pendingUploads: myVideos.filter((v) => v.status === "pending").length,
    courses: enrollments.length,
    notifications: all.notifications.filter((n) => n.userId === req.user.id && !n.read).length,
  });
});
