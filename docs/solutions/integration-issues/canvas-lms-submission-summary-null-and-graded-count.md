---
title: Canvas LMS API grading counts showing 0/0 despite graded submissions
date: 2026-02-01
category: integration-issues
tags:
  - canvas-lms
  - api-integration
  - grading
  - submission-counts
  - submission-summary
  - needs-grading-count
module: LevelSelect
symptoms: Assignment grading display showed "0/0 GRADED" even when all submissions had been graded in Canvas LMS
root_cause: Canvas submission_summary.graded only counts POSTED grades, and submission_summary can be null
---

# Canvas LMS API Grading Counts Showing 0/0 Despite Graded Submissions

## Problem

The assignment list showed "0/0 GRADED" even when the teacher had graded all student submissions. This made it impossible to see actual grading progress.

## Root Cause

Canvas LMS's `submission_summary.graded` field only counts submissions where grades have been **POSTED/PUBLISHED** to students, not all submissions that have received a score. This means:

1. When a teacher grades a submission but hasn't posted/published it yet, `submission_summary.graded` remains at 0
2. The UI was showing "0/0 GRADED" because it relied solely on `submission_summary.graded` for the numerator
3. Additionally, Canvas sometimes returns `null` for `submission_summary` entirely, causing the logic to fail completely

The `needs_grading_count` field is more accurate because it shows submissions that still require a score, regardless of posting status. By calculating graded count as `totalSubmitted - needs_grading_count`, we get an accurate count of scored submissions.

## Solution

1. **Request `needs_grading_count` from Canvas API** - Add this include parameter to the assignments fetch
2. **Calculate graded count using subtraction** - `gradedCount = totalSubmitted - needs_grading_count`
3. **Handle null `submission_summary`** - Use `has_submitted_submissions` as a fallback indicator
4. **Show "ALL GRADED" instead of counts when complete** - When `needs_grading_count === 0`, display a clearer status message

## Key Code Changes

### 1. API Route - Include `needs_grading_count`

**File:** `src/app/api/courses/[courseId]/assignments/route.ts`

```typescript
// Fetch assignments with submission summary and needs_grading_count
const response = await fetch(
  `${CANVAS_BASE_URL}/api/v1/courses/${courseId}/assignments?per_page=50&include[]=submission_summary&include[]=needs_grading_count`,
  {
    headers: {
      Authorization: `Bearer ${CANVAS_API_TOKEN}`,
    },
  }
);
```

### 2. TypeScript Types - Add new fields

**File:** `src/types/index.ts`

```typescript
export interface CanvasAssignment {
  // ... existing fields
  needs_grading_count?: number;
  has_submitted_submissions?: boolean;
  submission_summary?: {
    graded: number;
    ungraded: number;
    not_submitted: number;
  };
}
```

### 3. Status Logic - Handle null submission_summary

**File:** `src/components/LevelSelect.tsx`

```typescript
function getDungeonStatus(assignment: CanvasAssignment): DungeonStatus {
  const summary = assignment.submission_summary;
  const needsGrading = assignment.needs_grading_count ?? 0;
  const hasSubmissions = assignment.has_submitted_submissions ?? false;

  // If we have submission_summary, use it
  if (summary) {
    const totalSubmitted = (summary.graded || 0) + (summary.ungraded || 0);

    if (totalSubmitted === 0 && summary.not_submitted > 0) {
      return 'no_submissions';
    }
    if (needsGrading === 0 && totalSubmitted > 0) {
      return 'cleared';
    }
    if (needsGrading < totalSubmitted && needsGrading > 0) {
      return 'in_progress';
    }
    return 'ungraded';
  }

  // Fallback when submission_summary is null
  if (!hasSubmissions) {
    return 'no_submissions';
  }
  if (needsGrading === 0) {
    return 'cleared';
  }
  if (needsGrading > 0) {
    return 'in_progress';
  }
  return 'ungraded';
}
```

### 4. Graded Count Calculation

```typescript
// Calculate total submissions (excludes not_submitted)
const totalSubmitted = (summary?.graded || 0) + (summary?.ungraded || 0);

// Use needs_grading_count for accurate graded count
const needsGrading = assignment.needs_grading_count ?? summary?.ungraded ?? 0;
const gradedCount = Math.max(0, totalSubmitted - needsGrading);
```

### 5. Display Logic - Show "ALL GRADED" when complete

```tsx
{needsGrading === 0 ? (
  <span className="flex items-center gap-1 text-green-400">
    <span>✅</span>
    <span className="font-display">ALL GRADED</span>
  </span>
) : (
  // Show counts or "X NEED GRADING"
)}
```

## Prevention

### 1. Never Trust Field Names at Face Value

Canvas API field names are often misleading. Before using any field:
- **Read the official Canvas API documentation** for the exact definition
- **Test with real data** in multiple states (ungraded, graded but not posted, posted)
- **Verify assumptions** by checking actual response values

### 2. Understand the Canvas Grading Lifecycle

Grades in Canvas go through distinct states:
```
Submitted → Graded (draft) → Posted (visible to student)
```

Key insight: **"Graded" in Canvas often means "posted to students"**, not "instructor has entered a score."

### 3. Use the Right Fields for Your Use Case

| Need to Know | Use This Field | NOT This |
|-------------|----------------|----------|
| Has instructor scored it? | `score` is not null | `submission_summary.graded` |
| Is grade visible to student? | `posted_at` is not null | - |
| Needs instructor attention? | `needs_grading_count` | - |
| Total submissions exist? | `has_submitted_submissions` | - |

## Best Practices

### Always Handle Null Responses

Canvas may return `null` for optional fields like `submission_summary`. Always provide fallbacks:

```typescript
const summary = assignment.submission_summary;
const needsGrading = assignment.needs_grading_count ?? 0;
const hasSubmissions = assignment.has_submitted_submissions ?? false;
```

### Log Raw API Responses During Development

```typescript
console.log('Canvas assignment response:', JSON.stringify(assignment, null, 2));
```

### Testing Checklist

Before deploying Canvas integration:
- [ ] Test with assignment that has NO submissions
- [ ] Test with assignment that has submissions but NO grades
- [ ] Test with assignment that has grades but NOT posted
- [ ] Test with assignment that has POSTED grades
- [ ] Verify counts match what Canvas UI shows to instructors

## Warning Signs

1. **0/0 Counts**: If both numerator and denominator are 0 but submissions exist, you're using the wrong fields
2. **Counts Don't Add Up**: If `graded + ungraded !== total`, your data sources are inconsistent
3. **Sudden Drops in Counts**: If graded count drops after posting grades, you're looking at a field that filters by posting status

## Related

- [Canvas API Assignments Documentation](https://canvas.instructure.com/doc/api/assignments.html)
- [Canvas API Submissions Documentation](https://canvas.instructure.com/doc/api/submissions.html)
