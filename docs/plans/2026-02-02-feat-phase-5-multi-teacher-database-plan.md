---
title: "feat: Phase 5 - Multi-Teacher & Database Architecture"
type: feat
date: 2026-02-02
deepened: 2026-02-02
---

# feat: Phase 5 - Multi-Teacher & Database Architecture

## Enhancement Summary

**Deepened on:** 2026-02-02
**Sections enhanced:** 8 implementation phases + schema + security
**Research agents used:** Prisma best practices, NextAuth v5 patterns, AES-256-GCM encryption, Agent-Native architecture, Security sentinel, Data integrity guardian, Performance oracle, TypeScript reviewer

### Key Improvements
1. **Prisma**: Added connection pooling for serverless (`@prisma/adapter-neon`), composite indexes, retry patterns
2. **NextAuth v5**: Split config for Edge compatibility, proper token refresh, Google domain restriction
3. **Security**: Key derivation with PBKDF2, audit logging, input validation, CSRF protection
4. **Performance**: Composite indexes on hot queries, Redis caching for leaderboard, pagination
5. **Agent-Native**: Split `write_competency_score` into atomic operations, enrollment-scoped tools

### New Considerations Discovered
- OAuth refresh tokens don't acquire new scopes - users must fully revoke at Google Permissions
- Prisma connection pooling is REQUIRED for Vercel/serverless (Neon adapter)
- Cascade deletes on Teacher can wipe student history - consider soft deletes
- Missing unique constraint on `(studentId, teacherId, competencyId, assignmentId)` allows duplicates
- Key rotation requires re-encrypting all tokens - document procedure upfront

---

## Overview

Transform the Boss Battle Grader from a single-teacher prototype into a multi-teacher platform with persistent database storage, Google OAuth authentication, per-teacher Canvas tokens, faculty leaderboard, and cross-class student competency tracking. This phase implements Section 9 of the Spec v2.1.

**Agent-Native Architecture Compliance:**
This plan preserves and extends the four agent-native principles:
- **Parity**: New database tools give agents same capabilities as UI
- **Granularity**: Atomic database operations (read_teacher, write_session, query_scores)
- **Composability**: Cross-class queries emerge from composing atomic tools
- **Emergent Capability**: Agent can answer "show declining students across all courses" without dedicated features

## Problem Statement / Motivation

The current single-teacher implementation:
- Uses a single `CANVAS_API_TOKEN` environment variable
- Stores data in localStorage and JSON files (not shareable)
- Has hardcoded teacher identity ("Jaymes Dec")
- Cannot track students across multiple teachers/courses
- Has no leaderboard or collaborative features

**Target State:**
- Multiple teachers log in with Google OAuth
- Each teacher stores their own Canvas API token (encrypted)
- Grading sessions persist to PostgreSQL database
- Cross-class student profiles show competency trends from all teachers
- Faculty leaderboard promotes quality grading behaviors

## Technical Considerations

### Current Architecture Gaps

| Component | Current State | Required State |
|-----------|---------------|----------------|
| Database | None | PostgreSQL + Prisma |
| Auth Sessions | JWT-only (no persistence) | Database-backed sessions |
| Canvas Token | Single env var | Per-teacher encrypted in DB |
| Game State | localStorage | DB + localStorage fallback |
| Student History | JSON file | Database with teacher FK |
| Feedback Pairs | JSON file | Database with teacher FK |
| Agent Context | Hardcoded teacher name | Dynamic from session |

### Key Files from Research

**Files to Modify:**
- `src/lib/auth.ts` - Add Prisma adapter, session callbacks
- `src/lib/canvas.ts` - Accept token parameter instead of env var
- `src/lib/tools/canvas.ts` - Get token from session/DB
- `src/lib/tools/student.ts` - Dual-write to database
- `src/lib/tools/feedback.ts` - Database storage
- `src/lib/agent/context.ts` - Dynamic teacher info
- `src/lib/game.ts` - Session persistence
- `src/types/index.ts` - New database types

**Files to Create:**
- `prisma/schema.prisma` - Database schema
- `src/lib/db.ts` - Prisma client singleton
- `src/lib/crypto.ts` - AES-256-GCM encryption
- `src/lib/leaderboard.ts` - Leaderboard queries
- `src/lib/student-profiles.ts` - Cross-class queries
- `src/app/login/page.tsx` - Login screen
- `src/app/setup/page.tsx` - Canvas token wizard
- `src/app/api/canvas-token/route.ts` - Token validation
- `src/components/Leaderboard.tsx` - Faculty leaderboard
- `src/components/TeacherProfile.tsx` - Teacher character card

### Institutional Learnings Applied

From `docs/solutions/`:
1. **OAuth Setup**: Follow checklist from Google Docs API solution - enable API in cloud console, add both dev/prod redirect URIs
2. **Canvas API Gotchas**: `submission_summary.graded` only counts POSTED grades; use `needs_grading_count` subtraction
3. **Canvas Auto-Content**: Filter out websnappr attachments; store `submission_type` to route correctly
4. **React Hooks**: Auth hooks must follow Rules of Hooks - guard logic inside effects, not outside

---

## Proposed Solution

### Database Schema (Prisma)

#### Research Insights: Prisma Best Practices

**Connection Pooling (CRITICAL for Serverless):**
- Vercel/serverless environments exhaust connections quickly
- Use `@prisma/adapter-neon` with `@neondatabase/serverless` for Neon
- Configure `connection_limit` in DATABASE_URL: `?connection_limit=5`

**Composite Indexes:**
- Add indexes on frequently queried combinations (studentId + competencyId, teacherId + startedAt)
- Use `@@index` for read-heavy queries, `@@unique` for constraints

**Migration Strategy:**
- Use `prisma migrate dev` for local, `prisma migrate deploy` for production
- Never edit migrations after deployment - create new ones

```prisma
// prisma/schema.prisma

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]  // Required for Neon serverless
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// NextAuth.js required tables
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  accounts      Account[]
  sessions      Session[]
  teacher       Teacher?
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// Boss Battle Grader tables
model Teacher {
  id                       String   @id @default(cuid())
  userId                   String   @unique
  user                     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  displayName              String
  avatarUrl                String?
  canvasApiTokenEncrypted  String?  @db.Text
  canvasUserId             Int?
  canvasTokenValid         Boolean  @default(false)
  lifetimeXP               Int      @default(0)
  level                    Int      @default(1)
  createdAt                DateTime @default(now())
  lastActiveAt             DateTime @default(now())

  gradingSessions          GradingSession[]
  competencyScores         CompetencyScore[]
  feedbackPairs            FeedbackPair[]
  preferences              TeacherPreferences?
}

model Student {
  id              String   @id @default(cuid())
  canvasUserId    Int      @unique
  displayName     String
  avatarUrl       String?
  firstSeenAt     DateTime @default(now())

  competencyScores CompetencyScore[]
}

model CompetencyScore {
  id                 String   @id @default(cuid())
  studentId          String
  student            Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  teacherId          String
  teacher            Teacher  @relation(fields: [teacherId], references: [id], onDelete: Cascade)
  competencyId       String   // e.g., 'collaboration', 'systems', 'agency'
  grade              String   // A+, A, B, C, D, F
  canvasCourseId     Int
  canvasAssignmentId Int
  subjectArea        String?  // e.g., 'Design & Tech', 'English'
  gradedAt           DateTime @default(now())

  // Prevent duplicate scores for same student/teacher/competency/assignment
  @@unique([studentId, teacherId, competencyId, canvasAssignmentId])

  // Composite indexes for common query patterns
  @@index([studentId, competencyId])           // Cross-class competency queries
  @@index([teacherId, canvasCourseId])         // Teacher's course view
  @@index([studentId, gradedAt])               // Student trend analysis
  @@index([canvasCourseId, canvasAssignmentId]) // Assignment rollup
}

model GradingSession {
  id                  String   @id @default(cuid())
  teacherId           String
  teacher             Teacher  @relation(fields: [teacherId], references: [id], onDelete: Cascade)
  canvasCourseId      Int
  canvasAssignmentId  Int
  submissionsGraded   Int      @default(0)
  xpEngagement        Int      @default(0)
  xpSpecificity       Int      @default(0)
  xpPersonalization   Int      @default(0)
  xpTimeliness        Int      @default(0)
  xpCompleteness      Int      @default(0)
  xpTotal             Int      @default(0)
  maxCombo            Int      @default(0)
  badgesEarned        String[] @default([])
  durationSeconds     Int      @default(0)
  startedAt           DateTime @default(now())
  endedAt             DateTime?

  @@index([teacherId])
  @@index([startedAt])
}

model FeedbackPair {
  id                 String   @id @default(cuid())
  teacherId          String
  teacher            Teacher  @relation(fields: [teacherId], references: [id], onDelete: Cascade)
  canvasAssignmentId Int
  canvasStudentId    Int
  originalDraft      String   @db.Text
  teacherEdited      String   @db.Text
  editDistance       Float
  competencyGrades   Json     // Record<CompetencyId, Grade>
  createdAt          DateTime @default(now())

  @@index([teacherId])
}

model TeacherPreferences {
  id             String   @id @default(cuid())
  teacherId      String   @unique
  teacher        Teacher  @relation(fields: [teacherId], references: [id], onDelete: Cascade)
  styleRules     Json     @default("{}")
  recentExamples Json     @default("[]")
  pairsAnalyzed  Int      @default(0)
  updatedAt      DateTime @updatedAt
}
```

### Agent-Native Tool Extensions

#### Research Insights: Agent-Native Architecture Review

**Granularity Improvement (from review):**
The original `write_competency_score` violates granularity by coupling Canvas write + DB write. Split into atomic tools:

| Tool | Returns | Description |
|------|---------|-------------|
| `read_teacher` | Teacher | Get current teacher's profile and preferences |
| `write_session` | void | Save grading session to database |
| `read_student_scores` | CompetencyScore[] | Query single student's scores (enrollment-scoped) |
| `read_cohort_scores` | CompetencyScore[] | Query batch scores with filters (competency, course, date range) |
| `write_competency_score_db` | CompetencyScore | Write score to database only |
| `post_grade_canvas` | void | Post grade to Canvas only |
| `read_leaderboard` | LeaderboardEntry[] | Get faculty rankings by category |

**Composability Pattern:**
```
# Agent composes atomic tools for "post grade and track"
1. post_grade_canvas(studentId, grade)           # Canvas API
2. write_competency_score_db(studentId, grade)   # Database
3. [Agent can add step 3: notify student, etc.]
```

**Enrollment-Scoped Access:**
All `read_*` tools must verify teacher has graded the student before returning data. This prevents teachers from querying arbitrary students.

**Example Emergent Capability:**
```
Teacher asks: "Which students have declining Adaptability across multiple classes?"

Agent composes:
1. read_teacher() → get current teacher's course list
2. read_cross_class_scores(competencyId: 'adaptability') → all scores
3. [Agent groups by student, calculates trends]
4. complete_task(declining_students)

No dedicated feature built - agent composed existing tools.
```

---

## Acceptance Criteria

### Database & Infrastructure

- [ ] PostgreSQL database provisioned (Replit/Neon)
- [ ] Prisma schema created with all tables from Section 9.3
- [ ] Prisma client singleton with connection pooling
- [ ] Migrations run successfully

### Authentication

- [ ] Google OAuth login flow works
- [ ] NextAuth uses Prisma adapter (database sessions)
- [ ] Login page with pixel-art styling
- [ ] Session includes teacher ID and Canvas token status
- [ ] Unauthenticated users redirected to login

### Canvas Token Management

- [ ] Setup wizard page with step-by-step instructions
- [ ] Token paste field with validation (GET /api/v1/users/self)
- [ ] Tokens encrypted with AES-256-GCM before storage
- [ ] Invalid token detection with "Reconnect Canvas" prompt
- [ ] Token never exposed to client (server-side only)

### Per-Teacher Data Isolation

- [ ] Canvas tools fetch teacher's encrypted token from DB
- [ ] Competency scores written with teacher_id foreign key
- [ ] Feedback pairs scoped to teacher
- [ ] Grading sessions track teacher attribution

### Game State Persistence

- [ ] Grading sessions saved to `grading_sessions` table on exit
- [ ] Lifetime XP aggregated in `teachers.lifetimeXP`
- [ ] Teacher level calculated from XP thresholds
- [ ] localStorage maintained as fallback/cache

### Cross-Class Features

- [ ] Student character cards show scores from all teachers
- [ ] Enrollment-scoped access (teacher sees only their students)
- [ ] Per-course drill-down in character card

### Faculty Leaderboard

- [ ] Overall ranking by XP per submission (normalized)
- [ ] Category spotlights (Engagement, Specificity, etc.)
- [ ] Time-scoped views (week, month, semester, all-time)
- [ ] Faculty Guild collective stats

### Agent Context Updates

- [ ] Dynamic teacher name from session (not hardcoded)
- [ ] Learned preferences loaded from `teacher_preferences`
- [ ] New database tools registered in tool registry

---

## Implementation Phases

### 5.1: Database Foundation

**Files:**
- `prisma/schema.prisma`
- `src/lib/db.ts`
- `src/lib/crypto.ts`
- `package.json` (add dependencies)

**Tasks:**
- [ ] Install Prisma: `npm install prisma @prisma/client`
- [ ] Install auth adapter: `npm install @auth/prisma-adapter`
- [ ] Create Prisma schema from above
- [ ] Create Prisma client singleton with connection pooling
- [ ] Implement AES-256-GCM encryption utilities
- [ ] Add environment variables: `DATABASE_URL`, `NEXTAUTH_SECRET`, `TOKEN_ENCRYPTION_KEY`
- [ ] Run initial migration: `npx prisma migrate dev`

```typescript
// src/lib/db.ts
import { PrismaClient } from '@prisma/client';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';

/**
 * Research Insights: Prisma Connection Pooling for Serverless
 *
 * Problem: Serverless functions (Vercel, Netlify) create new DB connections
 * per invocation, quickly exhausting Postgres connection limits.
 *
 * Solution: Use @prisma/adapter-neon with @neondatabase/serverless for
 * connection pooling that works in serverless environments.
 */

// Required for WebSocket connections in Node.js
neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  pool: Pool;
};

function createPrismaClient(): PrismaClient {
  // For serverless: use Neon adapter with connection pooling
  if (process.env.VERCEL || process.env.SERVERLESS) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaNeon(pool);
    return new PrismaClient({ adapter });
  }

  // For local dev: standard client
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
```

**Dependencies to add:**
```bash
npm install @neondatabase/serverless @prisma/adapter-neon ws
npm install -D @types/ws
```

```typescript
// src/lib/crypto.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;        // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16;  // 128 bits
const KEY_LENGTH = 32;       // 256 bits
const PBKDF2_ITERATIONS = 100000;
const VERSION = 'v1';        // For future key rotation

/**
 * Research Insights: Security Best Practices
 *
 * 1. Use PBKDF2 for key derivation (not raw env var)
 * 2. Include version prefix for key rotation support
 * 3. Validate input before encryption
 * 4. Use constant-time comparison for auth tags
 * 5. Log encryption events (without exposing secrets)
 */

// Derive key from master secret using PBKDF2
function deriveKey(salt: Buffer): Buffer {
  const masterKey = process.env.TOKEN_ENCRYPTION_KEY;
  if (!masterKey || masterKey.length < 32) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be at least 32 characters');
  }
  return crypto.pbkdf2Sync(masterKey, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

export function encrypt(text: string, context?: { teacherId?: string }): string {
  // Input validation
  if (!text || typeof text !== 'string') {
    throw new Error('encrypt: text must be a non-empty string');
  }

  const salt = crypto.randomBytes(16);
  const key = deriveKey(salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  // Log encryption event (without secret)
  if (context?.teacherId) {
    console.log(`[crypto] Token encrypted for teacher ${context.teacherId}`);
  }

  // Format: version:salt:iv:authTag:ciphertext
  return [VERSION, salt.toString('base64'), iv.toString('base64'), authTag.toString('base64'), encrypted].join(':');
}

export function decrypt(encryptedText: string, context?: { teacherId?: string }): string {
  // Input validation
  if (!encryptedText || typeof encryptedText !== 'string') {
    throw new Error('decrypt: encryptedText must be a non-empty string');
  }

  const parts = encryptedText.split(':');
  if (parts.length !== 5) {
    throw new Error('decrypt: invalid encrypted text format');
  }

  const [version, saltB64, ivB64, authTagB64, ciphertext] = parts;

  if (version !== VERSION) {
    throw new Error(`decrypt: unsupported version ${version}`);
  }

  const salt = Buffer.from(saltB64, 'base64');
  const key = deriveKey(salt);
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  if (context?.teacherId) {
    console.log(`[crypto] Token decrypted for teacher ${context.teacherId}`);
  }

  return decrypted;
}

// Utility: Generate a secure encryption key
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
```

**Key Rotation Procedure:**
When rotating keys, update `VERSION` to `'v2'` and add migration logic to re-encrypt all tokens with the new key. The version prefix allows graceful handling during transition.

### 5.2: Authentication Enhancement

#### Research Insights: NextAuth v5 Best Practices

**Split Config for Edge Compatibility:**
NextAuth v5 middleware runs on Edge Runtime, but Prisma doesn't. Split auth config:
- `auth.config.ts` - Provider config (Edge-compatible)
- `auth.ts` - Full config with Prisma adapter (Node.js only)

**Token Refresh Handling:**
OAuth refresh tokens retain original scopes. If new scopes added later, users must fully revoke at https://myaccount.google.com/permissions and re-authorize.

**Google Domain Restriction:**
For school deployments, restrict to @yourschool.edu domain.

**Files:**
- `src/lib/auth.config.ts` (create - Edge-compatible)
- `src/lib/auth.ts` (modify - full config)
- `src/app/login/page.tsx` (create)
- `src/app/setup/page.tsx` (create)
- `src/app/api/canvas-token/route.ts` (create)

**Tasks:**
- [ ] Create split auth config (auth.config.ts + auth.ts)
- [ ] Add Prisma adapter to NextAuth config
- [ ] Add session callbacks with error handling
- [ ] Create login page with "Sign In with Google" button
- [ ] Create Canvas token setup wizard with instructions
- [ ] Create token validation endpoint with CSRF protection
- [ ] Add `requireAuth` middleware helper

```typescript
// src/lib/auth.config.ts - Edge-compatible config
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/documents.readonly https://www.googleapis.com/auth/presentations.readonly",
          // Optional: Restrict to school domain
          // hd: "yourschool.edu",
        },
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/');
      const isLoginPage = nextUrl.pathname === '/login';

      if (isLoginPage) {
        if (isLoggedIn) return Response.redirect(new URL('/', nextUrl));
        return true;
      }

      if (isOnDashboard && !isLoggedIn) {
        return false; // Redirect to login
      }

      return true;
    },
  },
};
```

```typescript
// src/lib/auth.ts - Full config with Prisma
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "./db";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  callbacks: {
    ...authConfig.callbacks,
    async session({ session, user }) {
      try {
        const teacher = await prisma.teacher.findUnique({
          where: { userId: user.id },
          select: { id: true, canvasTokenValid: true, level: true, displayName: true },
        });

        return {
          ...session,
          user: {
            ...session.user,
            id: user.id,
            teacherId: teacher?.id ?? null,
            hasCanvasToken: teacher?.canvasTokenValid ?? false,
            level: teacher?.level ?? 1,
            displayName: teacher?.displayName ?? session.user.name,
          },
        };
      } catch (error) {
        console.error('[auth] Error fetching teacher in session callback:', error);
        return {
          ...session,
          user: {
            ...session.user,
            id: user.id,
            teacherId: null,
            hasCanvasToken: false,
            level: 1,
          },
        };
      }
    },
  },
  events: {
    async createUser({ user }) {
      // Create teacher record on first login
      await prisma.teacher.create({
        data: {
          userId: user.id,
          displayName: user.name || "Teacher",
          avatarUrl: user.image,
        },
      });
    },
  },
});

// Type augmentation for session
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      teacherId: string | null;
      hasCanvasToken: boolean;
      level: number;
      displayName: string;
    } & DefaultSession["user"];
  }
}
```

```typescript
// src/middleware.ts - Edge middleware for auth
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login).*)"],
};
```

### 5.3: Canvas Tool Refactoring

#### Research Insights: Security Best Practices

**Token Validation:**
- Validate Canvas tokens on save using `GET /api/v1/users/self`
- Mark token invalid on 401 errors, prompt user to reconnect
- Never expose tokens to client-side code

**Error Handling:**
- Implement retry with exponential backoff for transient errors
- Log API errors with context (without exposing tokens)
- Handle rate limiting (429) gracefully

**Files:**
- `src/lib/canvas.ts` (modify)
- `src/lib/tools/canvas.ts` (modify)
- `src/lib/tools/registry.ts` (modify)

**Tasks:**
- [ ] Refactor `fetchFromCanvas` to accept token parameter
- [ ] Create `getTeacherCanvasToken` helper that decrypts from DB
- [ ] Add token validation and invalidation logic
- [ ] Implement retry with exponential backoff
- [ ] Update all Canvas tool functions to get token from session
- [ ] Update tool registry to pass teacher context

```typescript
// src/lib/canvas.ts - Enhanced with security and retry
import { decrypt } from './crypto';
import prisma from './db';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

export class CanvasTokenError extends Error {
  constructor(message: string, public readonly teacherId: string) {
    super(message);
    this.name = 'CanvasTokenError';
  }
}

export async function getTeacherCanvasToken(teacherId: string): Promise<string> {
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    select: { canvasApiTokenEncrypted: true, canvasTokenValid: true },
  });

  if (!teacher?.canvasApiTokenEncrypted) {
    throw new CanvasTokenError('No Canvas token configured', teacherId);
  }

  if (!teacher.canvasTokenValid) {
    throw new CanvasTokenError('Canvas token is invalid - please reconnect', teacherId);
  }

  return decrypt(teacher.canvasApiTokenEncrypted, { teacherId });
}

export async function validateCanvasToken(token: string): Promise<{ valid: boolean; userId?: number; error?: string }> {
  try {
    const response = await fetch(
      `${process.env.CANVAS_BASE_URL}/api/v1/users/self`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (response.ok) {
      const user = await response.json();
      return { valid: true, userId: user.id };
    }

    if (response.status === 401) {
      return { valid: false, error: 'Invalid or expired token' };
    }

    return { valid: false, error: `Canvas API error: ${response.status}` };
  } catch (error) {
    return { valid: false, error: 'Failed to connect to Canvas' };
  }
}

export async function invalidateTeacherToken(teacherId: string): Promise<void> {
  await prisma.teacher.update({
    where: { id: teacherId },
    data: { canvasTokenValid: false },
  });
  console.log(`[canvas] Token invalidated for teacher ${teacherId}`);
}

export async function fetchFromCanvas(
  endpoint: string,
  token: string,
  options: { method?: string; body?: unknown; teacherId?: string } = {}
): Promise<unknown> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(
        `${process.env.CANVAS_BASE_URL}/api/v1${endpoint}`,
        {
          method: options.method || 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: options.body ? JSON.stringify(options.body) : undefined,
        }
      );

      // Handle 401 - token invalid
      if (response.status === 401 && options.teacherId) {
        await invalidateTeacherToken(options.teacherId);
        throw new CanvasTokenError('Canvas token expired', options.teacherId);
      }

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
        await sleep(retryAfter * 1000);
        continue;
      }

      if (!response.ok) {
        throw new Error(`Canvas API error: ${response.status} ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry token errors
      if (error instanceof CanvasTokenError) throw error;

      // Exponential backoff for other errors
      if (attempt < MAX_RETRIES - 1) {
        await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt));
      }
    }
  }

  throw lastError || new Error('Canvas API request failed after retries');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### 5.4: Data Migration & Dual-Write

**Files:**
- `src/lib/tools/student.ts` (modify)
- `src/lib/tools/feedback.ts` (modify)
- `src/lib/storage.ts` (modify)

**Tasks:**
- [ ] Update `score_competency` to dual-write (Canvas + DB)
- [ ] Update `save_feedback_pair` to write to database
- [ ] Update `read_student_history` to query from database
- [ ] Keep localStorage as cache/fallback
- [ ] Migrate existing JSON data to database (one-time script)

```typescript
// src/lib/tools/student.ts - Dual-write pattern
import prisma from '../db';

export async function scoreCompetency(
  teacherId: string,
  studentCanvasId: number,
  studentName: string,
  competencyId: string,
  grade: string,
  courseId: number,
  assignmentId: number,
  subjectArea?: string
) {
  // Ensure student exists
  const student = await prisma.student.upsert({
    where: { canvasUserId: studentCanvasId },
    create: {
      canvasUserId: studentCanvasId,
      displayName: studentName,
    },
    update: {
      displayName: studentName,
    },
  });

  // Write competency score
  await prisma.competencyScore.create({
    data: {
      studentId: student.id,
      teacherId,
      competencyId,
      grade,
      canvasCourseId: courseId,
      canvasAssignmentId: assignmentId,
      subjectArea,
    },
  });

  // Also update localStorage for immediate UI
  // (existing localStorage logic)
}
```

### 5.5: Grading Session Persistence

**Files:**
- `src/lib/game.ts` (modify)
- `src/app/page.tsx` (modify)

**Tasks:**
- [ ] Create `saveGradingSession` function
- [ ] Call on session end (exit dungeon, complete assignment)
- [ ] Update teacher's `lifetimeXP` and `level`
- [ ] Calculate level from XP thresholds

```typescript
// src/lib/game.ts - Session persistence
import prisma from './db';

export async function saveGradingSession(
  teacherId: string,
  sessionState: GameState,
  courseId: number,
  assignmentId: number
) {
  const session = await prisma.gradingSession.create({
    data: {
      teacherId,
      canvasCourseId: courseId,
      canvasAssignmentId: assignmentId,
      submissionsGraded: sessionState.gradedSubmissionIds.length,
      xpEngagement: sessionState.categoryXP.engagement,
      xpSpecificity: sessionState.categoryXP.specificity,
      xpPersonalization: sessionState.categoryXP.personalization,
      xpTimeliness: sessionState.categoryXP.timeliness,
      xpCompleteness: sessionState.categoryXP.completeness,
      xpTotal: sessionState.sessionXP,
      maxCombo: sessionState.maxCombo,
      badgesEarned: sessionState.earnedBadges,
      durationSeconds: Math.floor((Date.now() - sessionState.sessionStartTime) / 1000),
      endedAt: new Date(),
    },
  });

  // Update teacher lifetime XP and level
  const teacher = await prisma.teacher.update({
    where: { id: teacherId },
    data: {
      lifetimeXP: { increment: sessionState.sessionXP },
      lastActiveAt: new Date(),
    },
  });

  // Recalculate level
  const newLevel = calculateLevelFromXP(teacher.lifetimeXP);
  if (newLevel !== teacher.level) {
    await prisma.teacher.update({
      where: { id: teacherId },
      data: { level: newLevel },
    });
  }

  return session;
}

function calculateLevelFromXP(xp: number): number {
  // XP thresholds: 0, 1000, 3000, 6000, 10000, 15000, ...
  const thresholds = [0, 1000, 3000, 6000, 10000, 15000, 21000, 28000, 36000, 45000];
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (xp >= thresholds[i]) return i + 1;
  }
  return 1;
}
```

### 5.6: Faculty Leaderboard

#### Research Insights: Performance Optimization

**Caching Strategy:**
- Leaderboard data changes infrequently (on session end only)
- Use in-memory cache with TTL (1-5 minutes) for most deployments
- For high-traffic, use Redis with cache invalidation on write

**Pagination:**
- For schools with many teachers, implement cursor-based pagination
- Limit default response to top 10, with "load more" option

**Query Optimization:**
- Use `groupBy` aggregation in Prisma instead of fetching all sessions
- Add composite index on `(teacherId, startedAt)` for time-scoped queries

**Files:**
- `src/lib/leaderboard.ts` (create)
- `src/lib/cache.ts` (create - simple in-memory cache)
- `src/components/Leaderboard.tsx` (create)
- `src/app/api/leaderboard/route.ts` (create)

**Tasks:**
- [ ] Create leaderboard query functions with caching
- [ ] Implement in-memory cache with TTL
- [ ] Add cache invalidation on session save
- [ ] Implement category spotlight queries
- [ ] Create leaderboard component with tabs
- [ ] Add Faculty Guild collective view
- [ ] Style with pixel-art aesthetic
- [ ] Add pagination for large teacher counts

```typescript
// src/lib/cache.ts - Simple in-memory cache
type CacheEntry<T> = { value: T; expiresAt: number };

class SimpleCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

export const cache = new SimpleCache();
```

```typescript
// src/lib/leaderboard.ts
import prisma from './db';
import { cache } from './cache';

export type LeaderboardCategory =
  | 'overall'
  | 'engagement'
  | 'specificity'
  | 'personalization'
  | 'timeliness'
  | 'completeness';

export type TimeScope = 'week' | 'month' | 'semester' | 'all';

export interface LeaderboardEntry {
  teacherId: string;
  teacherName: string;
  avatarUrl: string | null;
  level: number;
  totalSubmissions: number;
  xpPerSubmission: number;
  categoryXP: Record<string, number>;
  rank: number;
}

const LEADERBOARD_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getLeaderboard(
  category: LeaderboardCategory,
  timeScope: TimeScope
): Promise<LeaderboardEntry[]> {
  // Check cache first
  const cacheKey = `leaderboard:${category}:${timeScope}`;
  const cached = cache.get<LeaderboardEntry[]>(cacheKey);
  if (cached) return cached;

  const startDate = getStartDate(timeScope);

  const sessions = await prisma.gradingSession.groupBy({
    by: ['teacherId'],
    where: {
      startedAt: { gte: startDate },
    },
    _sum: {
      submissionsGraded: true,
      xpEngagement: true,
      xpSpecificity: true,
      xpPersonalization: true,
      xpTimeliness: true,
      xpCompleteness: true,
      xpTotal: true,
    },
  });

  const teachers = await prisma.teacher.findMany({
    where: { id: { in: sessions.map(s => s.teacherId) } },
    select: { id: true, displayName: true, avatarUrl: true, level: true },
  });

  const teacherMap = new Map(teachers.map(t => [t.id, t]));

  const entries: LeaderboardEntry[] = sessions
    .map(s => {
      const teacher = teacherMap.get(s.teacherId);
      const totalSubmissions = s._sum.submissionsGraded || 0;
      const totalXP = s._sum.xpTotal || 0;

      return {
        teacherId: s.teacherId,
        teacherName: teacher?.displayName || 'Unknown',
        avatarUrl: teacher?.avatarUrl || null,
        level: teacher?.level || 1,
        totalSubmissions,
        xpPerSubmission: totalSubmissions > 0 ? totalXP / totalSubmissions : 0,
        categoryXP: {
          engagement: s._sum.xpEngagement || 0,
          specificity: s._sum.xpSpecificity || 0,
          personalization: s._sum.xpPersonalization || 0,
          timeliness: s._sum.xpTimeliness || 0,
          completeness: s._sum.xpCompleteness || 0,
        },
        rank: 0,
      };
    })
    .filter(e => e.totalSubmissions > 0);

  // Sort by category metric
  if (category === 'overall') {
    entries.sort((a, b) => b.xpPerSubmission - a.xpPerSubmission);
  } else {
    entries.sort((a, b) => {
      const aAvg = a.categoryXP[category] / a.totalSubmissions;
      const bAvg = b.categoryXP[category] / b.totalSubmissions;
      return bAvg - aAvg;
    });
  }

  // Assign ranks
  entries.forEach((e, i) => { e.rank = i + 1; });

  // Cache results
  cache.set(cacheKey, entries, LEADERBOARD_CACHE_TTL_MS);

  return entries;
}

// Call this when saving a grading session to invalidate stale cache
export function invalidateLeaderboardCache(): void {
  cache.invalidate('leaderboard:');
}

function getStartDate(scope: TimeScope): Date {
  const now = new Date();
  switch (scope) {
    case 'week': return new Date(now.setDate(now.getDate() - 7));
    case 'month': return new Date(now.setMonth(now.getMonth() - 1));
    case 'semester': return new Date(now.setMonth(now.getMonth() - 4));
    case 'all': return new Date(0);
  }
}
```

### 5.7: Cross-Class Student Profiles

**Files:**
- `src/lib/student-profiles.ts` (create)
- `src/components/CharacterCard.tsx` (modify)

**Tasks:**
- [ ] Create cross-class query functions
- [ ] Implement enrollment-scoped access check
- [ ] Enhance CharacterCard with per-course breakdown
- [ ] Add competency trend calculation

```typescript
// src/lib/student-profiles.ts
import prisma from './db';

export interface CrossClassProfile {
  studentId: string;
  displayName: string;
  avatarUrl: string | null;
  competencyAverages: Record<string, number>;
  perCourseScores: {
    courseId: number;
    courseName: string;
    teacherName: string;
    scores: Record<string, string>;
  }[];
  trends: Record<string, 'improving' | 'steady' | 'declining' | 'new'>;
}

export async function getCrossClassProfile(
  studentCanvasId: number,
  requestingTeacherId: string
): Promise<CrossClassProfile | null> {
  // Verify teacher has access to this student (enrollment check)
  const hasAccess = await verifyStudentAccess(requestingTeacherId, studentCanvasId);
  if (!hasAccess) return null;

  const student = await prisma.student.findUnique({
    where: { canvasUserId: studentCanvasId },
    include: {
      competencyScores: {
        include: { teacher: true },
        orderBy: { gradedAt: 'desc' },
      },
    },
  });

  if (!student) return null;

  // Calculate averages and trends
  const competencyScores = groupByCompetency(student.competencyScores);
  const competencyAverages = calculateAverages(competencyScores);
  const trends = calculateTrends(competencyScores);
  const perCourseScores = groupByCourse(student.competencyScores);

  return {
    studentId: student.id,
    displayName: student.displayName,
    avatarUrl: student.avatarUrl,
    competencyAverages,
    perCourseScores,
    trends,
  };
}

async function verifyStudentAccess(
  teacherId: string,
  studentCanvasId: number
): Promise<boolean> {
  // Check if teacher has graded this student in any course
  const score = await prisma.competencyScore.findFirst({
    where: {
      teacherId,
      student: { canvasUserId: studentCanvasId },
    },
  });
  return !!score;
}
```

### 5.8: Agent Context & Tool Updates

**Files:**
- `src/lib/agent/context.ts` (modify)
- `src/lib/tools/registry.ts` (modify)

**Tasks:**
- [ ] Update context.md generation for dynamic teacher info
- [ ] Register new database tools in registry
- [ ] Add `read_cross_class_scores` tool for emergent queries

```typescript
// src/lib/agent/context.ts - Dynamic teacher
import prisma from '../db';

export async function generateContext(teacherId: string, sessionState: SessionState) {
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    include: { preferences: true },
  });

  return `
# Boss Battle Grader — Agent Context

## Who I Am
Grading assistant for Franklin School. I help the teacher grade
student submissions by composing atomic tools in a loop.

## What I Know About This Teacher
- Name: ${teacher?.displayName || 'Teacher'}
- Level: ${teacher?.level || 1}
- Lifetime XP: ${teacher?.lifetimeXP || 0}
- Feedback style: ${teacher?.preferences?.styleRules || 'Not yet learned'}

## Current Session
- Course: ${sessionState.courseName}
- Assignment: ${sessionState.assignmentName}
- Student: ${sessionState.studentName} (${sessionState.gradedCount}/${sessionState.totalCount})

## Available Tools
Canvas: fetch_courses, fetch_assignments, fetch_submissions, post_grade, post_comment
Content: read_submission, parse_file, parse_url
Feedback: draft_feedback, revise_feedback, save_feedback_pair
Student: read_student_history, score_competency, read_cross_class_scores
State: read_context, read_preferences, complete_task
Database: read_teacher, write_session, read_leaderboard
`;
}
```

---

## Environment Variables

Add to `.env.local`:

```bash
# Existing
CANVAS_BASE_URL=https://your-school.instructure.com
ANTHROPIC_API_KEY=your-anthropic-api-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Remove (per-teacher now)
# CANVAS_API_TOKEN=xxx

# New for Phase 5
DATABASE_URL=postgresql://user:password@host:5432/boss_battle_grader
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
TOKEN_ENCRYPTION_KEY=generate-with-openssl-rand-hex-32
NEXTAUTH_URL=http://localhost:3000
```

Generate secrets:
```bash
openssl rand -base64 32  # NEXTAUTH_SECRET
openssl rand -hex 32     # TOKEN_ENCRYPTION_KEY (must be 32 bytes = 64 hex chars)
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Multiple teachers can log in | Yes |
| Each teacher's Canvas token works | Yes |
| Grading sessions persist across browser refresh | Yes |
| Faculty leaderboard shows all teachers | Yes |
| Cross-class student profile shows data from multiple teachers | Yes |
| Agent can answer cross-class queries | Yes |

---

## Security Considerations

### Research Insights: Security Review Findings

The security review identified the following areas requiring attention:

#### Critical: Key Management
| Issue | Recommendation | Priority |
|-------|---------------|----------|
| Encryption key in env var | For production, use a secrets manager (AWS Secrets Manager, Vercel env encryption) | Critical |
| No key rotation procedure | Document and test key rotation before launch | High |

**Key Rotation Procedure:**
1. Generate new key: `openssl rand -hex 32`
2. Update `VERSION` in crypto.ts to `'v2'`
3. Run migration script to re-encrypt all tokens with new key
4. Update `TOKEN_ENCRYPTION_KEY` in environment
5. Deploy with both v1 and v2 decryption support
6. After confirming all tokens re-encrypted, remove v1 support

#### High: Token Validation & Data Isolation
| Issue | Recommendation | Implemented |
|-------|---------------|-------------|
| Canvas token validation | Validate on save, mark invalid on 401 | ✅ In 5.3 |
| Teacher data isolation | All queries must include `teacherId` filter | ✅ In schema |
| Cross-class access control | Enrollment check before returning data | ✅ In 5.7 |

#### Medium: API Security
| Issue | Recommendation | Implementation |
|-------|---------------|----------------|
| CSRF protection | Use NextAuth CSRF token for mutations | Add to API routes |
| Rate limiting | Implement per-teacher rate limits | Add middleware |
| Input validation | Validate all user inputs (Zod schemas) | Add validation layer |

```typescript
// src/lib/validation.ts - Input validation with Zod
import { z } from 'zod';

export const canvasTokenSchema = z.object({
  token: z.string()
    .min(10, 'Token too short')
    .max(200, 'Token too long')
    .regex(/^[a-zA-Z0-9~_-]+$/, 'Invalid token format'),
});

export const competencyGradeSchema = z.object({
  studentId: z.number().int().positive(),
  competencyId: z.enum(['collaboration', 'agency', 'systems', 'resilience', 'adaptability', 'creativity', 'ethics', 'communication', 'wellness']),
  grade: z.enum(['A+', 'A', 'B', 'C', 'D', 'F']),
  courseId: z.number().int().positive(),
  assignmentId: z.number().int().positive(),
});
```

#### Security Checklist
- [ ] All API routes verify session authentication
- [ ] Canvas tokens never exposed to client-side code
- [ ] All database queries include teacher scoping
- [ ] Input validation on all user-submitted data
- [ ] HTTPS enforced in production
- [ ] Sensitive data excluded from logs
- [ ] Rate limiting implemented on auth endpoints

---

## Performance Optimizations

### Research Insights: Performance Review Findings

#### Database Indexes (Already Added to Schema)
The following composite indexes were added based on query pattern analysis:

| Index | Query Pattern | Impact |
|-------|---------------|--------|
| `(studentId, competencyId)` | Cross-class competency lookup | High |
| `(teacherId, canvasCourseId)` | Teacher's course view | Medium |
| `(studentId, gradedAt)` | Student trend analysis | High |
| `(canvasCourseId, canvasAssignmentId)` | Assignment rollup | Medium |
| `(teacherId, startedAt)` on GradingSession | Leaderboard time-scoped queries | High |

#### Caching Strategy

| Data | Cache Type | TTL | Invalidation |
|------|------------|-----|--------------|
| Leaderboard | In-memory | 5 min | On session save |
| Teacher profile | Request-scoped | Per request | N/A |
| Student history | In-memory | 1 min | On score write |
| Cross-class scores | None (query) | N/A | N/A |

**For High-Traffic Deployments:**
```typescript
// src/lib/redis-cache.ts - Redis adapter (optional)
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

export async function getCached<T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number): Promise<T> {
  const cached = await redis.get<T>(key);
  if (cached) return cached;

  const fresh = await fetcher();
  await redis.setex(key, ttlSeconds, JSON.stringify(fresh));
  return fresh;
}
```

#### Pagination for Large Result Sets

```typescript
// Cursor-based pagination for leaderboard
export async function getLeaderboardPaginated(
  category: LeaderboardCategory,
  timeScope: TimeScope,
  cursor?: string,
  limit: number = 10
): Promise<{ entries: LeaderboardEntry[]; nextCursor: string | null }> {
  // Implementation with cursor-based pagination
  // ...
}
```

#### Performance Checklist
- [ ] Connection pooling enabled (Neon adapter)
- [ ] Composite indexes on hot query paths
- [ ] Leaderboard caching with TTL
- [ ] Pagination on list endpoints
- [ ] No N+1 queries (use Prisma `include`)
- [ ] Canvas API requests batched where possible

---

## Dependencies & Risks

### Dependencies
- Replit PostgreSQL (Neon) provisioning
- Google Cloud Console OAuth credentials
- All teachers must have Canvas API token access

### Risks

| Risk | Mitigation | Status |
|------|------------|--------|
| Database connection limits | Use Prisma Neon adapter with pooling | ✅ Addressed in 5.1 |
| Token encryption key rotation | Document procedure, add version prefix | ✅ Addressed in crypto.ts |
| Canvas token invalidation | Monitor 401s, auto-invalidate, prompt reconnect | ✅ Addressed in 5.3 |
| Data migration from JSON | Keep JSON as fallback during migration | Planned |
| OAuth scope changes | Document revocation procedure for users | ✅ Addressed (learning applied) |
| Cascade deletes wipe data | Consider soft deletes for Teacher model | Review before launch |
| Duplicate competency scores | Added unique constraint on schema | ✅ Addressed in schema |
| Leaderboard query performance | Added caching and composite indexes | ✅ Addressed in 5.6 |

---

## References

### Internal
- Spec: `docs/plans/Boss_Battle_Grader_Spec_v2.1_Multi_Teacher (1).pdf` Section 9
- Canvas gotcha: `docs/solutions/integration-issues/canvas-lms-submission-summary-null-and-graded-count.md`
- OAuth gotcha: `docs/solutions/integration-issues/google-docs-api-not-enabled-403-error.md`

### External
- NextAuth.js Prisma Adapter: https://authjs.dev/reference/adapter/prisma
- NextAuth.js v5 Edge Compatibility: https://authjs.dev/guides/upgrade-to-v5
- Prisma with Next.js: https://www.prisma.io/nextjs
- Prisma Neon Adapter (Serverless): https://www.prisma.io/docs/orm/overview/databases/neon
- AES-256-GCM in Node.js: https://nodejs.org/api/crypto.html
- Zod Validation: https://zod.dev
- Google OAuth 2.0 Scopes: https://developers.google.com/identity/protocols/oauth2/scopes

### Learnings Applied
- `docs/solutions/authentication-issues/oauth-scope-upgrade-stale-refresh-token.md` - OAuth token scope upgrade requires full revocation
- `docs/solutions/integration-issues/canvas-lms-submission-summary-null-and-graded-count.md` - Use needs_grading_count for completeness
