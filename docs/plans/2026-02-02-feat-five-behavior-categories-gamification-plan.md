---
title: "feat: Five Behavior Categories Gamification"
type: feat
date: 2026-02-02
---

# feat: Five Behavior Categories Gamification

## Overview

Replace the current speed-based gamification system with a quality-focused system measuring five grading behaviors: **Engagement**, **Specificity**, **Personalization**, **Timeliness**, and **Completeness**. This shifts incentives from "grade fast" to "grade well."

**Core Design Principle:** "This is a self-improvement tool, not a surveillance system."

## Problem Statement / Motivation

The current system rewards speed with 2-min/3-min bonuses, which incentivizes rushing through grading rather than providing thoughtful feedback. Teachers who take time to read carefully, reference specific student work, and personalize AI-generated feedback are effectively penalized.

**Target State:**
- System rewards quality behaviors (5 categories)
- Combo timeout: 15 minutes (was 5)
- Combo multiplier: 1.5x max (was 2.0x)
- Speed bonuses: removed entirely

## Proposed Solution

### The Five Categories

| Category | What It Measures | XP | Multipliers |
|----------|------------------|-----|-------------|
| **Engagement** | 90% scroll-to-unlock | 50 base | Combo applies |
| **Specificity** | AI-detected references | 30/60/90 by tier | None |
| **Personalization** | Character diff % | 0/50/100 by tier | Combo applies |
| **Timeliness** | Days since deadline | Multiplier only | 1.2x → 0.5x |
| **Completeness** | All grades posted | 500 bonus | None |

### XP Formula

```
submissionXP = (engagementXP + specificityXP + personalizationXP) * timelinessMultiplier * comboMultiplier
assignmentXP = sum(submissionXP) + completenessBonus
```

**Combo applies to:** Engagement and Personalization only (per original spec)

### Timeliness Multiplier Table

| Days Since Deadline | Multiplier |
|--------------------|------------|
| 0 (same day) | 1.2x |
| 1-2 days | 1.0x |
| 3-6 days | 0.8x |
| 7+ days | 0.5x |
| No deadline (`due_at: null`) | 1.0x |

### Personalization Tiers

| Tier | Diff % | XP |
|------|--------|-----|
| Untouched | 0% | 0 |
| Reviewed | 1-20% | 50 |
| Personalized | >20% | 100 |

### Specificity Tiers

| Tier | References | XP |
|------|------------|-----|
| Low | 0 | 30 |
| Medium | 1-2 | 60 |
| High | 3+ | 90 |

---

## Technical Considerations

### Key Files to Modify

| File | Changes |
|------|---------|
| `src/lib/game.ts:11-23` | Update POINTS, remove speed bonuses, change combo timeout to 15min, max multiplier to 1.5x |
| `src/lib/game.ts:70-112` | Rewrite `calculatePoints()` for category-based scoring |
| `src/types/index.ts:237-248` | Extend `GameState` with `categoryXP`, `submissionEngagement`, `aiDraftBaselines` |
| `src/components/SubmissionViewer.tsx:358` | Add scroll tracking on container |
| `src/components/BattleScreen.tsx:396-397` | Store original AI draft for personalization diff |
| `src/app/api/agent/route.ts:164-212` | Add specificity detection to synthesis prompt |
| `src/types/index.ts:273-285` | Extend `ComprehensiveFeedbackResult` with `specificityAnalysis` |
| `src/app/page.tsx:410-415` | Pass `due_at` prop to BattleScreen |
| `src/components/ResultsScreen.tsx:169-186` | Redesign for category breakdown |

### Canvas Integration Gotcha

From `docs/solutions/integration-issues/canvas-lms-submission-summary-null-and-graded-count.md`:

> Canvas `submission_summary.graded` only counts POSTED grades, not scored submissions.

**For Completeness:** Use `needs_grading_count` subtraction:
```typescript
const submittedCount = submissions.filter(s => s.submitted_at !== null).length;
const gradedCount = submittedCount - assignment.needs_grading_count;
const isComplete = gradedCount === submittedCount;
```

### Edge Cases to Handle

| Category | Edge Case | Resolution |
|----------|-----------|------------|
| Engagement | PDF pagination | Track cumulative scroll across all pages |
| Engagement | Short submissions (no scroll needed) | Auto-complete engagement if content fits viewport |
| Engagement | URL submissions | Skip engagement tracking (link, not content) |
| Specificity | Teacher doesn't use AI | Show "N/A" for specificity, don't penalize |
| Personalization | AI regenerated | Reset baseline to latest generation |
| Timeliness | `due_at: null` | Default to 1.0x multiplier |
| Completeness | Student never submitted | Exclude from count (only count `submitted_at !== null`) |
| Completeness | Cross-session completion | Track per-assignment, not per-session |

---

## Acceptance Criteria

### Functional Requirements

- [ ] **Engagement:** AI feedback button locked until 90% scroll reached
- [ ] **Engagement:** Progress indicator shows scroll percentage
- [ ] **Engagement:** Button unlocks with visual feedback (animation/glow)
- [ ] **Specificity:** Synthesis returns `specificityAnalysis` with reference counts
- [ ] **Specificity:** Meter displays Low/Medium/High tier after synthesis
- [ ] **Personalization:** Original AI draft stored on generation
- [ ] **Personalization:** Character diff calculated on post
- [ ] **Personalization:** Meter displays Untouched/Reviewed/Personalized tier
- [ ] **Timeliness:** Multiplier calculated from `due_at` field
- [ ] **Timeliness:** Null deadline defaults to 1.0x
- [ ] **Completeness:** Bonus awarded when all submitted grades are posted
- [ ] **Completeness:** Excludes students who never submitted
- [ ] **Combo:** Timeout extended to 15 minutes
- [ ] **Combo:** Max multiplier reduced to 1.5x
- [ ] **Combo:** Only applies to Engagement and Personalization
- [ ] **Speed bonuses:** Completely removed from codebase
- [ ] **Session Summary:** Shows XP breakdown by category with bar chart
- [ ] **Session Summary:** Highlights strongest category

### Quality Gates

- [ ] All existing tests pass after refactor
- [ ] New tests for each category calculation
- [ ] Accessibility: reduced motion respected
- [ ] Mobile: scroll tracking works on touch devices

---

## Implementation Tasks

### Phase 1: Core Game Logic (Foundation)

- [ ] **game.ts:** Remove `SPEED_BONUS_2MIN`, `SPEED_BONUS_3MIN`
- [ ] **game.ts:** Change `COMBO_IDLE_TIMEOUT_MS` to 15 minutes
- [ ] **game.ts:** Change `MAX_MULTIPLIER` to 1.5
- [ ] **game.ts:** Add category XP constants
- [ ] **types/index.ts:** Add `BehaviorCategory` type
- [ ] **types/index.ts:** Extend `GameState` with `categoryXP`
- [ ] **game.ts:** Rewrite `calculatePoints()` for categories

### Phase 2: Engagement (Scroll-to-Unlock)

- [ ] **SubmissionViewer.tsx:** Add scroll tracking ref and state
- [ ] **SubmissionViewer.tsx:** Calculate scroll percentage on scroll event
- [ ] **SubmissionViewer.tsx:** Add `onScrollProgress` callback prop
- [ ] **BattleScreen.tsx:** Track max scroll per submission
- [ ] **BattleScreen.tsx:** Disable AI button until 90% scroll
- [ ] **UI:** Add progress ring around AI button
- [ ] **UI:** Add unlock animation when 90% reached

### Phase 3: Specificity (AI Detection)

- [ ] **types/index.ts:** Add `SpecificityAnalysis` interface
- [ ] **agent/route.ts:** Modify synthesis prompt to detect references
- [ ] **agent/route.ts:** Parse and return `specificityAnalysis` in response
- [ ] **BattleScreen.tsx:** Store specificity result in state
- [ ] **UI:** Add specificity meter to feedback panel

### Phase 4: Personalization (Character Diff)

- [ ] **BattleScreen.tsx:** Store `originalAIDraft` when AI generates
- [ ] **BattleScreen.tsx:** Calculate char diff on post action
- [ ] **game.ts:** Add `calculatePersonalizationTier()` function
- [ ] **UI:** Add personalization meter to feedback panel

### Phase 5: Timeliness (Deadline Multiplier)

- [ ] **page.tsx:** Pass `due_at` to BattleScreen props
- [ ] **BattleScreen.tsx:** Accept `dueAt` prop
- [ ] **game.ts:** Add `calculateTimelinessMultiplier()` function
- [ ] **BattleScreen.tsx:** Apply multiplier on grade actions
- [ ] **UI:** Show timeliness indicator in StreakBar

### Phase 6: Completeness (Batch Bonus)

- [ ] **BattleScreen.tsx:** Track graded count vs submitted count
- [ ] **BattleScreen.tsx:** Detect when all submitted are graded
- [ ] **game.ts:** Award completeness bonus
- [ ] **UI:** Celebration animation on batch completion

### Phase 7: Session Summary Redesign

- [ ] **types/index.ts:** Extend `SessionStats` with `categoryXP`
- [ ] **page.tsx:** Calculate category breakdown for results
- [ ] **ResultsScreen.tsx:** Add category bar chart
- [ ] **ResultsScreen.tsx:** Highlight strongest category
- [ ] **ResultsScreen.tsx:** Update achievements for new system

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Engagement unlock rate | >95% of submissions |
| Personalization "Personalized" tier | >50% of feedback |
| Timeliness same-day grading | Increase vs current |
| Completeness bonus earned | >60% of assignments |
| Session time | Stable (not rushed) |

---

## Dependencies & Risks

### Dependencies
- Canvas API `due_at` field must be populated
- AI synthesis must reliably return structured JSON

### Risks
| Risk | Mitigation |
|------|------------|
| Scroll tracking fails on edge cases | Default to engagement=true if cannot track |
| AI specificity detection unreliable | Make specificity informational, not blocking |
| Point balance feels off | A/B test point values, tune based on feedback |

---

## References & Research

### Internal References
- Brainstorm: `docs/brainstorms/2026-02-02-game-behavior-categories-brainstorm.md`
- Game state: `src/lib/game.ts`
- Types: `src/types/index.ts`
- Battle screen: `src/components/BattleScreen.tsx`
- AI synthesis: `src/app/api/agent/route.ts`

### Canvas Gotcha
- `docs/solutions/integration-issues/canvas-lms-submission-summary-null-and-graded-count.md`
- Key insight: Use `needs_grading_count` subtraction for accurate completeness

### Spec Document
- Original game mechanics spec provided by user (Section 2)

---

## Deepened Implementation Guidance

### Scroll Tracking Implementation (Engagement)

**Best Practice Pattern:**
```typescript
// SubmissionViewer.tsx - Add scroll tracking
import { useRef, useCallback, useEffect, useState } from 'react';

function useScrollProgress(containerRef: React.RefObject<HTMLDivElement>) {
  const [maxScrollPercent, setMaxScrollPercent] = useState(0);
  const ticking = useRef(false);

  const calculateProgress = useCallback(() => {
    const element = containerRef.current;
    if (!element) return;

    const { scrollTop, scrollHeight, clientHeight } = element;
    const scrollableHeight = scrollHeight - clientHeight;

    // Handle no-scroll case (content fits in viewport)
    if (scrollableHeight <= 0) {
      setMaxScrollPercent(100);
      return;
    }

    const currentPercent = (scrollTop / scrollableHeight) * 100;
    setMaxScrollPercent(prev => Math.max(prev, currentPercent));
    ticking.current = false;
  }, [containerRef]);

  const handleScroll = useCallback(() => {
    if (!ticking.current) {
      requestAnimationFrame(calculateProgress);
      ticking.current = true;
    }
  }, [calculateProgress]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    // CRITICAL: Use passive listener for smooth scrolling on mobile
    element.addEventListener('scroll', handleScroll, { passive: true });
    calculateProgress(); // Initial check

    return () => element.removeEventListener('scroll', handleScroll);
  }, [handleScroll, calculateProgress]);

  return maxScrollPercent;
}
```

**Key Gotchas:**
- Always use `{ passive: true }` for scroll listeners (mobile performance)
- Use `requestAnimationFrame` to batch updates (60fps max)
- Handle `scrollHeight <= clientHeight` case (auto-complete engagement)
- Track max scroll reached, not current scroll position
- Respect `prefers-reduced-motion` for animations

### Character Diff Implementation (Personalization)

**Recommended: Space-Optimized Levenshtein**
```typescript
// lib/textDiff.ts
export function calculateSimilarity(original: string, current: string): number {
  if (original === current) return 1;
  if (!original.length || !current.length) return 0;

  // Space-optimized Levenshtein - O(min(m,n)) space
  let [str1, str2] = original.length > current.length
    ? [current, original] : [original, current];

  const len1 = str1.length;
  const len2 = str2.length;

  let prevRow = Array.from({ length: len1 + 1 }, (_, i) => i);
  let currRow = new Array(len1 + 1);

  for (let j = 1; j <= len2; j++) {
    currRow[0] = j;
    for (let i = 1; i <= len1; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      currRow[i] = Math.min(
        prevRow[i] + 1,
        currRow[i - 1] + 1,
        prevRow[i - 1] + cost
      );
    }
    [prevRow, currRow] = [currRow, prevRow];
  }

  const distance = prevRow[len1];
  const maxLen = Math.max(original.length, current.length);
  return 1 - (distance / maxLen);
}

export function getPersonalizationTier(similarity: number): 'untouched' | 'reviewed' | 'personalized' {
  const diffPercent = (1 - similarity) * 100;
  if (diffPercent === 0) return 'untouched';
  if (diffPercent <= 20) return 'reviewed';
  return 'personalized';
}
```

### AI Specificity Detection (Structured Output)

**Extend synthesis prompt in agent/route.ts:**
```typescript
const systemPrompt = `You are an expert grading assistant...

When analyzing teacher notes, also identify specificity:
- Count references to specific student work (quotes, slide numbers, specific examples)
- Count references to rubric criteria or competencies by name

Return your analysis in this exact JSON structure:
{
  "feedback": "...",
  "specificityAnalysis": {
    "submissionReferences": ["quote or reference 1", "quote or reference 2"],
    "rubricReferences": ["competency or criterion mentioned"],
    "totalReferences": 3,
    "tier": "high"  // "low" (0), "medium" (1-2), "high" (3+)
  }
}`;
```

**Type definition:**
```typescript
// types/index.ts
export interface SpecificityAnalysis {
  submissionReferences: string[];
  rubricReferences: string[];
  totalReferences: number;
  tier: 'low' | 'medium' | 'high';
}
```

### XP Balancing Principles

Based on gamification research:

1. **Weber's Law**: Rewards must scale with player progress. A 50 XP bonus feels significant at 500 total but meaningless at 50,000.

2. **Multiplier Stacking**: Use multiplicative for sustained skill (combo), additive for achievements (completeness bonus).

3. **Point Psychology**: Round numbers feel better (50, 100, 500 not 47, 93, 487).

4. **Category Balance Check**: Run simulation to ensure no single category dominates:
   ```
   Expected XP per submission:
   - Engagement: 50 * 1.25 (avg combo) = ~63
   - Specificity: 60 (avg tier) = 60
   - Personalization: 75 * 1.25 (avg combo) = ~94
   - Timeliness: 1.0x avg multiplier = neutral
   Total per submission: ~217 XP
   Completeness: 500 bonus per assignment (~20 submissions) = ~25 XP/submission amortized
   ```

### Accessibility Requirements

```css
/* globals.css - Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .scroll-progress-ring,
  .unlock-animation,
  .category-meter-fill {
    transition: none;
    animation: none;
  }
}
```

```typescript
// Hook for checking preference
function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}
```
