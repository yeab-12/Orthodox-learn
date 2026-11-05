import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// UPLOADS_DIR is optional and only used by automated tests so they can write
// to a temporary folder instead of the real media library.
export const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(backendDir, "uploads");
export const videosDir = path.join(uploadsDir, "videos");
export const demoDir = path.join(uploadsDir, "demo");

fs.mkdirSync(videosDir, { recursive: true });
fs.mkdirSync(demoDir, { recursive: true });
