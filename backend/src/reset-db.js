import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbFile = path.join(backendDir, "data", "db.json");

if (fs.existsSync(dbFile)) {
  fs.renameSync(dbFile, `${dbFile}.backup-${Date.now()}`);
  console.log("Database reset. A backup of the old file was kept in backend/data/.");
  console.log("Restart the API to create a fresh database and admin account.");
} else {
  console.log("No database file found. Start the API to create one.");
}
