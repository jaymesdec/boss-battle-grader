---
title: "Canvas LMS Assignments Not Appearing - Pagination Issue"
category: "integration-issues"
tags:
  - canvas
  - api
  - pagination
  - assignments
module: "canvas-integration"
symptoms:
  - assignments missing from list
  - incomplete assignment list
  - assignments beyond first 50 not fetched
  - specific assignment ID not found
severity: "medium"
date_documented: "2026-02-03"
root_cause: "API route only fetching first page of assignments with no pagination handling"
solution_file: "/src/app/api/courses/[courseId]/assignments/route.ts"
---

# Canvas LMS Assignments Not Appearing - Pagination Issue

## Problem Statement

Assignments from Canvas LMS were not appearing in the application's assignment list. Specifically, certain assignments (e.g., assignment 23709 from course 881) were missing despite existing in Canvas.

**Example symptom:** User navigates to course 881 assignments but assignment 23709 is not in the list, even though it exists at:
```
https://franklinjc.instructure.com/courses/881/assignments/23709
```

## Investigation Steps

1. **Received report** of missing assignment with Canvas URL
2. **Explored codebase** to understand assignment fetching flow
3. **Found API route** at `/src/app/api/courses/[courseId]/assignments/route.ts`
4. **Discovered the issue:** Route was using `per_page=50` with no pagination
5. **Compared to existing pattern:** `/src/lib/canvas.ts` has proper `fetchAllPages()` implementation
6. **Root cause confirmed:** Canvas API returns paginated results; route was only getting first page

## Root Cause

The assignments API route made a direct fetch request with `per_page=50` and **no pagination handling**:

```typescript
// BEFORE (broken)
const response = await fetch(
  `${CANVAS_BASE_URL}/api/v1/courses/${courseId}/assignments?per_page=50&include[]=submission_summary&include[]=needs_grading_count`,
  { headers: { Authorization: `Bearer ${CANVAS_API_TOKEN}` } }
);
const assignments = await response.json();
return NextResponse.json(assignments);
```

Canvas API returns paginated results with `Link` headers indicating subsequent pages. The original implementation ignored these headers, only retrieving the first 50 assignments per course.

**Impact:** Any course with more than 50 assignments would have missing items.

## Solution

Updated the API route to implement proper pagination by:

1. Adding a `getNextPageUrl()` helper to parse Canvas's Link header
2. Using a while loop to follow pagination links
3. Increasing `per_page` to 100 for efficiency
4. Accumulating all assignments before returning

### Code Fix

**File:** `/src/app/api/courses/[courseId]/assignments/route.ts`

```typescript
import { NextResponse } from 'next/server';

const CANVAS_BASE_URL = process.env.CANVAS_BASE_URL;
const CANVAS_API_TOKEN = process.env.CANVAS_API_TOKEN;

// Parse Canvas Link header for pagination
function getNextPageUrl(linkHeader: string | null): string | null {
  if (!linkHeader) return null;

  const parts = linkHeader.split(',');
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match) {
      return match[1];
    }
  }
  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;

  if (!CANVAS_BASE_URL || !CANVAS_API_TOKEN) {
    return NextResponse.json(
      { error: 'Canvas API not configured' },
      { status: 500 }
    );
  }

  try {
    // Fetch all assignments with pagination
    const allAssignments: unknown[] = [];
    let url: string | null = `${CANVAS_BASE_URL}/api/v1/courses/${courseId}/assignments?per_page=100&include[]=submission_summary&include[]=needs_grading_count`;

    while (url) {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${CANVAS_API_TOKEN}`,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Canvas API error:', error);
        return NextResponse.json(
          { error: 'Failed to fetch assignments from Canvas' },
          { status: response.status }
        );
      }

      const assignments = await response.json();
      allAssignments.push(...assignments);

      // Check for next page
      url = getNextPageUrl(response.headers.get('Link'));
    }

    return NextResponse.json(allAssignments);
  } catch (error) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json(
      { error: 'Failed to connect to Canvas' },
      { status: 500 }
    );
  }
}
```

### Key Changes

1. **Pagination helper** - `getNextPageUrl()` parses Canvas Link header format: `<url>; rel="next"`
2. **Pagination loop** - `while (url)` continues until no more pages
3. **Increased per_page** - Changed from 50 to 100 for fewer API calls
4. **Result aggregation** - `allAssignments.push(...assignments)` collects all pages

## How Canvas Link Headers Work

Canvas API pagination uses the `Link` header:

```
Link: <https://canvas.example.com/api/v1/courses/1/assignments?page=2>; rel="next",
      <https://canvas.example.com/api/v1/courses/1/assignments?page=1>; rel="first"
```

By parsing this header and following the "next" link, the solution handles:
- Courses with any number of assignments (50, 100, 500+)
- Automatic page detection (no manual page tracking needed)
- Standard Canvas API compliance

## Prevention Strategies

### 1. Use Centralized Canvas Client

The codebase already has `src/lib/canvas.ts` with proper pagination:

```typescript
// PREFERRED: Use the canvas client
import { canvasClient } from '@/lib/canvas';

const assignments = await canvasClient.fetchAllPages<CanvasAssignment>(
  `/api/v1/courses/${courseId}/assignments`,
  { 'include[]': 'submission_summary' }
);
```

### 2. Code Review Checklist

When reviewing Canvas API calls, verify:
- [ ] Uses `canvasClient.fetchAllPages()` for list endpoints
- [ ] No direct `fetch()` calls to Canvas API in route handlers
- [ ] Handles pagination via Link headers if direct fetch is necessary

### 3. Test with Large Datasets

Add integration tests for courses with 100+ assignments to catch pagination issues.

## Related Documentation

- [Canvas API Pagination Prevention](./canvas-api-pagination-prevention.md)
- [Canvas API Review Checklist](./CANVAS_API_REVIEW_CHECKLIST.md)
- [Canvas Submission Summary Issues](./canvas-lms-submission-summary-null-and-graded-count.md)

## Related Code

- `/src/lib/canvas.ts` - Centralized Canvas client with `fetchAllPages()`
- `/src/app/api/courses/route.ts` - May need similar pagination fix
- `/src/app/api/courses/[courseId]/assignments/[assignmentId]/submissions/route.ts` - May need similar fix
