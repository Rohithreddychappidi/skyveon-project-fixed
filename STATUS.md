# Skyveon Learning Hub — Project Status

```
skyveon-frontend/   Next.js 14 UI
skyveon-backend/    Express + Prisma API server
```

## Latest round: 2 real fixes + 1 honest answer

1. **Fixed — videos never marking complete.** Root cause: nothing in the
   admin UI ever set a video lesson's `durationSeconds`, and the 90%-watched
   rule divides by that number — with it null, the check could never pass,
   no matter how much got watched. Now: uploading a video auto-detects its
   duration via `ffprobe` (ships with ffmpeg, already a dependency) and
   saves it. If ffprobe isn't installed, or for any existing video lessons
   from before this fix, there's now a click-to-edit duration badge next to
   each video lesson in the admin course builder — **existing video lessons
   need their duration set once**, either by re-uploading the file or
   entering it manually there.
2. **Fixed — PDF viewer.** Bigger (`min(82vh, 900px)` instead of a fixed
   520px box), and the native browser PDF toolbar (which has the
   download/print buttons) is now suppressed via the `#toolbar=0` URL
   fragment Chrome/Firefox's built-in viewers respect.
3. **Screen recording — no code change, because there's no code fix.**
   Asked directly: is there a way to actually complete/block this. Answer,
   same as earlier in this build: no web technology can hard-block OS-level
   screen recording — no browser exposes that permission to any website,
   period. What *can* actually block it is either (a) real DRM (Widevine/
   FairPlay/PlayReady) — a paid third-party service + license server
   integration, weeks of work, and honestly disproportionate for internal
   training content — or (b) the native mobile app, where `FLAG_SECURE`
   (Android) gives a genuine OS-level block. Neither was built this round;
   said so plainly rather than shipping something that looks like a fix but
   isn't one.

See below for the fuller picture of everything built so far.

---

Frontend and backend are connected (real auth, real data, real files). This
round adds: a master admin who controls other admins' permissions, a new
"assignment" lesson type that gates the rest of a course until submitted,
a changed video-rewatch rule, Backblaze B2 storage, BullMQ/Redis job
queuing, course-assigned/assignment-submitted emails, and a layer of
deterrent-level content-protection on the lesson viewer.

---

## 1. What's new in this round

### Master admin + permissions
- Roles are now **MASTER_ADMIN > ADMIN > EMPLOYEE**, ranked — a route
  guarded for "admin" also admits the master admin.
- The master admin manages other admin accounts at `/admin/admins`
  (frontend) / `/api/admins` (backend): create an admin, grant/revoke five
  permissions (`MANAGE_EMPLOYEES`, `MANAGE_COURSES`, `MANAGE_ASSIGNMENTS`,
  `VIEW_PROGRESS`, `MANAGE_CMS`), deactivate.
- A regular admin's sidebar only shows the sections they actually have
  permission for. An admin with zero permissions can log in but can't do
  anything yet — that's intentional, it's the master admin's job to grant
  access.
- Seeded logins: `master@skyveon.ai` (master admin), `admin@skyveon.ai`
  (regular admin, seeded with every permission so it behaves like before).

### Assignment lessons (the gating feature)
- New lesson type: **Assignment**. Instead of a file, it has a text prompt.
  The employee submits a free-text response, which is what completes the
  lesson.
- **Submitting is what unlocks everything after it in the course** —
  employees can't open a later lesson (or even fetch its file) until every
  earlier assignment lesson has a submission from them. Locked lessons show
  a lock icon in the sidebar and can't be clicked.
- Admins can review submissions (approve/reject + note) from the course
  detail page, next to each assignment lesson — this is informational, it
  doesn't re-lock anything if rejected (flagged in the backend README as
  an easy follow-up if you want that).
- Submitting emails the course's creator and every master admin so review
  doesn't get missed.

### Video rule change
- **First watch**: unchanged — 90% watched to complete, can't skip ahead
  past what's been watched.
- **Rewatch** (after it's been completed once): the 90% floor and the
  anti-skip clamp both stop applying — free scrubbing, and it can't ever
  un-complete.

### Backblaze B2
- `src/lib/storage.ts`'s driver is now real, not a stub — B2's S3-compatible
  API via `@aws-sdk/client-s3`. Set `STORAGE_DRIVER=b2` and the `B2_*` vars
  in the backend's `.env` when you're ready; local disk stays the default
  until then. See the backend README section 9 for exactly which values
  come from where in the B2 dashboard.

### BullMQ + Redis (optional)
- Email sending and file conversion now go through a real job queue if
  `REDIS_URL` is set (retries with backoff, won't block the request thread).
  If it's **not** set — the default — they just run inline immediately,
  same as before. Nothing to install to keep using the app as-is; add Redis
  (e.g. a free [Upstash](https://upstash.com) instance) whenever you want
  the retry behavior for real.

### Content protection — deterrent layer
Added to the lesson viewer, on top of what already existed (signed URLs,
live PDF/image watermarking):
- **Video watermarking is now burned into the frames via ffmpeg**, not a
  client-side CSS overlay — real protection, cached per (lesson, viewer)
  pair since re-encoding on every view would be far too slow.
- Right-click and text selection disabled on lesson content.
- Content blurs when the browser tab loses visibility (tab-switch/minimize).
- Content blurs when dev tools look open (a known-imperfect heuristic).

**Every one of these except the video watermark burn-in is explicitly a
deterrent, not a hard block** — a phone camera or OS-level screen recording
defeats all of them, and that was true before this round too. A real hard
block only exists at the OS level, which means the native mobile app
(`FLAG_SECURE` on Android, screen-recording detection on iOS) — still not
built, still the honest answer if that's ever a hard requirement rather
than a deterrent.

---

## 2. How to test the new pieces

```bash
cd skyveon-backend
npm install
npx prisma migrate dev --name master_admin_and_assignments
npm run seed
npm run dev
```

```bash
cd skyveon-frontend
npm install
npm run dev
```

1. **Master admin**: sign in as `master@skyveon.ai`. You should see an
   "Admins" link in the sidebar the regular admin doesn't have. Create a
   new admin with just `MANAGE_COURSES` checked — sign in as them (after
   setting their password via the terminal-logged setup link) and confirm
   their sidebar only shows Dashboard + Courses.
2. **Assignment gating**: sign in as `employee@skyveon.ai` — the seeded
   demo course has an assignment lesson with a locked "Team wiki" lesson
   after it. Confirm the wiki lesson has a lock icon and can't be clicked.
   Submit the assignment, then confirm it unlocks.
3. **Submission review**: sign in as an admin with `MANAGE_COURSES`, open
   that course, click "Submissions" next to the assignment lesson, approve
   or reject the employee's response.
4. **Video rewatch**: complete a video lesson (past 90%), then scrub
   backward and forward freely — it should no longer clamp your position
   or drop back to "in progress".
5. **Content protection**: open any lesson, switch to another browser tab
   — content should blur with a "tab inactive" message, and un-blur when
   you switch back. Try right-clicking lesson content — no context menu.
6. **B2 / Redis**: both optional, both untestable without real credentials
   — leave `STORAGE_DRIVER=local` and `REDIS_URL` blank to keep using the
   app exactly as before. Backend README section 9 has the exact steps for
   when you're ready to switch either on.

---

## 3. Still pending

1. **Deployment** — neither app is on a server yet.
2. **Production secrets** — dev values still in `.env`.
3. **Real email sending** — SES/SendGrid SMTP credentials, whenever you're
   ready (domain verification is the only externally-timed piece here).
4. **B2 and Redis** — implemented, not yet configured with real credentials.
5. **Native mobile app** — the only way to get a real (not deterrent-level)
   screenshot/recording block. Separate project.
6. Small, honest gap: rejecting an assignment submission doesn't currently
   re-lock later lessons — flagged in the backend README if you want that
   tightened up.
