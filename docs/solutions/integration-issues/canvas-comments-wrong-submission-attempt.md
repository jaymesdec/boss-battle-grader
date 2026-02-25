---
title: Canvas Summary Comments Posted to Wrong Submission Attempt
category: integration-issues
tags: [canvas-api, submissions, multiple-attempts, grading, comments]
module: canvas-integration
symptoms:
  - Summary comments appear on earlier submission attempts instead of the current one
  - Grade posts successfully but comment goes to wrong attempt
  - Teacher sees comment on attempt 1 or 2 when grading attempt 3
root_cause: Missing attempt parameter in Canvas API requests; API defaults to earlier attempt when not specified
severity: high
date_solved: 2026-02-03
---

# Canvas Summary Comments Posted to Wrong Submission Attempt

## Symptom

When posting grades and comments to Canvas, the summary comment would appear on an earlier submission attempt (e.g., attempt 2) instead of the latest attempt the teacher was viewing and grading (e.g., attempt 3). The grade and rubric criterion comments posted correctly, but the general summary comment went to the wrong place.

## Investigation

1. Added logging to verify `postComment()` was being called - it was
2. Canvas API returned `success: true` with `submission_comments` array populated
3. Response showed `attempt: 2` when the teacher was grading attempt 3
4. User discovered comment appeared on earlier submission attempt in SpeedGrader

## Root Cause

When students have multiple submission attempts in Canvas, the API endpoint `/api/v1/courses/:course_id/assignments/:assignment_id/submissions/:user_id` defaults to an earlier attempt if the `attempt` parameter is not explicitly specified.

The code was passing `userId` but not the `attempt` number, so Canvas chose an earlier attempt by default.

## Solution

Pass the `attempt` parameter through the entire grading flow - from frontend to Canvas API.

### 1. Frontend Request (BattleScreen.tsx)

Include the submission's attempt number in the API request:

```typescript
const response = await fetch('/api/agent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    task: 'post_grades',
    courseId,
    assignmentId,
    userId: currentSubmission.user_id,
    attempt: currentSubmission.attempt,  // NEW
    score: Math.round(totalScore),
    comment: feedbackText,
    rubricAssessment,
  }),
});
```

### 2. API Route Handler (route.ts)

Extract attempt and pass to Canvas functions:

```typescript
const { courseId, assignmentId, userId, attempt, score, comment, rubricAssessment } = body;

const gradeResult = await postGrade(
  courseId, assignmentId, userId,
  String(score || 0),
  canvasRubricAssessment,
  attempt  // Pass attempt
);

const commentResult = await postComment(
  courseId, assignmentId, userId,
  comment,
  attempt  // Pass attempt
);
```

### 3. Canvas Client Methods (canvas.ts)

Include attempt in the API payloads:

```typescript
// postGrade
const body = {
  submission: {
    posted_grade: grade,
    attempt: attempt,  // Include in submission object
  },
  rubric_assessment: rubricAssessment,
};

// postComment
const body = {
  comment: {
    text_comment: commentText,
    attempt: attempt,  // Include in comment object
  },
};
```

## Files Modified

- `src/components/BattleScreen.tsx` - Added `attempt` to API request
- `src/app/api/agent/route.ts` - Extract and pass `attempt` parameter
- `src/lib/canvas.ts` - Added `attempt` parameter to `postGrade()` and `postComment()`

## Why This Works

Canvas requires the `attempt` parameter to be explicitly specified in the request body when targeting a specific submission attempt. Without it, the API defaults to an arbitrary earlier attempt. By including `attempt` in both the `submission` and `comment` objects, Canvas correctly routes feedback to the attempt the teacher is actually grading.

## Prevention

When working with Canvas submissions that support multiple attempts:

1. Always check if the endpoint supports an `attempt` parameter
2. Pass the attempt number from the submission object being displayed to the user
3. Verify the response's `attempt` field matches what was requested
4. Test with students who have multiple submission attempts

## Related Documentation

- [README-CANVAS-PAGINATION.md](./README-CANVAS-PAGINATION.md) - Canvas API overview
- [CANVAS_API_REVIEW_CHECKLIST.md](./CANVAS_API_REVIEW_CHECKLIST.md) - Review checklist for Canvas changes
- [canvas-lms-submission-summary-null-and-graded-count.md](./canvas-lms-submission-summary-null-and-graded-count.md) - Related submission handling
