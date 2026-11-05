import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { ApiError, findUser, userOut } from "./lib.js";

const secret = process.env.JWT_SECRET;
if (!secret) throw new Error("JWT_SECRET is missing. Copy backend/.env.example to backend/.env.");

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, secret, { expiresIn: "7d" });
}

export function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export function checkPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function readToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(header.slice(7), secret);
  } catch {
    return null;
  }
}

export function optionalAuth(req, _res, next) {
  const payload = readToken(req);
  if (payload?.sub) {
    const user = findUser(payload.sub);
    if (user?.active) req.user = user;
  }
  next();
}

export function authRequired(req, _res, next) {
  if (!req.user) return next(new ApiError(401, "Please log in to continue."));
  next();
}

export function adminOnly(req, _res, next) {
  if (!req.user) return next(new ApiError(401, "Please log in to continue."));
  if (req.user.role !== "admin") return next(new ApiError(403, "Administrator access is required."));
  next();
}

export function loginResponse(user) {
  return { token: signToken(user), user: userOut(user) };
}
