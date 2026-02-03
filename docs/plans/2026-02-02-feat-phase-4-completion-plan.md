---
title: "feat: Phase 4 Completion - Polish & Juice"
type: feat
date: 2026-02-02
---

# feat: Phase 4 Completion - Polish & Juice

## Overview

Phase 4 focuses on the "juice" that makes Boss Battle Grader feel alive: animations, sound, visual polish, and subtle systems that reinforce quality grading behaviors. Most of Phase 4 is complete, but several key features from the spec remain unimplemented.

**What's Complete:**
- Retro color palette and typography (Press Start 2P + JetBrains Mono)
- Screen transition animations (`victory-reveal`, `xp-float`, `combo-glow-*`)
- Point gain and combo visual effects
- 8-bit sound effects via Tone.js (3 effects: success, click, fail)
- Results screen with category breakdown
- Reduced motion support (`prefers-reduced-motion`)
- All 5 behavior categories (Engagement, Specificity, Personalization, Timeliness, Completeness)

**What's Missing:**
1. **Teacher Feedback Learning Loop** (Spec 6.4) - Style distillation and preference injection
2. **Anti-Pattern Nudges** (Spec 2.4) - Companion character warnings
3. **Student Encounter Splash** - Visual transition when entering a submission
4. **Level-Up Animation** - Celebration when teacher levels up
5. **Sound Preference Persistence** - Remember sound on/off across sessions
6. **Additional Sound Effects** - Level up, combo break, unlock sounds

---

## Feature 1: Teacher Feedback Learning Loop (HIGH PRIORITY)

**Spec Reference:** Section 6.4

The feedback learning loop captures how teachers edit AI-generated feedback and uses those patterns to improve future generations. The basic infrastructure exists (`save_feedback_pair`, few-shot injection in `draft_feedback`), but style distillation is missing.

### Current State

| Component | Status | Location |
|-----------|--------|----------|
| `save_feedback_pair` tool | Implemented | `src/lib/tools/feedback.ts:303-340` |
| Few-shot injection | Partial | `src/lib/tools/feedback.ts:153-156` |
| `read_preferences` tool | Missing | - |
| Style distillation | Missing | - |
| Preference injection in context.md | Missing | - |

### Implementation Tasks

#### 1.1 Implement `read_preferences` Tool

Create a tool that returns learned preferences for the current teacher.

**Files to Modify:**
- `src/lib/tools/feedback.ts` - Add `read_preferences` tool definition and implementation
- `src/lib/tools/registry.ts` - Register the new tool

**Implementation:**
```typescript
// Add to feedback.ts
export async function executeReadPreferences(): Promise<string> {
  const pairs = await loadFeedbackPairs();

  if (pairs.length < 5) {
    return JSON.stringify({
      success: true,
      preferences: null,
      reason: 'Insufficient feedback pairs (need 5+)',
    });
  }

  // Get recent examples for few-shot
  const recentExamples = pairs.slice(-5).map(pair => ({
    original: pair.originalDraft.slice(0, 300),
    edited: pair.teacherEdited.slice(0, 300),
    grades: pair.competencyGrades,
  }));

  // Load distilled rules if available
  const rules = await loadDistilledRules();

  return JSON.stringify({
    success: true,
    preferences: {
      styleRules: rules,
      recentExamples,
      pairsAnalyzed: pairs.length,
    },
  });
}
```

#### 1.2 Implement Style Distillation

Analyze feedback pairs to extract patterns (runs periodically, e.g., every 20 pairs).

**Files to Create:**
- `src/lib/feedback-distiller.ts` - Style pattern analyzer

**Distilled Patterns to Detect:**
- Tone adjustments (softens criticism, adds encouragement)
- Structure preferences (bullet points vs. paragraphs)
- Length preferences (shorter/longer than AI default)
- Next-steps inclusion rate
- Use of student name
- Reference to rubric criteria

**Implementation:**
```typescript
// src/lib/feedback-distiller.ts
import { anthropic, MODEL } from '@/lib/anthropic';
import type { FeedbackPair, TeacherPreferences } from '@/types';

export async function distillPreferences(pairs: FeedbackPair[]): Promise<TeacherPreferences> {
  if (pairs.length < 10) {
    return { styleRules: {}, recentExamples: [], pairsAnalyzed: pairs.length };
  }

  // Take a sample of pairs for analysis
  const samplePairs = pairs.slice(-20);

  const prompt = `Analyze these AI-generated vs. teacher-edited feedback pairs to identify the teacher's style preferences.

${samplePairs.map((p, i) => `
Pair ${i + 1}:
AI Generated: ${p.originalDraft.slice(0, 500)}
Teacher Edited: ${p.teacherEdited.slice(0, 500)}
`).join('\n')}

Identify patterns in how the teacher edits. Return a JSON object:
{
  "softens_criticism": true/false,
  "adds_encouragement": true/false,
  "prefers_shorter": true/false,
  "includes_next_steps": true/false,
  "uses_student_name": true/false,
  "references_rubric": true/false,
  "tone_notes": "Brief description of tone preferences",
  "structure_notes": "Brief description of structure preferences"
}`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  // Parse and return preferences
  // ...
}
```

#### 1.3 Inject Preferences into context.md

Update the context generation to include learned preferences.

**Files to Modify:**
- `src/lib/agent/context.ts` - Add preferences section

**Add to context template:**
```markdown
## What I Know About This Teacher's Feedback Style
${preferences ? `
- Tends to: ${preferences.styleRules.tone_notes || 'No patterns detected yet'}
- Structure: ${preferences.styleRules.structure_notes || 'Standard'}
- ${preferences.styleRules.softens_criticism ? 'Softens critical feedback' : ''}
- ${preferences.styleRules.adds_encouragement ? 'Adds extra encouragement' : ''}
- Based on ${preferences.pairsAnalyzed} feedback examples
` : 'No feedback history yet - will learn from edits.'}
```

#### 1.4 Trigger Distillation on Pair Save

Run distillation when threshold is reached.

**Files to Modify:**
- `src/lib/tools/feedback.ts` - Add distillation trigger to `executeSaveFeedbackPair`

```typescript
// In executeSaveFeedbackPair, after saving:
if (trimmedPairs.length % 20 === 0) {
  // Run distillation in background (don't await)
  distillPreferences(trimmedPairs).then(prefs => {
    saveDistilledRules(prefs.styleRules);
  }).catch(console.error);
}
```

---

## Feature 2: Anti-Pattern Nudges (MEDIUM PRIORITY)

**Spec Reference:** Section 2.4

Gentle prompts delivered through a pixel-art companion character when the system detects disengaged grading patterns. Never takes away points—only withholds bonuses and offers friendly nudges.

### Anti-Pattern Detection Rules

| Pattern | Trigger | Message |
|---------|---------|---------|
| Skipping scroll | AI button clicked before 90% scroll | "Hmm, looks like you haven't read through this one yet. Want to take a look?" |
| Empty voice notes | Synthesize clicked with <10 words | "Your notes help me write better feedback! Even a sentence or two makes a big difference." |
| Unchanged AI feedback | 0% edit distance 3+ times in a row | "I'm flattered, but students can tell when feedback is personal. Want to add your touch?" |
| Rapid-fire grading | 3+ submissions <90 seconds each without notes/AI | "Whoa, you're moving fast! Are you sure you want to skip feedback on these?" |

### Implementation Tasks

#### 2.1 Create Companion Component

A pixel-art character that appears with nudge messages.

**Files to Create:**
- `src/components/Companion.tsx` - Pixel-art companion character

**Component Design:**
```typescript
interface CompanionProps {
  message: string | null;
  type: 'info' | 'warning' | 'celebration';
  onDismiss: () => void;
}
```

**Visual Design:**
- Small pixel sprite (32x32 or 48x48)
- Speech bubble with message
- Subtle bounce animation on appear
- Auto-dismiss after 5 seconds or on click
- Respects reduced motion

#### 2.2 Create Nudge Detection Hook

Track grading patterns and trigger appropriate nudges.

**Files to Create:**
- `src/hooks/useNudgeDetection.ts`

**State to Track:**
```typescript
interface NudgeState {
  unchangedFeedbackStreak: number;  // Consecutive 0% edits
  rapidGradeCount: number;          // Submissions <90s without notes
  lastGradeTimestamp: number | null;
}
```

**Hook Implementation:**
```typescript
export function useNudgeDetection(gameState: GameState) {
  const [nudge, setNudge] = useState<NudgeMessage | null>(null);
  const nudgeState = useRef<NudgeState>({
    unchangedFeedbackStreak: 0,
    rapidGradeCount: 0,
    lastGradeTimestamp: null,
  });

  const checkScrollNudge = useCallback((scrollPercent: number, aiButtonClicked: boolean) => {
    if (aiButtonClicked && scrollPercent < 90) {
      setNudge({
        type: 'warning',
        message: "Hmm, looks like you haven't read through this one yet. Want to take a look?",
        pattern: 'skipping_scroll',
      });
    }
  }, []);

  const checkEmptyNotesNudge = useCallback((notesWordCount: number) => {
    if (notesWordCount < 10) {
      setNudge({
        type: 'info',
        message: "Your notes help me write better feedback! Even a sentence or two makes a big difference.",
        pattern: 'empty_notes',
      });
    }
  }, []);

  // ... other checks

  return { nudge, clearNudge, checkScrollNudge, checkEmptyNotesNudge, ... };
}
```

#### 2.3 Integrate Nudges into BattleScreen

Wire up the companion and detection hooks.

**Files to Modify:**
- `src/components/BattleScreen.tsx` - Add Companion and nudge logic

**Integration Points:**
1. Scroll check: When AI button is clicked, verify scroll percentage
2. Notes check: When Synthesize is clicked, check word count
3. Edit check: On Post to Canvas, compare original vs. final feedback
4. Speed check: Track time between grade submissions

---

## Feature 3: Student Encounter Splash (MEDIUM PRIORITY)

**Spec Reference:** Section 7.3 - "Student transition: Brief 'encounter!' splash with name and avatar"

A brief animated splash when navigating to a new student submission, RPG battle-style.

### Implementation Tasks

#### 3.1 Create EncounterSplash Component

**Files to Create:**
- `src/components/EncounterSplash.tsx`

**Design:**
- Full-screen overlay with dark semi-transparent background
- Student pixel avatar (DiceBear) centered
- "VS" text or "ENCOUNTER!" banner
- Student name in Press Start 2P font
- Assignment context (e.g., "MVP Prototype Pitch")
- Auto-dismiss after 1-2 seconds
- Pixel-dissolve or slide-in animation
- Respects `prefers-reduced-motion`

**Component:**
```typescript
interface EncounterSplashProps {
  studentName: string;
  studentAvatar: string;
  assignmentName: string;
  onComplete: () => void;
}

export function EncounterSplash({ studentName, studentAvatar, assignmentName, onComplete }: EncounterSplashProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 1500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  // Render splash overlay
}
```

**CSS Animation:**
```css
@keyframes encounter-slide-in {
  0% { transform: translateY(-100%); opacity: 0; }
  20% { transform: translateY(0); opacity: 1; }
  80% { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(100%); opacity: 0; }
}

.encounter-splash {
  animation: encounter-slide-in 1.5s ease-out forwards;
}

@media (prefers-reduced-motion: reduce) {
  .encounter-splash {
    animation: none;
    opacity: 1;
  }
}
```

#### 3.2 Integrate into Student Navigation

**Files to Modify:**
- `src/components/BattleScreen.tsx` - Show splash on student change

**Trigger:**
- When `currentSubmissionIndex` changes
- When entering Battle Screen from Level Select

---

## Feature 4: Level-Up Animation (MEDIUM PRIORITY)

Celebration when teacher reaches a new XP level.

### Implementation Tasks

#### 4.1 Create LevelUpCelebration Component

**Files to Create:**
- `src/components/LevelUpCelebration.tsx`

**Design:**
- Full-screen overlay
- "LEVEL UP!" banner with particle effects
- Old level → New level display
- Teacher avatar with celebration animation
- Sound effect (triumphant arpeggio)
- Auto-dismiss after 3 seconds

#### 4.2 Track Level Transitions

**Files to Modify:**
- `src/lib/game.ts` - Add `checkLevelUp` function
- `src/app/page.tsx` - Detect level transitions and show celebration

**Level Thresholds (example):**
```typescript
const LEVEL_THRESHOLDS = [
  0,      // Level 1
  500,    // Level 2
  1500,   // Level 3
  3000,   // Level 4
  5000,   // Level 5
  8000,   // Level 6
  12000,  // Level 7
  17000,  // Level 8
  23000,  // Level 9
  30000,  // Level 10
];

export function calculateLevel(totalXP: number): number {
  return LEVEL_THRESHOLDS.findIndex(threshold => totalXP < threshold) || LEVEL_THRESHOLDS.length;
}

export function checkLevelUp(previousXP: number, newXP: number): { leveled: boolean; newLevel: number } | null {
  const prevLevel = calculateLevel(previousXP);
  const newLevel = calculateLevel(newXP);

  if (newLevel > prevLevel) {
    return { leveled: true, newLevel };
  }
  return null;
}
```

---

## Feature 5: Sound Improvements (LOW PRIORITY)

### 5.1 Sound Preference Persistence

Save sound on/off preference to localStorage.

**Files to Modify:**
- `src/lib/sound.ts` - Load/save preference
- `src/hooks/useSound.ts` - Initialize from storage

**Implementation:**
```typescript
// In SoundService
private loadPreference(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem('boss-battle-sound-enabled');
  return stored !== 'false';
}

setEnabled(enabled: boolean): void {
  this.enabled = enabled;
  if (typeof window !== 'undefined') {
    localStorage.setItem('boss-battle-sound-enabled', String(enabled));
  }
}
```

### 5.2 Additional Sound Effects

Add more sounds for key moments.

**New Effects:**
| Effect | Trigger | Notes |
|--------|---------|-------|
| `levelUp` | Teacher reaches new level | Triumphant fanfare |
| `comboBreak` | Combo resets | Descending notes (existing `fail` may work) |
| `unlock` | 90% scroll reached, AI button unlocks | "Ding" or treasure chest open |
| `encounter` | Student splash appears | Battle start sound |
| `achievement` | Badge earned | Distinct from success |

**Implementation:**
```typescript
// Extend SoundEffect type
export type SoundEffect = 'success' | 'click' | 'fail' | 'levelUp' | 'unlock' | 'encounter' | 'achievement';

// Add new patterns in play()
case 'levelUp':
  // Triumphant ascending arpeggio
  this.synth.triggerAttackRelease('C4', '8n', now);
  this.synth.triggerAttackRelease('E4', '8n', now + 0.1);
  this.synth.triggerAttackRelease('G4', '8n', now + 0.2);
  this.synth.triggerAttackRelease('C5', '8n', now + 0.3);
  this.synth.triggerAttackRelease('E5', '8n', now + 0.4);
  this.synth.triggerAttackRelease('G5', '4n', now + 0.5);
  break;

case 'unlock':
  // Single bright tone
  this.synth.triggerAttackRelease('E6', '16n', now);
  this.synth.triggerAttackRelease('G6', '8n', now + 0.05);
  break;

case 'encounter':
  // Quick dramatic intro
  this.synth.triggerAttackRelease('D4', '16n', now);
  this.synth.triggerAttackRelease('A4', '16n', now + 0.08);
  this.synth.triggerAttackRelease('D5', '8n', now + 0.16);
  break;
```

---

## Implementation Priority

| Priority | Feature | Complexity | Impact |
|----------|---------|------------|--------|
| 1 | Feedback Learning Loop | Medium | HIGH - Core agent-native capability |
| 2 | Anti-Pattern Nudges | Medium | HIGH - Quality grading reinforcement |
| 3 | Student Encounter Splash | Low | MEDIUM - Visual polish |
| 4 | Level-Up Animation | Low | MEDIUM - Player motivation |
| 5 | Sound Persistence | Low | LOW - Quality of life |
| 6 | Additional Sounds | Low | LOW - Polish |

**Recommendation:** Start with Feedback Learning (Feature 1) as it's the most impactful for the agent-native architecture. Then implement Anti-Pattern Nudges (Feature 2) as they directly support the quality-grading philosophy.

---

## Acceptance Criteria

### Feature 1: Feedback Learning Loop
- [ ] `read_preferences` tool returns style rules and examples
- [ ] Style distillation runs every 20 feedback pairs
- [ ] Learned patterns appear in context.md
- [ ] AI feedback adapts based on teacher's editing history

### Feature 2: Anti-Pattern Nudges
- [ ] Companion character component renders
- [ ] Scroll skip nudge appears when AI clicked before 90%
- [ ] Empty notes nudge appears for <10 word notes
- [ ] Unchanged feedback nudge appears after 3 consecutive 0% edits
- [ ] Rapid-fire nudge appears for 3+ submissions <90s without notes
- [ ] Nudges never subtract points
- [ ] Nudges dismiss on click or after timeout

### Feature 3: Student Encounter Splash
- [ ] Splash appears when navigating to new student
- [ ] Shows student avatar and name
- [ ] Auto-dismisses after animation
- [ ] Respects reduced motion preference

### Feature 4: Level-Up Animation
- [ ] Level calculated from total XP
- [ ] Celebration overlay shows on level transition
- [ ] Displays old and new level
- [ ] Sound plays on level up

### Feature 5: Sound Improvements
- [ ] Sound preference persists across sessions
- [ ] New sound effects added (levelUp, unlock, encounter)
- [ ] Sounds trigger at appropriate moments

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/feedback-distiller.ts` | Style pattern analysis |
| `src/components/Companion.tsx` | Pixel-art nudge character |
| `src/hooks/useNudgeDetection.ts` | Anti-pattern tracking |
| `src/components/EncounterSplash.tsx` | Student transition animation |
| `src/components/LevelUpCelebration.tsx` | Level up overlay |

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/tools/feedback.ts` | Add `read_preferences` tool, distillation trigger |
| `src/lib/tools/registry.ts` | Register new tool |
| `src/lib/agent/context.ts` | Inject preferences |
| `src/lib/sound.ts` | Persistence, new effects |
| `src/lib/game.ts` | Level calculation, level-up check |
| `src/components/BattleScreen.tsx` | Companion, nudges, encounter splash |
| `src/app/globals.css` | New animations |

---

## Dependencies

- Existing sound system (Tone.js) is already implemented
- Feedback pair storage (`save_feedback_pair`) is already working
- Scroll tracking is already implemented for engagement

---

## References

- Spec: Section 2.4 (Anti-Pattern Nudges)
- Spec: Section 6.4 (Feedback Learning Loop)
- Spec: Section 7.3 (Animations & Effects)
- Spec: Section 10.4 (Phase 4: Pixel Art & Polish)
- Existing implementation: `src/lib/sound.ts`, `src/lib/tools/feedback.ts`
