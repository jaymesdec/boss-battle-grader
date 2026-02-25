# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Boss Battle Grader is a gamified grading assistant for teachers using Canvas LMS. It integrates with Canvas to fetch courses, assignments, and submissions, then uses AI (Claude via Anthropic API) to help generate feedback. The app features a game-like interface with XP, combos, streaks, and achievements to make grading more engaging.

## Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Production build
npm run lint     # Run ESLint
npm start        # Start production server
```

## Architecture

### Tech Stack
- **Framework**: Next.js 16 with App Router (React 19)
- **Styling**: Tailwind CSS 4
- **AI**: Anthropic Claude SDK
- **Auth**: NextAuth v5 (Google OAuth for Docs/Slides access)
- **LMS**: Canvas LMS API

### Directory Structure

```
src/
├── app/              # Next.js App Router pages and API routes
│   ├── page.tsx      # Main entry point with screen navigation
│   └── api/          # API routes for Canvas, agent, Google Docs
├── components/       # React components (screens, viewers, UI)
├── hooks/            # Custom React hooks (useSound, useNudgeDetection, etc.)
├── lib/              # Core business logic
│   ├── agent/        # AI agent loop, context, and prompts
│   ├── tools/        # Tool definitions for AI agent (canvas, content, feedback, student)
│   ├── canvas.ts     # Canvas LMS API client with pagination
│   ├── game.ts       # Game state management (XP, combos, levels)
│   └── google.ts     # Google Docs/Slides API integration
└── types/            # TypeScript type definitions
```

### Key Architectural Patterns

**Screen Navigation**: The app uses a state machine pattern with screens: `hub` -> `level` -> `battle` -> `results`. Navigation is managed via React state in `page.tsx`.

**AI Agent System**: The agent loop (`src/lib/agent/loop.ts`) executes Claude API calls with tool use. Tools are defined in `src/lib/tools/` (canvas, content, feedback, student categories) and registered in `registry.ts`. The agent supports vision for PDF/slide analysis.

**Game State**: Uses React's `useReducer` with a custom game reducer (`src/lib/game.ts`). Tracks XP across behavior categories (engagement, specificity, personalization, timeliness, completeness), combos with timeout, and leveling.

**Canvas Integration**: The Canvas client (`src/lib/canvas.ts`) handles pagination via Link headers. API routes proxy Canvas requests from the frontend.

### Type System

All shared types are in `src/types/index.ts`, including:
- Canvas API types (Course, Assignment, Submission, Rubric)
- Game types (GameState, CategoryXP, achievements)
- Grading types (Competencies, FeedbackDraft)
- Agent types (AgentTask, ToolDefinition, SessionState)

### Path Alias

Uses `@/*` alias mapping to `./src/*` (configured in tsconfig.json).

## Environment Variables

Required in `.env.local`:
```
CANVAS_BASE_URL=https://your-school.instructure.com
CANVAS_API_TOKEN=your-canvas-api-token
ANTHROPIC_API_KEY=your-anthropic-api-key

# Optional: Google OAuth for Docs/Slides
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
AUTH_SECRET=
```

## Demo Mode

The app includes a demo mode (course id = 0) with mock data for testing without Canvas credentials. Demo data is generated in `page.tsx`.
