# Skyveon Learning Hub — API Server

Express + Prisma backend for the internal training platform. Auth (with a
master-admin/admin permission hierarchy), employee management, courses with
gated assignment lessons, progress tracking, content protection (signed
URLs, live + burned-in watermarking), background jobs, and audit logging.

## Stack

- **Node.js + Express + TypeScript**
- **Prisma ORM** against **PostgreSQL** — using **Neon** for now, same
  connection string shape for a self-hosted Postgres box later
- **JWT auth** (short-lived access token + rotating refresh token), with a
  **MASTER_ADMIN > ADMIN > EMPLOYEE** role hierarchy and granular
  per-admin permissions
- **Backblaze B2** for uploads (via its S3-compatible API) — local disk in
  dev, one env var flips it to B2
- **BullMQ + Redis** for email sending and file conversion — optional; runs
  those inline with no retries if `REDIS_URL` isn't set, so the app works
  with zero extra infra locally
- **Nodemailer over SMTP** — works unchanged with SES or SendGrid, since both
  expose an SMTP endpoint; logs to the console in local dev if no SMTP is
  configured
- **LibreOffice (headless)** for Office → PDF conversion
- **ffmpeg** for burning a real watermark into video frames (cached per
  viewer — see below)
- **pdf-lib / sharp** for on-the-fly PDF/image watermarking

## 1. Prerequisites

- Node.js 18+
- A [Neon](https://neon.tech) Postgres database (free tier is fine to start)
- LibreOffice, for converting `.ppt`/`.doc` uploads to PDF:
  ```bash
  sudo apt-get install libreoffice   # Ubuntu/Debian
  brew install --cask libreoffice    # macOS
  ```
- ffmpeg, for burning watermarks into video lessons:
  ```bash
  sudo apt-get install ffmpeg        # Ubuntu/Debian
  brew install ffmpeg                # macOS
  ```
  Neither is required to boot the app — PPT/DOC lessons sit at
  `conversionStatus: FAILED` without LibreOffice, and video just serves
  unwatermarked (logged clearly) without ffmpeg. Both are easy to add later.

## 2. Setup

```bash
cd skyveon-backend
npm install
cp .env.example .env
```

Fill in `.env`:
- `DATABASE_URL` — your Neon **direct** connection string (not the
  `-pooler` one — Prisma Migrate needs the direct one), `?sslmode=require`
  on the end
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` / `SIGNED_LINK_SECRET` — any
  long random strings (`openssl rand -hex 32` for each)
- Everything else (B2, Redis, SMTP) can stay blank for local dev — see
  sections 6–8 below for when/how to fill each in

Create the tables and seed demo data:

```bash
npx prisma migrate dev --name init
npm run seed
```

> **Upgrading from an earlier version of this backend?** This round added
> `MASTER_ADMIN`/`AdminPermission`, the `ASSIGNMENT` lesson type, and the
> `LessonSubmission` table. Run
> `npx prisma migrate dev --name master_admin_and_assignments` to pick up
> the schema changes — existing data is untouched, but note that anyone
> previously seeded as a plain `ADMIN` won't have any `adminPermissions`
> until you grant them (see section 4) or reseed.
>
> **Since then:** `LessonSubmission` also gained optional `fileKey`/
> `fileName`/`fileMime` columns (employees can now attach a file to an
> assignment submission, not just text) — run
> `npx prisma migrate dev --name submission_attachments` to pick that up too.

The seed script prints a **master admin**, **admin**, and **employee**
login when it finishes.

```bash
npm run dev
```

Listens on `http://localhost:4000` by default (`PORT` in `.env`).

## 3. Project layout

```
prisma/schema.prisma      data model
prisma/seed.ts             demo data
src/config/env.ts          validated environment config
src/lib/
  storage.ts               local disk / Backblaze B2 driver
  queue.ts                 BullMQ+Redis job runner (with inline fallback)
  notifications.ts         course-assigned / assignment-submitted emails
  watermark.ts              PDF/image live watermarking
  videoWatermark.ts          ffmpeg video watermark burn-in
  lessonGating.ts            "assignment lessons lock what comes after"
  fileConversion.ts          Office -> PDF via LibreOffice
  jwt.ts / signedLink.ts / password.ts / email.ts / activityLog.ts
src/middleware/            auth (+ role hierarchy + permissions), upload, errors
src/modules/
  auth/                    login, refresh, setup/reset/change password
  admins/                  master-admin-only: manage ADMIN accounts + permissions
  users/                   employee CRUD + departments (admin)
  courses/                 courses, lessons (incl. ASSIGNMENT type), uploads,
                            conversion, submission review
  assignments/              assign/unassign courses (individual + department)
  progress/                completion rules, admin progress table
  files/                   signed URLs + watermarked streaming
  activity/                audit log listing (admin)
  cms/                     home page content (public GET, admin PUT)
src/app.ts / src/server.ts entry points
uploads/                    local file storage (dev/staging)
```

## 4. Roles & permissions

Three roles, ranked **MASTER_ADMIN > ADMIN > EMPLOYEE** — a route guarded
for `ADMIN` also admits a `MASTER_ADMIN`.

- **MASTER_ADMIN** — everything an admin can do, plus manages other admin
  accounts and their permissions via `/api/admins`. There's no endpoint to
  create a second master admin on purpose; do that directly in the
  database if you ever need to.
- **ADMIN** — can do exactly what its `adminPermissions` list allows:
  `MANAGE_EMPLOYEES`, `MANAGE_COURSES`, `MANAGE_ASSIGNMENTS`,
  `VIEW_PROGRESS`, `MANAGE_CMS`. An admin with none of these can log in but
  can't do anything yet — the master admin grants access via
  `PATCH /api/admins/:id/permissions`.
- **EMPLOYEE** — unchanged from before.

## 5. Assignment lessons (gating)

A new lesson type, `ASSIGNMENT`, sits alongside video/PDF/PPT/DOC/image/link.
It has no uploaded file — just `assignmentPrompt` text shown to the
employee, who submits a free-text response
(`POST /api/progress/:lessonId/submit-assignment`).

**Submitting is what completes the lesson**, and it's also what unlocks
everything *after* it in the course: an employee can't `start` a later
lesson, or fetch a signed URL for one, until every earlier `ASSIGNMENT`
lesson in the course has a submission from them
(see `src/lib/lessonGating.ts`, shared by the progress and files modules).

Admin review (`GET /api/courses/lessons/:lessonId/submissions`,
`PATCH /api/courses/submissions/:submissionId/review`) is available for
approve/reject-with-note, but is **informational only** — it doesn't
re-lock anything. If you want rejection to actually revoke access, that's
a small follow-up change to `progress.service.ts`.

Submitting also emails the course's creator (and every master admin) so
review doesn't get missed — see `src/lib/notifications.ts`.

## 6. Content protection

- Uploading a lesson file (`POST /api/courses/lessons/:lessonId/upload`,
  multipart `file` field) stores it via the storage driver and, for
  PPT/DOC lessons, enqueues a LibreOffice conversion to PDF
  (`conversionStatus` moves `PENDING → DONE/FAILED`).
- **Replacing an already-uploaded file resets progress** for that lesson —
  every employee's status drops back to `NOT_STARTED` so they go through
  the new content, rather than staying marked complete against content
  that no longer exists.
- Employees never get a direct file path — only a **5-minute signed URL**
  (`GET /api/files/:lessonId/link` → `GET /api/files/:lessonId/stream`).
- **PDF/image**: watermarked **live, on every request** (viewer's name,
  email, ID) — nothing pre-baked.
- **Video**: watermarking is a real ffmpeg burn into the frames, not a
  client-side overlay — but re-encoding a multi-minute video on every
  single request would be far too slow, so the result is **cached per
  (lesson, viewer) pair** and served instantly after the first view. If
  ffmpeg isn't installed, this fails soft and serves the unwatermarked
  video instead (logged) rather than blocking playback.
- `Content-Disposition: inline` + `Cache-Control: no-store` deter casual
  downloads.
- The frontend adds a few more **deterrent-level** (explicitly not hard
  blocks) signals on top: right-click/selection disabled on lesson content,
  a blur overlay when the tab loses visibility, and a blur overlay when
  dev tools look open. None of these stop a phone camera or OS-level
  screen recording — that needs the native mobile app, which can use
  `FLAG_SECURE` (Android) / screen-recording detection (iOS) for a real
  hard block. See `components/employee/use-content-protection.ts` on the
  frontend for the honest tradeoffs of each signal.

## 7. Progress rules

| Lesson type | Rule |
|---|---|
| Video (first watch) | Complete at **~90% watched**; a heuristic caps how far one heartbeat can jump forward, so scrubbing to the end doesn't count |
| Video (rewatch) | Once completed once, the 90% floor and anti-skip clamp **stop applying** — free scrubbing, status never regresses |
| PDF / PPT / DOC / Image | Complete after opening **and** the "I've reviewed this" confirm endpoint |
| Link | Complete after opening, then confirming |
| Assignment | Complete on submission — and unlocks later lessons (section 5) |
| Course | Complete when every lesson in it is complete (derived, not stored) |

## 8. Soft delete

`isDeleted` on `User`, `Course`, `Lesson`, `Department`, and `Assignment`.
Nothing is ever hard-deleted — deactivating/removing something just hides
it from listings while keeping historical progress and audit records intact.

## 9. Migrating pieces later

- **Database:** change `DATABASE_URL` to your production Postgres.
- **Storage → Backblaze B2:** create a bucket + an Application Key scoped
  to it in the B2 dashboard, set `STORAGE_DRIVER=b2` and the `B2_*` vars in
  `.env` (see `.env.example` for exactly where to find each value). No
  other code changes — every call site goes through `getStorage()`.
- **Jobs → BullMQ/Redis:** set `REDIS_URL` (e.g. a free
  [Upstash](https://upstash.com) instance, or self-hosted). Email sending
  and file conversion automatically start going through a real queue with
  retries — no code changes, `src/lib/queue.ts` detects it at boot.
- **Email:** point `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` at SES's or
  SendGrid's SMTP credentials. No code changes.

## 10. API reference (quick index)

```
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
POST   /api/auth/forgot-password
POST   /api/auth/setup-password
POST   /api/auth/reset-password
POST   /api/auth/change-password        (auth — logged-in self-service)
GET    /api/auth/me

GET    /api/admins                      (master admin)
POST   /api/admins                      (master admin)
PATCH  /api/admins/:id/permissions      (master admin)
PATCH  /api/admins/:id/status           (master admin)
DELETE /api/admins/:id                  (master admin)

GET    /api/users                       (admin + MANAGE_EMPLOYEES)
POST   /api/users                       (admin + MANAGE_EMPLOYEES)
PATCH  /api/users/:id                   (admin + MANAGE_EMPLOYEES)
PATCH  /api/users/:id/status            (admin + MANAGE_EMPLOYEES)
DELETE /api/users/:id                   (admin + MANAGE_EMPLOYEES)
POST   /api/users/:id/resend-setup      (admin + MANAGE_EMPLOYEES)
GET    /api/departments
POST   /api/departments                 (admin + MANAGE_EMPLOYEES)

GET    /api/courses                     (admin + MANAGE_COURSES)
POST   /api/courses                     (admin + MANAGE_COURSES)
GET    /api/courses/:courseId           (admin + MANAGE_COURSES)
PATCH  /api/courses/:courseId           (admin + MANAGE_COURSES)
DELETE /api/courses/:courseId           (admin + MANAGE_COURSES)
POST   /api/courses/:courseId/lessons                 (admin + MANAGE_COURSES)
PATCH  /api/courses/:courseId/lessons/reorder          (admin + MANAGE_COURSES)
PATCH  /api/courses/lessons/:lessonId                  (admin + MANAGE_COURSES)
DELETE /api/courses/lessons/:lessonId                  (admin + MANAGE_COURSES)
POST   /api/courses/lessons/:lessonId/upload            (admin, multipart)
POST   /api/courses/lessons/:lessonId/retry-conversion  (admin + MANAGE_COURSES)
GET    /api/courses/lessons/:lessonId/submissions        (admin + MANAGE_COURSES)
PATCH  /api/courses/submissions/:submissionId/review     (admin + MANAGE_COURSES)
GET    /api/courses/mine                (employee)
GET    /api/courses/mine/:courseId      (employee)
GET    /api/courses/public              (public — marketing course cards)

GET    /api/assignments?courseId=       (admin + MANAGE_ASSIGNMENTS)
POST   /api/assignments                 (admin + MANAGE_ASSIGNMENTS)
DELETE /api/assignments/:id             (admin + MANAGE_ASSIGNMENTS)

POST   /api/progress/:lessonId/start
POST   /api/progress/:lessonId/heartbeat
POST   /api/progress/:lessonId/confirm
POST   /api/progress/:lessonId/submit-assignment
GET    /api/progress/:lessonId/mine
GET    /api/progress/course/:courseId/table            (admin + VIEW_PROGRESS)

GET    /api/files/:lessonId/link        (auth)
GET    /api/files/:lessonId/stream?token=...  (signed link, no session needed)
GET    /api/files/:lessonId/admin-download    (admin)
GET    /api/courses/submissions/:submissionId/file      (admin — download an employee's attached file)

GET    /api/activity                    (admin, audit log)

GET    /api/cms/home                    (public — home page content)
PUT    /api/cms/home                    (admin + MANAGE_CMS)
POST   /api/cms/upload-image            (admin + MANAGE_CMS — hero/about image upload)
GET    /api/cms/image/:key              (public — serves an uploaded CMS image)
```

## 11. Connecting the frontend

Set `CORS_ORIGINS` in `.env` to your frontend's origin(s)
(`http://localhost:3000` by default). The frontend stores the access token
in memory and calls `/api/auth/refresh` on load / on 401s via the refresh
cookie.
