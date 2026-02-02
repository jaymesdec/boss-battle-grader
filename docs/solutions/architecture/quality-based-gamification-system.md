---
title: "Gamification Refactor: Speed-Based to Quality-Based Rewards"
category: architecture
tags:
  - gamification
  - ux-design
  - behavior-change
  - ai-integration
  - typescript
  - react
module: game-mechanics
symptom: "Speed-based reward system encouraged teachers to grade quickly rather than thoroughly, potentially compromising feedback quality"
root_cause: "Original gamification design prioritized grading velocity (time-based bonuses, fast combo timeouts) over pedagogically valuable behaviors like reading submissions carefully, writing specific feedback, and personalizing AI-generated content"
date: 2026-02-02
---

# Quality-Based Gamification System

## Problem

The original gamification system rewarded "grading fast" with speed bonuses and short combo timeouts, which created perverse incentives that could lead teachers to rush through submissions without providing thoughtful feedback.

## Solution

A comprehensive 7-phase refactor that replaced speed-based rewards with quality-based behavior categories:

| Phase | Feature | Implementation |
|-------|---------|----------------|
| 1 | Remove speed bonuses | Eliminated time-based XP bonuses, extended combo timeout to 15 minutes, reduced max multiplier to 1.5x |
| 2 | Engagement tracking | Scroll-to-unlock system requiring 90% scroll through submission before AI synthesis available |
| 3 | Specificity detection | AI prompt includes specificity analysis counting submission/rubric references, returns tier (low/medium/high) |
| 4 | Personalization tracking | Levenshtein distance diff between AI draft baseline and final submitted feedback |
| 5 | Timeliness multipliers | XP multipliers based on days since deadline (same-day: 1.2x, 1-2 days: 1.0x, 3-6 days: 0.8x, 7+: 0.5x) |
| 6 | Completeness bonus | 500 XP bonus for finishing all submissions in an assignment |
| 7 | Session summary redesign | Category-based breakdown showing engagement, specificity, personalization, timeliness, completeness XP |

## XP Formula

```
Total XP = (Engagement + Specificity + Personalization) * Timeliness * Combo

Where:
- Engagement: 50 XP if scrolled 90%+
- Specificity: 30/60/90 XP based on AI-detected tier
- Personalization: 0/50/100 XP based on Levenshtein diff from AI draft
- Timeliness: 0.5x to 1.2x multiplier based on days since deadline
- Combo: 1.0x to 1.5x based on consecutive quality grades
- Completeness: +500 XP bonus for finishing all submissions
```

## Key Code Patterns

### Pattern 1: Tiered Point Constants with Semantic Categories

**File:** `src/lib/game.ts`

```typescript
export const CATEGORY_POINTS = {
  ENGAGEMENT: 50,
  SPECIFICITY: {
    low: 30,
    medium: 60,
    high: 90,
  },
  PERSONALIZATION: {
    untouched: 0,
    reviewed: 50,
    personalized: 100,
  },
  COMPLETENESS_BONUS: 500,
} as const;

export const TIMELINESS_MULTIPLIERS = {
  SAME_DAY: 1.2,
  ONE_TO_TWO: 1.0,
  THREE_TO_SIX: 0.8,
  SEVEN_PLUS: 0.5,
  NO_DEADLINE: 1.0,
} as const;
```

### Pattern 2: Categorical State Tracking

**File:** `src/types/index.ts`

```typescript
export interface CategoryXP {
  engagement: number;
  specificity: number;
  personalization: number;
  timeliness: number;
  completeness: number;
}

export interface GameState {
  categoryXP: CategoryXP;
  submissionEngagement: Record<string, SubmissionEngagement>;
  aiDraftBaselines: Record<string, string>;
}
```

### Pattern 3: Space-Optimized Levenshtein

**File:** `src/lib/game.ts`

```typescript
export function calculateSimilarity(original: string, current: string): number {
  if (original === current) return 1;
  if (!original.length || !current.length) return 0;

  // O(min(m,n)) space complexity
  let [str1, str2] = original.length > current.length
    ? [current, original] : [original, current];

  let prevRow = Array.from({ length: str1.length + 1 }, (_, i) => i);
  let currRow = new Array(str1.length + 1);

  for (let j = 1; j <= str2.length; j++) {
    currRow[0] = j;
    for (let i = 1; i <= str1.length; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      currRow[i] = Math.min(prevRow[i] + 1, currRow[i - 1] + 1, prevRow[i - 1] + cost);
    }
    [prevRow, currRow] = [currRow, prevRow];
  }

  return 1 - (prevRow[str1.length] / Math.max(original.length, current.length));
}

export function getPersonalizationTier(similarity: number): PersonalizationTier {
  const diffPercent = (1 - similarity) * 100;
  if (diffPercent === 0) return 'untouched';
  if (diffPercent <= 20) return 'reviewed';
  return 'personalized';
}
```

### Pattern 4: AI-Detected Specificity

**File:** `src/app/api/agent/route.ts`

```typescript
// Prompt instructs AI to analyze specificity
const systemPrompt = `
## SPECIFICITY ANALYSIS
When teacher notes are provided, analyze them for specificity:
- Submission references: quotes, slide numbers, specific examples
- Rubric/competency references: mentions of specific criteria

## OUTPUT FORMAT
{
  "specificityAnalysis": {
    "submissionReferences": ["quote from student work"],
    "rubricReferences": ["criterion mentioned by name"],
    "totalReferences": 2,
    "tier": "medium"  // low=0, medium=1-2, high=3+
  }
}`;
```

### Pattern 5: Engagement Gating (Scroll-to-Unlock)

**File:** `src/components/SubmissionViewer.tsx`

```typescript
const ENGAGEMENT_THRESHOLD = 90; // 90% scroll required

const handleScroll = useCallback(() => {
  if (!scrollRef.current || rafPending.current) return;

  rafPending.current = true;
  requestAnimationFrame(() => {
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current!;
    const scrollableHeight = scrollHeight - clientHeight;
    const percent = scrollableHeight > 0
      ? Math.round((scrollTop / scrollableHeight) * 100)
      : 100;

    const engagementMet = percent >= ENGAGEMENT_THRESHOLD;
    onScrollProgress?.(percent, engagementMet);
    rafPending.current = false;
  });
}, [onScrollProgress]);
```

## Files Modified

| File | Changes |
|------|---------|
| `src/types/index.ts` | New types: `BehaviorCategory`, `CategoryXP`, `SpecificityTier`, `PersonalizationTier`, `SubmissionEngagement`, `SpecificityAnalysis` |
| `src/lib/game.ts` | Constants, timeliness/personalization functions, new reducer actions |
| `src/components/SubmissionViewer.tsx` | Scroll tracking with `onScrollProgress` callback |
| `src/components/BattleScreen.tsx` | Full integration of all 5 behavior categories |
| `src/components/FeedbackComposer.tsx` | Scroll-to-unlock UI with progress ring |
| `src/components/ResultsScreen.tsx` | Category-based XP breakdown display |
| `src/app/api/agent/route.ts` | Specificity analysis in AI synthesis prompt |
| `src/app/page.tsx` | Passes `dueAt` prop to BattleScreen |

## Design Principles

### 1. "Grade well, not fast"
- Removed speed bonuses that incentivized rushing
- Added engagement gates (scroll-to-unlock)
- Rewarded personalization of AI drafts

### 2. Self-improvement tool, not surveillance
- Metrics are for teacher self-reflection
- No negative consequences for low scores
- Private to the individual teacher

### 3. AI as assistant, not replacement
- AI generates draft, teacher personalizes
- Specificity rewards teacher's input quality
- Character diff measures teacher engagement with AI output

## Prevention Strategies

### Anti-Patterns to Avoid

| Anti-Pattern | Why It Fails | Better Approach |
|--------------|--------------|-----------------|
| Speed leaderboards | Incentivizes rushing | Quality/engagement leaderboards |
| Binary completion tracking | Misses engagement depth | Scroll/read-time verification |
| Raw AI output acceptance | Removes human value | Diff-based engagement scoring |
| Public low-score shaming | Creates anxiety | Private self-reflection metrics |
| O(n^2) string algorithms | Crashes on real data | Space-optimized implementations |

### Future Work Checklist

Before implementing gamification features, verify:

1. **Does any reward encourage rushing?** Remove or redesign it
2. **Can users game the metric without doing the work?** Add engagement gates
3. **Is AI output being rubber-stamped?** Require measurable human transformation
4. **Could this feel like surveillance?** Make metrics self-reflective only
5. **Are algorithms appropriate for production scale?** Use space-optimized versions
6. **Is the "why" documented?** Future maintainers need philosophical context

## Related

- Plan document: `docs/plans/2026-02-02-feat-five-behavior-categories-gamification-plan.md`
- Brainstorm: `docs/brainstorms/2026-02-02-game-behavior-categories-brainstorm.md`
