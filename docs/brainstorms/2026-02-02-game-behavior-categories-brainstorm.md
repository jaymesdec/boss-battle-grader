# Brainstorm: Five Behavior Categories for Gamification

**Date:** 2026-02-02
**Status:** Ready for planning

---

## What We're Building

A quality-focused gamification system that rewards five specific grading behaviors instead of speed. The system shifts from "grade fast" to "grade well" by tracking engagement, specificity, personalization, timeliness, and completeness.

### The Five Categories

| Category | What It Measures | Implementation |
|----------|------------------|----------------|
| **Engagement** | Did you read the submission? | 90% scroll-to-unlock before AI feedback button appears |
| **Specificity** | Did you reference specific content? | AI detects references to submission and rubric during synthesis |
| **Personalization** | Did you make the feedback yours? | Character diff between AI draft and final posted version |
| **Timeliness** | Are you grading promptly? | Days-since-deadline multiplier (1.2x → 0.5x) |
| **Completeness** | Did you finish the batch? | Bonus when all submissions posted to Canvas |

---

## Why This Approach

### Core Design Principle
> "This is a self-improvement tool, not a surveillance system."

The system trusts the teacher. It incentivizes quality behaviors without punishing or micromanaging. The goal is to help teachers build good habits, not to catch them cutting corners.

### What Changes from Current System

1. **Remove speed bonuses** — No more "under 2 min / under 3 min" XP rewards
2. **Extend combo timeout** — 5 minutes → 15 minutes (thoughtful grading shouldn't break combos)
3. **Lower combo multiplier** — 2.0x → 1.5x (behavior categories become the main XP driver)
4. **Add category breakdown** — Session Summary shows XP earned per behavior category

### Why Each Mechanic Was Chosen

**Engagement (scroll-to-unlock):**
- Simple, non-intrusive gate
- No time component — fast readers aren't penalized
- Trust-based: if they scrolled through, they saw it

**Specificity (AI-detected references):**
- Baked into existing synthesis prompt (no extra LLM call)
- Returns structured `specificity_analysis` with reference counts
- Informational meter, not punitive

**Personalization (character diff):**
- Simple percentage: 0% / 1-20% / >20%
- Easy to compute, no sentence parsing needed
- Three-tier visual meter (Untouched / Reviewed / Personalized)

**Timeliness (days-since-deadline):**
- Uses existing Canvas assignment `due_at` field
- Multiplier never hits zero — encouragement, not punishment
- Spec values: 1.2x (same day) → 1.0x (1-2 days) → 0.8x (3-6 days) → 0.5x (7+ days)

**Completeness (all grades posted):**
- Clear, objective criterion: posted to Canvas = done
- Large batch bonus encourages follow-through

---

## Key Decisions

1. **Specificity detection is baked into the synthesis prompt** — single LLM call, no extra latency
2. **Personalization uses simple character diff** — not weighted sentence-level analysis
3. **90% scroll threshold with no time gate** — trust the teacher
4. **Keep spec timeliness multipliers** — 1.2x/1.0x/0.8x/0.5x progression
5. **Completion = all grades posted to Canvas** — explicit, measurable criterion

---

## Open Questions

1. **Point values per category** — Need to balance XP so categories feel equally important
2. **Specificity meter thresholds** — How many references = "high specificity"?
3. **Anti-pattern nudges** — Spec mentions gentle discouragement; defer to planning phase
4. **Session Summary visualization** — Bar charts? Radar chart? Category comparison?
5. **Combo interaction** — Spec says combo only applies to Engagement + Personalization; confirm this is still desired

---

## Next Steps

Run `/workflows:plan` to create implementation plan covering:
- Frontend: scroll tracking, UI meters, session summary redesign
- Backend: timeliness calculation, completeness tracking
- AI: synthesis prompt updates for specificity detection
- State: new GameState fields for category XP

---

## Context

**Current state:** System rewards speed (2-min/3-min bonuses) with 2.0x max combo multiplier and 5-min idle timeout.

**Target state:** System rewards quality behaviors (5 categories) with 1.5x max combo multiplier and 15-min idle timeout. Speed bonuses removed entirely.
