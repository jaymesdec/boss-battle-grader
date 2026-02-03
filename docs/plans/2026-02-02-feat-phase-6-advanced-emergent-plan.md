***

title: "feat: Phase 6 - Advanced & Emergent Features"
type: feat
date: 2026-02-02
----------------

# feat: Phase 6 - Advanced & Emergent Features

## Overview

Phase 6 builds upon the multi-teacher database foundation (Phase 5) to unlock the full potential of the Agent-Native architecture. These features demonstrate **emergent capability** - the agent composes existing atomic tools to answer questions the developer never explicitly built features for.

**Prerequisite:** Phase 5 (Multi-Teacher & Database) must be complete.

## Features

### 6.1 Faculty Guild Collective View

**Description:** A school-wide dashboard showing collective grading progress, guild level, and school-wide achievements.

**Implementation:**

* Aggregate all teachers' sessions for collective XP

* Calculate guild level from total XP

* Track school-wide streaks ("Franklin graded 500 submissions this week!")

* Display as a tab in the Leaderboard component

**Files:**

* `src/lib/leaderboard.ts` - Add `getGuildStats()` function

* `src/components/Leaderboard.tsx` - Add Guild tab

**Emergent Capability:**
The agent can answer "How is the school doing on grading this semester?" by composing `read_leaderboard` + aggregation.

***

### 6.2 Agent-Powered Cross-Class Queries

**Description:** Natural language queries that the agent resolves by composing database tools.

**Example Queries:**

* "Show me students whose Adaptability has declined across 2+ courses"

* "Which competencies are weakest school-wide this semester?"

* "Compare Sofia's self-assessment with her teacher scores"

* "Find students who improved in Systems Thinking after feedback"

**Implementation:**

* No new features needed - agent composes existing tools

* May add `query_competency_trends` tool for efficiency

* Expose via chat interface or Results Screen "Ask the Agent"

**Key Tool Composition:**

```
Query: "Which students are struggling in multiple classes?"

Agent loop:
1. read_teacher() → get teacher's enrolled courses
2. read_cross_class_scores(all_students) → batch query
3. [Agent groups by student, identifies declining trends]
4. [Agent filters to students with 2+ declining courses]
5. complete_task(struggling_students)
```

***

### 6.3 Subject-Specific Rubric Row Switching

**Description:** The 9 TD competencies have different descriptors for each subject area (Design & Tech, English, Science, etc.). Allow teachers to switch rubric rows based on their course.

**Implementation:**

* Store rubric descriptors in database or JSON config

* Add `subject_area` to competency scoring context

* UI: dropdown in Battle Screen to select subject row

* Agent uses subject-specific descriptors in feedback generation

**Files:**

* `src/lib/competencies.ts` - Multi-subject descriptor lookup

* `src/components/CompetencyScorer.tsx` - Subject selector

* `src/lib/agent/prompts.ts` - Subject-aware feedback prompts

**Data Model:**

```typescript
interface CompetencyDescriptor {
  competencyId: string;
  subjectArea: string; // 'design_tech' | 'english' | 'science' | ...
  grade: string;
  descriptor: string;
}
```

***

### 6.4 Canvas OAuth2 Upgrade

**Description:** Replace per-teacher token paste with Canvas OAuth2 flow. Teachers click "Sign In with Canvas" and tokens are managed automatically.

**Requirements:**

* Canvas Developer Key from school admin

* OAuth2 callback handling in NextAuth

* Token refresh logic

**Implementation:**

* Add Canvas as NextAuth provider

* Store OAuth tokens instead of API tokens

* Handle token refresh on expiry

**Files:**

* `src/lib/auth.ts` - Add Canvas OAuth provider

* `src/app/api/auth/[...nextauth]/route.ts` - Canvas callbacks

**Note:** This is an optional upgrade. Token paste works fine for single-school deployment.

***

### 6.5 Student Self-Assessment Integration

**Description:** Students submit self-assessments for the 9 competencies. Teachers see student perception alongside their grades.

**Implementation:**

* New database table: `student_self_assessments`

* New API endpoint for student submission

* CharacterCard shows side-by-side comparison

* Agent can identify perception gaps

**Agent Capability:**
"Which students rate themselves higher than teachers do in Agency?"

***

### 6.6 Read-Only Student Dashboard

**Description:** Students log in to view their own character card and competency trends (read-only).

**Implementation:**

* Student Google OAuth login

* Student-scoped data access (own data only)

* Character card visualization

* No grading or editing capabilities

**Files:**

* `src/app/student/page.tsx` - Student dashboard

* `src/lib/auth.ts` - Role-based access (teacher vs student)

***

### 6.7 Custom Agent Prompts

**Description:** Teachers type ad-hoc questions in the UI, and the agent composes tools to answer them.

**Implementation:**

* Chat input in Results Screen or new "Ask Agent" panel

* Route to `/api/agent` with `task: 'custom'`

* Agent receives question + available tools + context

* Streams response back to UI

**Example:**

```
Teacher: "How has Maya's collaboration improved since September?"

Agent:
1. read_student_history(maya, competency: collaboration)
2. [Analyzes trend from September to now]
3. complete_task(analysis)

Response: "Maya's Collaboration has improved from C (September) to A (now),
with notable growth after the group project in October..."
```

***

## Priority Order

| Priority | Feature                 | Complexity | Value  |
| -------- | ----------------------- | ---------- | ------ |
| 1        | 6.2 Cross-Class Queries | Low        | High   |
| 2        | 6.1 Faculty Guild       | Low        | Medium |
| 3        | 6.3 Subject Rubrics     | Medium     | High   |
| 4        | 6.7 Custom Agent        | Medium     | High   |
| 5        | 6.5 Self-Assessment     | Medium     | Medium |
| 6        | 6.6 Student Dashboard   | Medium     | Medium |
| 7        | 6.4 Canvas OAuth2       | High       | Low    |

**Recommendation:** Start with 6.2 (Cross-Class Queries) - it's the best demonstration of Agent-Native architecture and requires minimal new code.

***

## Success Metrics

| Metric                                            | Target       |
| ------------------------------------------------- | ------------ |
| Agent answers cross-class queries correctly       | 90%+         |
| Teachers use "Ask Agent" feature                  | >50% try it  |
| Subject-specific rubrics improve feedback quality | Qualitative  |
| Student dashboard adoption                        | Track logins |

***

## References

* Spec: Section 10.6 (Phase 6: Advanced & Emergent)

* Agent-Native principles: Section 1.2

* Tool catalog: Section 5