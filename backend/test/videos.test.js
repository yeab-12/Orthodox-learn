import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tewahedo-test-"));
let child;
let base = "";
let adminToken = "";
let studentToken = "";

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

async function login(email, password) {
  const response = await fetch(`${base}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200, `login failed for ${email}`);
  return (await response.json()).token;
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function json(response) {
  return response.json();
}

async function uploadVideo(token, title, overrides = {}) {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(2048)], { type: "video/mp4" }), `${title.replace(/\s+/g, "-")}.mp4`);
  form.append("title", title);
  form.append("categoryId", overrides.categoryId ?? "prayer");
  form.append("language", overrides.language ?? "en");
  form.append("durationSec", String(overrides.durationSec ?? 30));
  form.append("description", "Regression test upload");
  form.append("courseId", overrides.courseId ?? "");
  const response = await fetch(`${base}/api/v1/uploads`, {
    method: "POST",
    headers: auth(token),
    body: form,
  });
  const text = await response.text();
  assert.equal(response.status, 201, text);
  return JSON.parse(text).video;
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

test("seed logins work for admin and student", async () => {
  const admin = await json(await fetch(`${base}/api/v1/auth/me`, { headers: auth(adminToken) }));
  assert.equal(admin.user.role, "admin");
  const student = await json(await fetch(`${base}/api/v1/auth/me`, { headers: auth(studentToken) }));
  assert.equal(student.user.role, "student");
});

test("public feed always includes status and only shows approved, non-archived lessons", async () => {
  const response = await fetch(`${base}/api/v1/videos`);
  assert.equal(response.status, 200);
  const { videos } = await json(response);
  assert.ok(videos.length >= 8, "seeded approved lessons should be public");
  for (const video of videos) {
    assert.equal(video.status, "approved");
    assert.equal(video.archived, false);
  }
});

test("pending uploads stay private and reject social interactions", async () => {
  const video = await uploadVideo(adminToken, "Pending regression lesson");
  assert.equal(video.status, "pending");
  assert.equal(video.archived, false);

  const publicFeed = await json(await fetch(`${base}/api/v1/videos`));
  assert.equal(publicFeed.videos.some((item) => item.id === video.id), false);

  const publicDetail = await fetch(`${base}/api/v1/videos/${video.id}`);
  assert.equal(publicDetail.status, 404);

  const ownerDetail = await fetch(`${base}/api/v1/videos/${video.id}`, { headers: auth(adminToken) });
  assert.equal(ownerDetail.status, 200);
  assert.equal((await json(ownerDetail)).video.status, "pending");

  const like = await fetch(`${base}/api/v1/videos/${video.id}/like`, { method: "POST", headers: auth(studentToken) });
  assert.equal(like.status, 404);
  const save = await fetch(`${base}/api/v1/videos/${video.id}/save`, { method: "POST", headers: auth(studentToken) });
  assert.equal(save.status, 404);
  const comments = await fetch(`${base}/api/v1/videos/${video.id}/comments`);
  assert.equal(comments.status, 404);
  const comment = await fetch(`${base}/api/v1/videos/${video.id}/comments`, {
    method: "POST",
    headers: { ...auth(studentToken), "content-type": "application/json" },
    body: JSON.stringify({ text: "Should not work" }),
  });
  assert.equal(comment.status, 404);
});

test("admin library paginates, searches and exposes file state", async () => {
  const response = await fetch(`${base}/api/v1/admin/videos?page=1&pageSize=1&q=regression`, { headers: auth(adminToken) });
  assert.equal(response.status, 200);
  const data = await json(response);
  assert.equal(data.videos.length, 1);
  assert.ok(data.total >= 1);
  assert.ok(data.totalPages >= 1);
  assert.ok(Array.isArray(data.facets.creators));
  assert.ok(data.videos.every((video) => typeof video.status === "string"));
  assert.ok(data.videos.every((video) => video.fileExists === true));
});

test("bulk approve publishes lessons and enables like, save and comments", async () => {
  const created = await uploadVideo(adminToken, "Bulk approve lesson");
  const response = await fetch(`${base}/api/v1/admin/videos/bulk`, {
    method: "PATCH",
    headers: { ...auth(adminToken), "content-type": "application/json" },
    body: JSON.stringify({ ids: [created.id], action: "approve" }),
  });
  assert.equal(response.status, 200);
  assert.equal((await json(response)).updated, 1);

  const feed = await json(await fetch(`${base}/api/v1/videos`));
  const published = feed.videos.find((item) => item.id === created.id);
  assert.ok(published, "approved lesson should appear in the public feed");
  assert.equal(published.status, "approved");

  const like = await fetch(`${base}/api/v1/videos/${created.id}/like`, { method: "POST", headers: auth(studentToken) });
  assert.equal(like.status, 200);
  const save = await fetch(`${base}/api/v1/videos/${created.id}/save`, { method: "POST", headers: auth(studentToken) });
  assert.equal(save.status, 200);
  const comment = await fetch(`${base}/api/v1/videos/${created.id}/comments`, {
    method: "POST",
    headers: { ...auth(studentToken), "content-type": "application/json" },
    body: JSON.stringify({ text: "A public comment" }),
  });
  assert.equal(comment.status, 201);
  const comments = await json(await fetch(`${base}/api/v1/videos/${created.id}/comments`));
  assert.equal(comments.comments.length, 1);
});

test("bulk archive hides a lesson without deleting it", async () => {
  const created = await uploadVideo(adminToken, "Bulk archive lesson");
  await fetch(`${base}/api/v1/admin/videos/bulk`, {
    method: "PATCH",
    headers: { ...auth(adminToken), "content-type": "application/json" },
    body: JSON.stringify({ ids: [created.id], action: "approve" }),
  });
  const archive = await fetch(`${base}/api/v1/admin/videos/bulk`, {
    method: "PATCH",
    headers: { ...auth(adminToken), "content-type": "application/json" },
    body: JSON.stringify({ ids: [created.id], action: "archive" }),
  });
  assert.equal(archive.status, 200);

  const feed = await json(await fetch(`${base}/api/v1/videos`));
  assert.equal(feed.videos.some((item) => item.id === created.id), false);
  const detail = await fetch(`${base}/api/v1/videos/${created.id}`);
  assert.equal(detail.status, 404);

  const archived = await json(await fetch(`${base}/api/v1/admin/videos?archived=true&q=Bulk%20archive`, { headers: auth(adminToken) }));
  assert.ok(archived.videos.some((item) => item.id === created.id && item.archived === true));
});

test("bulk reject records a reason and retry returns the lesson to review", async () => {
  const created = await uploadVideo(adminToken, "Reject and retry lesson");
  const reject = await fetch(`${base}/api/v1/admin/videos/bulk`, {
    method: "PATCH",
    headers: { ...auth(adminToken), "content-type": "application/json" },
    body: JSON.stringify({ ids: [created.id], action: "reject", reason: "Please add a clearer title." }),
  });
  assert.equal(reject.status, 200);

  const list = await json(await fetch(`${base}/api/v1/admin/videos?status=rejected&q=Reject%20and%20retry`, { headers: auth(adminToken) }));
  const rejected = list.videos.find((item) => item.id === created.id);
  assert.ok(rejected);
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.rejectionReason, "Please add a clearer title.");

  const retry = await fetch(`${base}/api/v1/admin/videos/${created.id}/retry`, { method: "POST", headers: auth(adminToken) });
  assert.equal(retry.status, 200);
  assert.equal((await json(retry)).video.status, "pending");

  const publicDetail = await fetch(`${base}/api/v1/videos/${created.id}`);
  assert.equal(publicDetail.status, 404);
});

test("uploaded media is written to disk and the configured limits are reported", async () => {
  const limits = await json(await fetch(`${base}/api/v1/uploads/limits`));
  assert.equal(limits.maxDurationSec, 300);
  assert.ok(limits.maxMb > 0);
  const files = fs.readdirSync(path.join(tempRoot, "uploads", "videos"));
  assert.ok(files.length >= 4, "each upload should create a separate file on disk");
});

test("metadata editing validates the category and updates public fields", async () => {
  const created = await uploadVideo(adminToken, "Metadata lesson");
  const bad = await fetch(`${base}/api/v1/admin/videos/${created.id}`, {
    method: "PATCH",
    headers: { ...auth(adminToken), "content-type": "application/json" },
    body: JSON.stringify({ categoryId: "not-a-category" }),
  });
  assert.equal(bad.status, 400);

  const good = await fetch(`${base}/api/v1/admin/videos/${created.id}`, {
    method: "PATCH",
    headers: { ...auth(adminToken), "content-type": "application/json" },
    body: JSON.stringify({ title: "Metadata lesson updated", categoryId: "bible", language: "am", cover: 2, status: "approved" }),
  });
  assert.equal(good.status, 200);
  const video = (await json(good)).video;
  assert.equal(video.title, "Metadata lesson updated");
  assert.equal(video.categoryId, "bible");
  assert.equal(video.language, "am");
  assert.equal(video.cover, 2);
  assert.equal(video.status, "approved");
});
