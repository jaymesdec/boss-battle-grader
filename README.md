# Boss Battle Grader

Boss Battle Grader is a Next.js app for grading Canvas submissions with a gamified workflow.

## Franklin-only Canvas OAuth

This app is configured to support **Canvas OAuth Authorization Code login** and enforce Franklin-only access:

- Allowed Canvas domain: `franklinjc.instructure.com`
- Login provider: Canvas OAuth (`/login`)
- Access policy: user must have **teacher/instructor/TA-level** enrollments
- Protected routes enforced by NextAuth middleware

A protected sanity-check page is available at `/teacher`.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env template:

```bash
cp .env.example .env.local
```

3. Fill in required values in `.env.local`.

4. Run:

```bash
npm run dev
```

Open `http://localhost:3000/login`.

## Replit Deployment Checklist

Set these **Secrets** in Replit:

- `NEXTAUTH_URL` (your Replit app URL, e.g. `https://your-app-name.your-user.repl.co`)
- `NEXTAUTH_SECRET` (long random string)
- `CANVAS_DOMAIN=franklinjc.instructure.com`
- `CANVAS_BASE_URL=https://franklinjc.instructure.com`
- `CANVAS_CLIENT_ID`
- `CANVAS_CLIENT_SECRET`

Optional:
- `ANTHROPIC_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Build/start commands:

- Build: `npm run build`
- Start: `npm run start`

`start` uses `PORT` automatically (`next start --port ${PORT:-3000}`).

## Scripts

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run start
```

## Notes

- `CANVAS_API_TOKEN` remains optional as a fallback for local/dev compatibility.
- Production should use per-user Canvas OAuth tokens from authenticated teacher sessions.
