import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.DATA_DIR || path.join(backendDir, "data");
const dbFile = path.join(dataDir, "db.json");

fs.mkdirSync(dataDir, { recursive: true });

let state = null;

export function db() {
  if (!state) throw new Error("Database has not been loaded");
  return state;
}

export function setDb(next) {
  state = next;
}

export function save() {
  const tmp = `${dbFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, dbFile);
}

export function dbExists() {
  return fs.existsSync(dbFile);
}

export function readDbFile() {
  return JSON.parse(fs.readFileSync(dbFile, "utf8"));
}

export function newId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

export function dataPath(...parts) {
  return path.join(dataDir, ...parts);
}
