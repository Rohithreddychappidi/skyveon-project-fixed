# Skyveon Learning Hub — Frontend

Next.js 14 (App Router) + TypeScript + Tailwind CSS frontend for the
internal training platform. Talks to the Express API in `../skyveon-backend`.

## Run it

```bash
npm install
NEXT_PUBLIC_API_URL=http://localhost:4000 npm run dev
```

`NEXT_PUBLIC_API_URL` is the API's origin (production: `https://api.skyveon.com`).
It's also used at build time: the public home page is rendered on the server
from `/api/cms/home` + `/api/courses/public` and re-fetched at most once a
minute, and CMS/course images from that host go through Next's image
optimizer (`next.config.mjs`).

```bash
npm test        # vitest
npm run build
```

## What's here

- `/` — public home page (server-rendered; content edited in the admin CMS)
- `/login`, `/setup-password`, `/reset-password` — auth flows
- `/admin` — dashboard, employees, courses (+ lesson builder), assignments,
  progress, home-page CMS, admins (master admin only). Each page only calls
  endpoints the signed-in admin's permissions allow.
- `/employee` — my courses, lesson viewer (completion rules, assignment
  gating, video resume, moving viewer watermark, pdf.js document viewer
  that works on Android), profile

## Auth

The access token lives in memory only; it's restored on load from the
httpOnly refresh cookie set by the API. `lib/api.ts` shares a single
in-flight refresh between all requests, so several requests hitting an
expired token at once can't log the user out.

## Design system

- Colors, fonts (Space Grotesk / Inter / Space Mono), and the chevron motif
  all come from the Skyveon logo — see `tailwind.config.ts` and
  `app/globals.css`.
