# Tewahedo Learn

An Orthodox Christian short-video learning platform. Members watch reviewed lessons, follow teachers, join courses, track progress, comment, and upload their own video or audio lessons for moderation. Admins review every upload before it becomes public.

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, Axios, React Hook Form, Zod, Lucide
- **Backend:** Node.js, Express, JWT authentication, bcryptjs, multer uploads, JSON-file persistence
- **Media:** Real video and audio files with HTTP range support, so seeking and audio playback work

---

## 1. Requirements

- Node.js 18 or newer (Node.js 20 LTS recommended)
- npm 9 or newer

> **PowerShell note (Windows):** if `npm` is blocked with an execution-policy error, run every npm command through `cmd /c` exactly as shown below.

---

## 2. First-time setup

Open PowerShell in the project folder:

```powershell
cd "C:\Users\YAB\Downloads\Orthodox-app"
cmd /c "npm run install:all"
```

If you prefer to install each folder yourself:

```powershell
cd "C:\Users\YAB\Downloads\Orthodox-app\backend"
cmd /c "npm install"

cd "C:\Users\YAB\Downloads\Orthodox-app\frontend"
cmd /c "npm install"
```

### Environment file

`backend/.env` is already included for local development. To recreate it, copy `backend/.env.example` to `backend/.env` and edit the values:

```ini
PORT=4000
JWT_SECRET=change-this-to-a-long-random-string
ADMIN_EMAIL=admin@tewahedo.app
ADMIN_PASSWORD=Tewahedo2026!
DEMO_STUDENT_EMAIL=student@tewahedo.app
DEMO_STUDENT_PASSWORD=Student2026!
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
MAX_UPLOAD_MB=200
```

**Before publishing the app online, change `JWT_SECRET`, `ADMIN_PASSWORD` and the demo student password.** The admin password is read from `backend/.env` only when the database is first created (or when you run `npm run admin:reset`).

---

## 3. Run the app

From the project root:

```powershell
cd "C:\Users\YAB\Downloads\Orthodox-app"
cmd /c "npm run dev"
```

This starts both processes:

- API + media server: `http://localhost:4000`
- Web app (Vite): `http://localhost:5173`

Open **http://localhost:5173**.

### Run the servers separately

```powershell
# Terminal 1 — API on port 4000
cd "C:\Users\YAB\Downloads\Orthodox-app\backend"
cmd /c "npm run dev"

# Terminal 2 — web app on port 5173
cd "C:\Users\YAB\Downloads\Orthodox-app\frontend"
cmd /c "npm run dev"
```

---

## 4. Login details

| Role | Email | Password |
| --- | --- | --- |
| **Admin** | `admin@tewahedo.app` | `Tewahedo2026!` |
| Demo student | `student@tewahedo.app` | `Student2026!` |

- The login page also has **Fill admin details** and **Fill student details** buttons.
- New accounts can be created from **Create account**. New members start as students.
- When an admin approves a member's first upload, that member is promoted to **teacher**.
- Demo teacher accounts (`teacher.a@…` to `teacher.d@…`) exist only to own the sample lessons and are not meant for UI login.

---

## 5. Admin workflow

1. Sign in with the admin account and open **Admin dashboard** (`/app/admin`).
2. **Waiting for review** lists pending uploads. Use **Preview** to watch or listen before deciding.
3. **Approve** publishes the lesson and notifies the uploader.
4. **Reject** opens a reviewer-note dialog. The reason is shown to the uploader in **My uploads** and in their notifications.
5. **Admin → Lessons** (`/app/admin/videos`) is the full **video library** (see below).
6. **Admin → Users** (`/app/admin/users`) lets you search members, change roles (student / teacher / admin), disable or re-enable accounts.
7. **Admin → Courses** (`/app/admin/courses`) creates, edits and deletes courses. Lessons can then be assigned to a course from the library, in bulk or one at a time.
8. Contact-form messages appear on the dashboard with a **Mark read** action.

### Video library (`/app/admin/videos`)

The library is built for large collections (hundreds of lessons) and never loads everything at once.

- **Table or grid view** — switch with the **Table** / **Grid** buttons.
- **Search** by title, Amharic title or original file name (debounced, server-side).
- **Filters** — status (pending / approved / rejected), archive (active / archived / all), category, language, creator, course.
- **Sort** by newest, oldest, title, duration or size.
- **Pagination** — choose 25, 50, 100 or 200 rows per page; the server returns one page at a time.
- **Facets and counters** — totals for all, pending, approved, rejected, archived and failed uploads.
- **Multi-select and bulk actions** — approve, reject (with a reason), archive, restore, assign to a course, or delete selected lessons.
- **Edit details** — title, Amharic title, category, language, course, duration, status, source/attribution, archived flag and descriptions.
- **Row actions** — preview, edit, retry failed processing, archive / restore, delete.
- **Status indicators** — pending / approved / rejected pills, an **Archived** badge, and a **missing file** warning when a database entry has no media on disk.
- **Refresh** — re-fetch the current page and filters.

Archiving is **not** deletion. An archived lesson is hidden from the public feed and courses but keeps its file and metadata, so **Restore** brings it back.

---

## 6. Uploading real video and audio

### Bulk upload (multiple files)

1. Sign in and open **Upload** (`/app/upload`).
2. Drag and drop several files onto the drop zone, or click **Add video files** and select many at once.
3. Set the **batch details** once — category, language, course and uploads-at-once — then click **Apply details to waiting files** if you want to reuse them.
4. Each file is checked in the browser: extension, size (up to **200 MB**) and real duration (up to **5 minutes**). Invalid files are marked with a reason and are not retried.
5. Click **Start upload**. The queue uploads 1–4 files at a time (configurable with **Uploads at once**) and shows per-file progress plus an overall progress bar.
6. Use **Details** on any queued file to edit its title, Amharic title, description, category, language, course and thumbnail colour before it starts.
7. **Cancel** stops one file; **Cancel all** stops the batch. **Try again** retries a canceled or failed upload. **Retry failed** retries every retryable file. **Clear finished** removes completed rows.
8. Successful files show **Uploaded** with a **Preview** link. They appear as **pending** in **My uploads** until an admin approves them.

Accepted formats: `.mp4`, `.webm`, `.mov`, `.m4v`, `.mkv`, `.ogv`, `.ogg`, `.mp3`, `.m4a`, `.wav`, `.aac`. MP4, WebM, MOV, MP3 and M4A play in the browser; other accepted formats are stored and can be processed later.

### Single upload

The same page handles a single file: drop one file, fill in the details, and start. The behaviour is identical to a one-item batch.

### How storage works

- Files stream straight to disk with multer `diskStorage`; the API never buffers a whole video in memory.
- Files are stored in `backend/uploads/videos/` with generated names, and the original file name, size and MIME type are recorded.
- Uploaded files are served from `/uploads/...` with HTTP range support, so seeking and audio playback work.
- Each upload records a batch id, `mediaState` (`ready` / `failed`) and the validation result so the library can show and retry failed items.

### Demo content

The first run seeds 8 sample lessons and 4 courses. Every seeded lesson is marked **Demo clip** in the UI and uses:

```
backend/uploads/demo/sample.mp4
```

Replace the demo file with your own sample if you like, or upload real lessons and approve them. Demo lessons are clearly labelled so they are never mistaken for real teaching content.

### How many videos can it handle?

Hundreds of lessons are supported by the current design:

- Uploads are one file per request from a client-side queue, so a large batch never becomes one huge request.
- Files stream to disk, so server memory stays flat regardless of video size.
- The admin library searches, filters, sorts and paginates on the server, so the browser only receives one page (25–200 rows) at a time.
- Bulk approve / archive / assign handles many selected ids in one call.

Practical limits to keep in mind:

- **Per file:** 200 MB and 5 minutes (configurable through `MAX_UPLOAD_MB` and the upload limits in `backend/src/routes/uploads.js`).
- **Concurrency:** 4 files at once in the browser. Hundreds of videos are best uploaded in batches of 10–30.
- **Storage:** plan for disk space. A 200 MB cap means 100 lessons can use up to ~20 GB.
- **Database:** the JSON store rewrites `backend/data/db.json` on each change. It comfortably handles hundreds to a few thousand records, but for very large public sites move to a real database (for example PostgreSQL) and object storage.

---

## 7. Production build

```powershell
cd "C:\Users\YAB\Downloads\Orthodox-app"
cmd /c "npm run build"
cmd /c "npm start"
```

`npm run build` type-checks the frontend and creates `frontend/dist`. `npm start` starts the API, which also serves the built web app at **http://localhost:4000**.

For deployment, set `CORS_ORIGIN` to your real domain, use a strong `JWT_SECRET`, change the admin password, and persist `backend/data/` and `backend/uploads/`.

---

## 8. Useful commands

| Command | What it does |
| --- | --- |
| `cmd /c "npm run dev"` | Run API and web app together |
| `cmd /c "npm run build"` | Type-check and build the frontend |
| `cmd /c "npm start"` | Serve the built app + API on port 4000 |
| `cmd /c "npm test"` | Run backend regression tests (uses a temporary database and upload folder) |
| `cmd /c "npm run db:reset"` | Rename the current database to a timestamped backup; restart the API to reseed demo data |
| `cmd /c "npm run admin:reset"` | Reset the admin password to `ADMIN_PASSWORD` from `backend/.env` |

`npm test` never touches the real database or uploads. It starts a separate API process against temporary folders and exits when the checks finish.

> **Do not run `db:reset`, delete `backend/data/db.json`, or empty `backend/uploads/videos/` on a live site.** Those actions remove real lessons and accounts. Archive lessons in the library instead of deleting them. To back up, copy `backend/data/` and `backend/uploads/`.

---

## 9. Project structure

```
Orthodox-app/
├─ package.json              # root scripts (dev / build / test / start / reset)
├─ backend/
│  ├─ src/
│  │  ├─ index.js            # Express app, static media, SPA fallback
│  │  ├─ seed.js             # demo lessons, courses, teachers, progress
│  │  ├─ auth.js             # JWT + bcrypt helpers
│  │  ├─ lib.js              # serializers, video visibility rules, notifications
│  │  ├─ paths.js            # data / upload paths (supports test overrides)
│  │  ├─ store.js            # JSON database read/write
│  │  └─ routes/             # auth, videos, courses, teachers, uploads, admin, misc
│  ├─ test/videos.test.js    # regression + integration tests (temp data)
│  ├─ data/db.json           # created automatically (gitignored)
│  └─ uploads/
│     ├─ demo/sample.mp4     # seeded demo clip
│     └─ videos/             # real uploads (gitignored)
└─ frontend/
   ├─ src/pages/             # public pages + app pages + admin pages
   ├─ src/components/        # layout, player, cards, UI primitives
   ├─ src/api/client.ts      # Axios instance and error helper
   ├─ src/auth/              # auth context, protected/admin routes
   └─ src/i18n/              # English / Amharic dictionary
```

---

## 10. Main pages

Public: home, about, contact, privacy, terms, login, register, 404.

Signed-in app: feed, explore, courses, course detail, lesson player, teachers, teacher detail, upload, my uploads, saved lessons, community, notifications, profile, settings.

Admin: dashboard, video library, users, courses.

All pages were checked in a real browser with the API running, including real MP4 upload with audio, audio-only WAV upload, bulk upload of multiple files, per-file and overall progress, cancel and retry, approval, rejection with a reviewer note, notifications, playback with audio, comments, likes, saves, follows, course progress, contact messages, role changes and account disable/enable.

The admin library was checked with search, filters, sorting, pagination, table/grid views, multi-select, bulk approve, bulk course assignment, metadata editing, archive/restore, retry and delete. The regression suite (`cmd /c "npm test"`) covers public video status, pending privacy, social-interaction guards, library pagination/filtering, bulk approve/archive/reject, upload limits, disk storage and metadata editing.
