# Canvas API Pagination - Prevention & Testing Documentation

## Overview

This directory contains comprehensive documentation on Canvas API pagination prevention, following a critical bug where assignment data was truncated for courses with 50+ assignments.

### The Bug

API routes fetched Canvas data with pagination parameters (`per_page=50` or `per_page=100`) but **did not follow pagination links** in Canvas API responses. When courses had more than the page size of assignments, additional assignments were silently discarded.

**Impact:** Teachers were unable to see or grade all assignments in large courses.

### The Fix

Implemented proper pagination handling by:
1. Following Canvas Link headers to retrieve all pages
2. Centralizing pagination logic in `canvasClient.fetchAllPages()`
3. Consolidating all Canvas API calls through the canvas client library

---

## Documentation Files

### 1. **Canvas API Pagination Prevention Strategies**
**File:** `canvas-api-pagination-prevention.md`

Comprehensive guide covering four prevention strategies:

1. **Code Review Checklist** - What to look for when reviewing Canvas API code
2. **Centralized Canvas Client Pattern** - Why and how to centralize all Canvas calls
3. **Integration Tests** - Test cases verifying full dataset retrieval for 100+ items
4. **Best Practices** - Architectural principles and anti-patterns

**When to read:** Before making Canvas API changes or reviewing Canvas API code

**Key sections:**
- Pagination logic implementation
- Link header parsing
- API call centralization patterns
- Monitoring and error handling

### 2. **Canvas API Pagination - Testing Guide**
**File:** `canvas-api-pagination-testing-guide.md`

Practical testing strategies with code examples:

1. **Unit Tests** - Link header parsing and query parameter handling
2. **Integration Tests** - Full pagination flow across multiple pages
3. **Route Handler Tests** - API endpoint testing
4. **Regression Tests** - Preventing known issues
5. **Manual Testing** - End-to-end verification procedures
6. **Test Configuration** - Jest setup and CI/CD integration

**When to read:** When writing tests for Canvas API code

**Key sections:**
- Complete test examples ready to copy/paste
- Mock Canvas server helpers
- Test patterns for 100+ item scenarios
- CI/CD integration with GitHub Actions

### 3. **Canvas API Code Review Checklist**
**File:** `CANVAS_API_REVIEW_CHECKLIST.md`

10-point checklist for reviewing Canvas API code:

1. **Centralization Check** - Are all calls going through `canvasClient`?
2. **Pagination Pattern** - Does code use `fetchAllPages()`?
3. **Parameter Validation** - Are inputs validated?
4. **Error Handling** - Are errors caught and logged?
5. **Testing Coverage** - Are pagination scenarios tested?
6. **Type Safety** - Are types properly defined?
7. **Performance** - Is pagination efficient?
8. **Link Header Verification** - Are Link headers handled safely?
9. **Documentation** - Are pagination requirements documented?
10. **Integration & Regression Tests** - Do new tests verify the fix?

**When to use:** During code review of any Canvas API changes

**Features:**
- Quick assessment flow
- Red flag indicators
- Approved code patterns
- Copy/paste review comment templates
- Decision flow diagram

---

## Quick Start: The Correct Pattern

### The Right Way (Always Use This)

```typescript
import { canvasClient } from '@/lib/canvas';

// For collections of items (courses, assignments, submissions):
const courses = await canvasClient.fetchAllPages<CanvasCourse>(
  '/api/v1/courses',
  { 'include[]': 'total_students' }
);

// Returns ALL courses, handles pagination automatically
// Will follow Link headers until all pages retrieved
```

### The Wrong Way (Never Do This)

```typescript
// ❌ WRONG - Only gets first page
const response = await fetch(
  `${CANVAS_BASE_URL}/api/v1/courses?per_page=100`
);
const courses = await response.json(); // Only 100 items max!
```

---

## Directory Structure

```
docs/solutions/integration-issues/
├── README-CANVAS-PAGINATION.md                    (this file)
├── canvas-api-pagination-prevention.md            (prevention strategies)
├── canvas-api-pagination-testing-guide.md         (testing procedures)
├── CANVAS_API_REVIEW_CHECKLIST.md                (code review checklist)
└── [other integration issue docs]
```

---

## Key Files in Codebase

| File | Purpose |
|------|---------|
| `src/lib/canvas.ts` | Canvas API client with pagination support |
| `src/lib/tools/canvas.ts` | Agent-callable Canvas operations |
| `src/app/api/courses/route.ts` | Courses API endpoint |
| `src/app/api/courses/[courseId]/assignments/route.ts` | Assignments API endpoint |

---

## Workflow: Making Canvas API Changes

### Step 1: Plan Changes
- Read: **Canvas API Pagination Prevention Strategies**
- Section: "Pattern to Follow" & "Best Practices"
- Decision: Will this call return multiple items?

### Step 2: Implement Changes
- If returning multiple items → Use `canvasClient.fetchAllPages<T>()`
- If returning single item → Use `canvasClient.get<T>()` or other method
- Centralize in `src/lib/canvas.ts`, delegate from routes

### Step 3: Write Tests
- Read: **Canvas API Pagination Testing Guide**
- Section: "Part 2" & "Part 6"
- Test with 100+ items to verify pagination

### Step 4: Code Review Preparation
- Read: **Canvas API Code Review Checklist**
- Self-review against all 10 items
- Fix any red flags before submitting PR

### Step 5: Code Review
- Reviewer uses the checklist
- Verify: Centralization, Pagination, Tests, Types
- Approve when all items pass

### Step 6: Merge & Deploy
- Tests pass CI/CD checks
- Pagination tested with real 100+ item data
- No regression in Canvas API behavior

---

## Common Scenarios

### Scenario 1: "I need to fetch all courses"

**Read:** Prevention guide - "Pattern to Follow" section

**Implementation:**
```typescript
const courses = await canvasClient.fetchAllPages<CanvasCourse>(
  '/api/v1/courses',
  {
    'include[]': 'total_students',
    'state[]': 'available',
  }
);
```

**Test:** Use 150+ courses to verify pagination

### Scenario 2: "I need to fetch assignments for a course"

**Read:** Prevention guide - "Centralized Canvas Client Pattern" section

**Implementation:**
```typescript
export async function fetchAssignments(
  courseId: number
): Promise<ApiResponse<CanvasAssignment[]>> {
  try {
    const assignments = await canvasClient.fetchAllPages<CanvasAssignment>(
      `/api/v1/courses/${courseId}/assignments`,
      { 'include[]': 'submission_summary' }
    );
    return { success: true, data: assignments };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch assignments',
    };
  }
}
```

**Test:** Create test course with 120+ assignments

### Scenario 3: "I'm reviewing Canvas API code"

**Use:** CANVAS_API_REVIEW_CHECKLIST.md

**Flow:**
1. Use "Quick Assessment" section
2. If yes, check all 10 items
3. Use provided templates for feedback
4. Make approval decision using "Decision Flow"

### Scenario 4: "A Canvas API test is failing"

**Debug:**
1. Check if test uses pagination mocks correctly
2. Verify Link headers are included in mock responses
3. Confirm `mockFetch` is called multiple times for 100+ items
4. Read: Testing guide - "Part 2: Integration Tests"

---

## Prevention Checklist for Developers

Before submitting Canvas API code:

- [ ] I'm using `canvasClient.fetchAllPages()` for collections
- [ ] I'm NOT making direct `fetch()` calls in route handlers
- [ ] I've tested with 100+ items in the dataset
- [ ] I have integration tests verifying pagination
- [ ] I've documented why pagination is needed
- [ ] My code handles errors gracefully
- [ ] My code is fully typed with TypeScript
- [ ] I've read the prevention guide's "Best Practices" section

---

## Prevention Checklist for Reviewers

When reviewing Canvas API changes:

- [ ] Uses centralized `canvasClient` (not direct fetch)
- [ ] Collections use `fetchAllPages()` (not `.get()`)
- [ ] Tests include 100+ item scenarios
- [ ] Error handling is present and logged
- [ ] Link headers are parsed correctly
- [ ] Code is typed throughout
- [ ] Documentation explains pagination
- [ ] No regression in existing tests

---

## When Pagination Bugs Occur

If you discover a pagination issue:

1. **Immediate:** Check if `fetchAllPages()` was used
2. **Investigate:** Trace back to route handler or Canvas call
3. **Fix:** Move to `src/lib/canvas.ts`, use proper pattern
4. **Add Test:** Create regression test for this scenario
5. **Document:** Add comment explaining pagination need
6. **Review:** Get approval before deploying

---

## Performance Considerations

### API Call Limits

Canvas API has rate limits. With proper pagination:
- Small dataset (< 50 items): 1 API call
- Medium dataset (51-100 items): 2 API calls
- Large dataset (101-150 items): 3 API calls
- Very large dataset (1000+ items): ~10+ API calls

Each call is independent and cached if appropriate.

### Optimization Tips

1. **Use `per_page=100`** (default in fetchAllPages)
   - Reduces API calls vs `per_page=50`

2. **Batch requests** where possible
   - Fetch all assignments at once, not per-course loop

3. **Cache strategically**
   - Consider caching course/assignment lists (stable data)
   - Don't cache submissions (changes frequently)

4. **Monitor performance**
   - Log pagination metrics: page count, total items
   - Alert if unexpected pagination (e.g., 50 API calls)

---

## Troubleshooting

### "I'm only getting 50 items, should have 100+"

**Cause:** Pagination not implemented

**Fix:**
```typescript
// ❌ WRONG
const items = await canvasClient.get('/api/v1/courses/123/assignments');

// ✅ CORRECT
const items = await canvasClient.fetchAllPages('/api/v1/courses/123/assignments');
```

### "My test passes with 50 items but I know there are 100+"

**Cause:** Test data doesn't include pagination Link headers

**Fix:**
```typescript
// ❌ WRONG mock
jest.mock('@/lib/canvas', () => ({
  fetchAllPages: jest.fn().mockResolvedValue([
    { id: 1 }, { id: 2 }, // ... only 50 items
  ]),
}));

// ✅ CORRECT mock (see Testing Guide Part 2)
const mockFetch = mockCanvasAPICall(120, 50); // 120 items, 50 per page
```

### "Why do I need to read all this?"

**Short answer:** Canvas pagination bugs cause data loss. One missed Link header = incomplete assignment data = teachers can't grade students.

**Long answer:** See any document, they explain the impact and prevention.

---

## Learning Path

**First Time Working with Canvas API?**
1. Read: Prevention guide - "Prevention Strategy 2"
2. Read: Testing guide - "Part 1" (understand patterns)
3. Copy: Pattern from this README
4. Test: Follow guide - "Part 5" (manual testing)

**Reviewing Canvas API Code?**
1. Use: CANVAS_API_REVIEW_CHECKLIST.md
2. Refer: Prevention guide sections as needed
3. Request changes if checklist items fail
4. Approve when all items pass

**Debugging Pagination Issue?**
1. Verify: `fetchAllPages()` is being called
2. Check: Link headers in API responses
3. Test: With 100+ item dataset
4. Read: Prevention guide - "Prevention Strategy 4"

**Writing Tests?**
1. Read: Testing guide - "Part 2-3"
2. Copy: Test patterns for your scenario
3. Verify: Tests run with 100+ items
4. Check: Multiple API calls are made

---

## Summary

Canvas API pagination is critical to prevent data loss. This documentation provides:

1. **Prevention Strategies** - How to architect and review code correctly
2. **Testing Guide** - How to verify pagination works with real data
3. **Review Checklist** - How to catch issues before merging
4. **This README** - How to navigate all three

**Use together to prevent pagination bugs from being deployed.**

---

## Questions?

Refer to the specific guide based on your question:

| Question | Read This |
|----------|-----------|
| "How do I use Canvas API safely?" | Prevention guide - "Pattern to Follow" |
| "How do I review Canvas API code?" | CANVAS_API_REVIEW_CHECKLIST.md |
| "How do I test Canvas API code?" | Testing guide - "Part 2" |
| "I found a pagination bug!" | Prevention guide - "Monitoring" + Testing guide |
| "Why do I need all this?" | This file - "When Pagination Bugs Occur" |

---

## Version History

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-02-03 | Initial documentation set created |

---

## Related Issues & PRs

- **Original bug:** Assignment data truncation for courses with 50+ assignments
- **Fix PR:** Added pagination support to Canvas API client
- **Type:** Integration issue / Data integrity

---

## Appendix: Canvas API Concepts

### What is Pagination?

REST APIs return large datasets in "pages" to manage bandwidth and performance.

```
Total items: 150
Page size: 100

Request page 1 → Returns items 1-100, includes "next" link to page 2
Request page 2 → Returns items 101-150, no "next" link (last page)
```

### How Canvas Signals More Pages

Using RFC 8288 Link headers:

```
Link: <https://...?page=2>; rel="next", <https://...?page=3>; rel="last"
```

Meanings:
- `rel="next"` - URL for next page
- `rel="prev"` - URL for previous page
- `rel="last"` - URL for last page

### How Our Client Handles It

```typescript
// Our client automatically:
// 1. Extracts URL from Link header rel="next"
// 2. Makes request to that URL
// 3. Repeats until rel="next" is absent
// 4. Returns all items combined
```

---

For more information, see the individual documentation files.
