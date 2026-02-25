# Replit + Franklin Canvas OAuth Setup

## 1) Create Canvas Developer Key (Authorization Code)

In Franklin Canvas (`franklinjc.instructure.com`):

1. Admin → Developer Keys → + Developer Key → API Key
2. Redirect URI(s):
   - Local: `http://localhost:3000/api/auth/callback/canvas`
   - Replit: `https://<your-replit-domain>/api/auth/callback/canvas`
3. Enable key and copy:
   - Client ID
   - Client Secret

## 2) Configure Replit Secrets

Required:

- `NEXTAUTH_URL=https://<your-replit-domain>`
- `NEXTAUTH_SECRET=<random-long-secret>`
- `CANVAS_DOMAIN=franklinjc.instructure.com`
- `CANVAS_BASE_URL=https://franklinjc.instructure.com`
- `CANVAS_CLIENT_ID=<from Canvas developer key>`
- `CANVAS_CLIENT_SECRET=<from Canvas developer key>`

Optional:

- `ANTHROPIC_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

## 3) Replit Run Settings

- Build: `npm run build`
- Start: `npm run start`

## 4) Verify Access Policy

1. Open `/login`
2. Sign in with Franklin Canvas
3. Confirm redirect to `/teacher`
4. Confirm:
   - `Canvas domain` shows `franklinjc.instructure.com`
   - `Teacher verified` is `Yes`

Non-teacher enrollments should be denied at sign-in.

## 5) Security notes

- Do not commit secrets.
- Use `NEXTAUTH_SECRET` in all non-local environments.
- Franklin domain is hard-restricted in auth logic.
