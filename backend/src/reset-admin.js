import "dotenv/config";
import { readDbFile, save, setDb } from "./store.js";
import { hashPassword } from "./auth.js";

const email = (process.env.ADMIN_EMAIL || "admin@tewahedo.app").toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!password || password.length < 8) {
  console.error("Set ADMIN_PASSWORD (at least 8 characters) in backend/.env first.");
  process.exit(1);
}

const data = readDbFile();
setDb(data);
let admin = data.users.find((u) => u.role === "admin" && u.email === email);
if (!admin) {
  admin = data.users.find((u) => u.role === "admin");
}
if (!admin) {
  console.error("No admin account exists. Delete backend/data/db.json and restart the API to reseed.");
  process.exit(1);
}
admin.email = email;
admin.passwordHash = await hashPassword(password);
admin.active = true;
admin.role = "admin";
save();
console.log(`Admin password reset for ${email}.`);
