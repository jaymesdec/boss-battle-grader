# Canvas API Code Review Checklist

Use this checklist when reviewing any code that interacts with Canvas API. This prevents pagination bugs and other common issues.

---

## Quick Assessment: Is This a Canvas API Change?

Does the PR modify/add code that:
- Calls Canvas API endpoints?
- Fetches courses, assignments, or submissions?
- Interacts with `src/lib/canvas.ts` or `src/app/api/**/*.ts`?
- Uses `fetch()` directly to Canvas?

**If YES** → Use full checklist below

**If NO** → You can skip this checklist

---

## Full Canvas API Review Checklist

### 1. Centralization Check

- [ ] All Canvas API calls use `canvasClient` from `src/lib/canvas.ts`
- [ ] NO raw `fetch()` calls to Canvas endpoints exist in route handlers
- [ ] Code doesn't duplicate pagination logic from `canvasClient`
- [ ] If creating new Canvas function, it's added to `src/lib/canvas.ts`, not inline

**Red flags:**
- `fetch('https://canvas.example.com/api/v1/...')`
- Custom pagination loops in route files
- Canvas API calls scattered across multiple files

**Resolution:** Move Canvas logic to `src/lib/canvas.ts` and call from there

---

### 2. Pagination Pattern Check

For collection endpoints (courses, assignments, submissions):

- [ ] Uses `canvasClient.fetchAllPages<T>()` for collection endpoints
- [ ] Does NOT use `canvasClient.get()` for collections
- [ ] Implements Loop following pagination `Link` headers
- [ ] Default `per_page` is at least 50 (100 preferred)
- [ ] Will fetch ALL items even if 100+

**What are collection endpoints?**
```
/api/v1/courses
/api/v1/courses/{id}/assignments
/api/v1/courses/{id}/assignments/{id}/submissions
/api/v1/courses/{id}/users  # Lists students
```

**What are single-item endpoints?**
```
/api/v1/courses/{id}  # Single course details
/api/v1/courses/{id}/assignments/{id}  # Single assignment
```

**Red flags for collections:**
```typescript
// ❌ WRONG - Only fetches first 50
const response = await fetch(`${CANVAS_BASE_URL}/api/v1/courses?per_page=50`);
const courses = await response.json();

// ❌ WRONG - Uses .get() which doesn't paginate
const courses = await canvasClient.get<CanvasCourse[]>('/api/v1/courses');
```

**Approved pattern:**
```typescript
// ✅ CORRECT - Fetches ALL courses across pages
const courses = await canvasClient.fetchAllPages<CanvasCourse>(
  '/api/v1/courses',
  { 'include[]': 'total_students' }
);
```

**Resolution:** Replace with `fetchAllPages()`

---

### 3. Parameter Validation

- [ ] API parameters are validated/typed
- [ ] Course ID, Assignment ID are numbers or properly formatted strings
- [ ] Query parameters like `include[]` are correct Canvas parameter names
- [ ] No unvalidated user input in API calls

**Red flags:**
```typescript
// ❌ No validation
const courseId = params.courseId;
await canvasClient.fetchAllPages(`/api/v1/courses/${courseId}/assignments`);

// ❌ Wrong parameter name
await canvasClient.fetchAllPages('/api/v1/assignments', {
  'include': 'submission_summary'  // Should be 'include[]'
});
```

**Approved pattern:**
```typescript
// ✅ Validated
const courseId = parseInt(params.courseId);
if (isNaN(courseId)) return NextResponse.json({ error: 'Invalid course ID' }, { status: 400 });

// ✅ Correct parameter
await canvasClient.fetchAllPages(
  `/api/v1/courses/${courseId}/assignments`,
  { 'include[]': 'submission_summary' }
);
```

**Resolution:** Add validation before API calls

---

### 4. Error Handling

- [ ] API errors are caught and logged
- [ ] User receives meaningful error message (not raw API error)
- [ ] Pagination failures are handled (malformed Link headers, etc.)
- [ ] Network timeouts are handled
- [ ] Rate limiting (429 errors) are mentioned/handled

**Red flags:**
```typescript
// ❌ No error handling
const courses = await canvasClient.fetchAllPages('/api/v1/courses');
return NextResponse.json(courses);

// ❌ Exposes raw error
} catch (error) {
  return NextResponse.json({ error }, { status: 500 });
}
```

**Approved pattern:**
```typescript
// ✅ Proper error handling
try {
  const courses = await canvasClient.fetchAllPages<CanvasCourse>('/api/v1/courses');
  return NextResponse.json(courses);
} catch (error) {
  console.error('Failed to fetch courses:', error);
  return NextResponse.json(
    { error: 'Failed to fetch courses from Canvas' },
    { status: 500 }
  );
}
```

**Resolution:** Add try-catch, log errors, return safe error responses

---

### 5. Testing Coverage

- [ ] Tests exist for Canvas API calls
- [ ] Tests cover the happy path (normal data retrieval)
- [ ] Tests cover pagination (100+ items)
- [ ] Tests cover error cases (API down, 401, 500, etc.)
- [ ] Tests cover edge cases (0 items, 1 item, exactly pageSize items)
- [ ] Integration tests verify complete dataset retrieval

**Red flags:**
- No tests added
- Tests only check for errors, not pagination
- Tests mock pagination without following Link headers
- No tests for 100+ item scenarios

**Approved pattern:**
```typescript
describe('Assignments API', () => {
  it('should return all assignments for course', async () => {
    // Mock 150 assignments (needs pagination)
    jest.mock('@/lib/canvas', () => ({
      fetchAllPages: jest.fn().mockResolvedValue(
        Array.from({ length: 150 }, (_, i) => ({ id: i, name: `A${i}` }))
      ),
    }));

    const response = await GET(mockRequest, { params: { courseId: '123' } });
    const data = await response.json();
    expect(data).toHaveLength(150);
  });
});
```

**Resolution:** Add tests for pagination scenarios

---

### 6. Type Safety

- [ ] Canvas response types are defined (`CanvasCourse`, `CanvasAssignment`, etc.)
- [ ] API function returns typed `ApiResponse<T>` wrapper
- [ ] Generic types are properly specified in `fetchAllPages<T>()`
- [ ] No `any` types in Canvas-related code

**Red flags:**
```typescript
// ❌ No types
const courses = await canvasClient.fetchAllPages('/api/v1/courses');

// ❌ Wrong type wrapper
export async function fetchCourses(): Promise<CanvasCourse[]> {
  // Should return ApiResponse<CanvasCourse[]>
}
```

**Approved pattern:**
```typescript
// ✅ Fully typed
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
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

**Resolution:** Add proper types throughout

---

### 7. Performance Considerations

- [ ] `per_page` is set to reasonable value (50-100, not 1 or 10000)
- [ ] Large collection calls don't block critical operations
- [ ] Unnecessary duplicate API calls are avoided
- [ ] Pagination loops have reasonable timeouts (not infinite)
- [ ] No N+1 query patterns (looping through items and calling API for each)

**Red flags:**
```typescript
// ❌ N+1: API call per item
const assignments = await canvasClient.fetchAllPages('/api/v1/courses/123/assignments');
for (const assignment of assignments) {
  const submissions = await canvasClient.fetchAllPages(
    `/api/v1/courses/123/assignments/${assignment.id}/submissions`
  ); // Called for EACH assignment!
}

// ❌ Tiny page size = many API calls
const courses = await canvasClient.fetchAllPages('/api/v1/courses', { per_page: '1' });
```

**Approved pattern:**
```typescript
// ✅ Batch single call per collection
const assignments = await canvasClient.fetchAllPages<CanvasAssignment>(
  `/api/v1/courses/${courseId}/assignments`,
  { 'include[]': 'submission_summary' }
);

// Only call for specific item if needed
const specificSubmissions = await canvasClient.fetchAllPages<CanvasSubmission>(
  `/api/v1/courses/${courseId}/assignments/${selectedAssignmentId}/submissions`
);
```

**Resolution:** Use appropriate pagination and avoid nested loops

---

### 8. Link Header Verification

- [ ] Code handles missing Link headers gracefully
- [ ] Code correctly extracts `rel="next"` from Link header
- [ ] Malformed Link headers don't crash the application
- [ ] Test data includes proper Link header responses

**How Link headers work:**
```
Link: <https://canvas.example.com/api/v1/courses?page=2>; rel="next",
      <https://canvas.example.com/api/v1/courses?page=1>; rel="prev",
      <https://canvas.example.com/api/v1/courses?page=10>; rel="last"
```

**Red flags:**
```typescript
// ❌ Assumes Link header exists
const nextUrl = linkHeader.split(',')[0]; // Crashes if null!

// ❌ Wrong rel attribute parsing
const nextUrl = linkHeader.match(/rel="next"/); // Returns match object, not URL

// ❌ No null handling
url = getNextPageUrl(response.headers.get('Link')); // Works but risky
```

**Approved pattern:**
```typescript
// ✅ Safe Link header handling
function getNextPageUrl(linkHeader: string | null): string | null {
  if (!linkHeader) return null;

  const links = parseLinkHeader(linkHeader);
  const nextLink = links.find((link) => link.rel === 'next');
  return nextLink?.url ?? null;
}

// ✅ Used correctly in loop
let url: string | null = `${endpoint}?${params}`;
while (url) {
  const { data, linkHeader } = await fetch(url);
  results.push(...data);
  url = getNextPageUrl(linkHeader); // Returns null when no more pages
}
```

**Resolution:** Verify Link header handling is defensive

---

### 9. Documentation & Comments

- [ ] Comment explains why pagination is needed
- [ ] Comment mentions Canvas API pagination requirement
- [ ] JSDoc includes return type information
- [ ] Pagination implementation is explained for maintainers

**Approved pattern:**
```typescript
/**
 * Fetches all assignments for a course.
 *
 * Note: Canvas API paginates results with per_page=100 by default.
 * This function follows Link headers in responses to retrieve ALL assignments,
 * even for courses with 100+ assignments.
 *
 * @param courseId - Canvas course ID
 * @returns Promise resolving to array of all assignments for the course
 * @throws Error if Canvas API request fails
 */
export async function fetchAssignments(courseId: number): Promise<ApiResponse<CanvasAssignment[]>> {
  try {
    // Use fetchAllPages to ensure all assignments are retrieved
    // (handles pagination automatically)
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

**Resolution:** Add explanatory comments about pagination

---

### 10. Integration & Regression Tests

- [ ] New tests added for this change
- [ ] Existing tests still pass
- [ ] Regression tests for known pagination bug pass
- [ ] Tests verify behavior with 100+ item datasets
- [ ] Tests mock Canvas API correctly

**Key regression tests:**
- [ ] Data truncation at 50 item boundary is prevented
- [ ] Data truncation at 100 item boundary is prevented
- [ ] Multiple page requests are made (verified via mock call count)

**Red flags:**
- Only testing with mock data < page size
- Tests don't verify multiple API calls were made
- No regression tests for original bug

**Resolution:** Add comprehensive tests including 100+ item scenarios

---

## Decision Flow

Use this flow to make your review decision:

```
Is this a Canvas API change?
├─ NO → Approve (use other checklists)
└─ YES → Continue
   │
   ├─ Does it pass ALL 10 sections?
   │  ├─ YES → ✅ APPROVE
   │  └─ NO → Continue
   │
   └─ What sections failed?
      ├─ CRITICAL (1,2,5): 🔴 REQUEST CHANGES
      │  └─ Centralization, Pagination Pattern, Type Safety
      ├─ IMPORTANT (3,4,6,7,8): 🟡 REQUEST CHANGES
      │  └─ Parameters, Errors, Performance, Link Headers, Docs
      └─ NICE-TO-HAVE (9,10): 💬 COMMENT
         └─ Documentation, Tests

```

---

## Review Comments - Copy/Paste Templates

### Pagination Issue Template

```markdown
**Canvas Pagination Issue Detected:**

This code doesn't properly handle Canvas API pagination.
The Canvas API returns results in pages (default 50-100 per page).
When courses have 100+ assignments, this code will only fetch the first page.

**Fix:** Use `canvasClient.fetchAllPages()` instead:

```typescript
// Before (WRONG):
const assignments = await fetch(`${CANVAS_BASE_URL}/api/v1/courses/${courseId}/assignments`);
const data = await assignments.json();

// After (CORRECT):
const assignments = await canvasClient.fetchAllPages<CanvasAssignment>(
  `/api/v1/courses/${courseId}/assignments`,
  { 'include[]': 'submission_summary' }
);
```

See: [Canvas API Pagination Prevention Guide](../canvas-api-pagination-prevention.md)
```

### Direct Fetch Issue Template

```markdown
**Direct Fetch Call Detected:**

Canvas API calls should not use direct `fetch()` in route handlers.
This bypasses centralized pagination and error handling.

**Fix:** Move to `src/lib/canvas.ts` or use existing functions:

```typescript
// This should be in src/lib/canvas.ts:
export async function fetchThingFromCanvas() {
  return canvasClient.fetchAllPages(...)
}

// Then use in route:
import { fetchThingFromCanvas } from '@/lib/canvas';

export async function GET() {
  return NextResponse.json(await fetchThingFromCanvas());
}
```
```

### Missing Tests Template

```markdown
**Canvas API Tests Missing:**

Canvas API code must include integration tests verifying:
- ✅ Data retrieval with 100+ items works
- ✅ Multiple pagination requests are made
- ✅ All items are returned (not just first page)
- ✅ Error cases are handled

Suggested test file: `src/lib/__tests__/canvas.integration.test.ts`

See: [Canvas API Testing Guide](../canvas-api-pagination-testing-guide.md)
```

---

## When to Use "Request Changes"

Request changes (don't approve) if:

1. **Pagination not handled** - Data will be truncated for 50+ items
2. **Direct fetch used** - Bypasses centralized client
3. **No error handling** - Raw API errors exposed
4. **Untyped** - API responses don't have TypeScript types
5. **No tests** - Can't verify behavior

When to use "Approve with Comments" (approve but note improvements):

1. Documentation could be better
2. Tests could be more comprehensive
3. Performance could be optimized (but works correctly)

---

## Approver Responsibilities

As an approver of Canvas API code, you're responsible for:

1. **Preventing pagination bugs** - These cause data loss
2. **Enforcing centralization** - Scattered logic is hard to maintain
3. **Requiring tests** - Canvas APIs must be tested with 100+ item datasets
4. **Type safety** - TypeScript prevents runtime errors

**Remember:** A pagination bug in Canvas API code means teachers lose assignment data. Be thorough.

---

## Related Documentation

- [Canvas API Pagination Prevention Strategies](./canvas-api-pagination-prevention.md)
- [Canvas API Testing Guide](./canvas-api-pagination-testing-guide.md)
- [Canvas API Client Implementation](../../lib/canvas.ts)
