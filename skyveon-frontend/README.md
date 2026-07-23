# Skyveon Learning Hub — Frontend

Next.js 14 (App Router) + TypeScript + Tailwind CSS frontend for the internal
training platform, built against a mock data layer so it runs fully standalone
until the Express API is ready.

## Run it

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`. From the login screen, use **Sign in as Admin**
or **Sign in as Employee** — there's no real auth yet, these are demo shortcuts
that route straight into each portal (see the note on that screen).

## What's here

- `/` — Login
- `/setup-password`, `/reset-password` — Auth flows from the brief
- `/admin` — Dashboard, Employees, Courses (+ lesson builder), Assignments, Progress
- `/employee` — My Courses, Lesson Viewer (with completion rules + watermark/no-download UI), Profile

## Design system

- Colors, fonts (Space Grotesk / Inter / Space Mono), and the chevron motif
  all come from the Skyveon logo — see `tailwind.config.ts` and
  `app/globals.css`.
- `public/skyveon-icon.png` and `public/skyveon-wordmark.png` are cropped
  directly from your logo file, so they're pixel-accurate.

## Mock data → real API

Everything reads from `lib/mock-data.ts`. When the Express backend is ready,
that's the file to swap out — the shapes in `lib/types.ts` already match the
brief's data model (Users, Courses, Lessons, Assignments, Progress), so it
should map cleanly onto real API responses with `fetch`/`TanStack Query`.

## Not yet wired up (by design, since there's no backend yet)

- Real authentication / JWT / role routing
- File upload to storage (presigned URLs)
- PPT/Word → PDF conversion
- Real signed-URL content delivery (the lesson viewer simulates the
  completion rules and shows a watermark + "downloads disabled" badge, but
  isn't serving protected files yet)
- Email sending (setup links, password reset, notifications)

## Next steps

Once the Express API + PostgreSQL + R2 pieces from the architecture diagram
are up, this frontend is the shell to wire real requests into — page by page,
starting with Auth, then Employees, then Courses/Assignments/Progress.
