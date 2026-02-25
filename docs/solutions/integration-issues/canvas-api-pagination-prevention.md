# Canvas API Pagination Bug - Prevention Strategies

## Bug Overview

**Status:** Fixed
**Severity:** High
**Impact:** Data truncation for courses with 50+ assignments

### The Problem

An API route was fetching Canvas data with `per_page=50` (later `per_page=100`) but **not following pagination links** in the response headers. Canvas API responses are paginated, meaning only the first page of results is returned by default. When a course has more than 50 assignments, the additional assignments were silently discarded, causing incomplete grading data.

**Example:**
- Course has 120 assignments
- Route fetches `/api/v1/courses/123/assignments?per_page=100`
- Only first 100 assignments returned
- Remaining 20 assignments never processed
- Teachers miss grading work for last 20 assignments

### The Solution

Implemented proper pagination handling by:
1. Following Canvas Link headers in API responses
2. Centralizing pagination logic in `canvasClient.fetchAllPages()`
3. Consolidating all Canvas API calls through the canvas client library

---

## Prevention Strategy 1: Code Review Checklist

When reviewing Canvas API calls, use this checklist to prevent pagination issues:

### Canvas API Call Review Checklist

```markdown
- [ ] Does this fetch call retrieve a collection of items (courses, assignments, submissions)?
- [ ] Is `fetchAllPages()` used for collection endpoints?
- [ ] If raw `fetch()` is used, is pagination handling implemented?
- [ ] Are Link headers being parsed for 'next' relationships?
- [ ] Is a loop following pagination links until null?
- [ ] Is per_page set to a reasonable number (50-100+)?
- [ ] Would this need to support >100 items in production?
- [ ] Are there integration tests verifying full dataset retrieval?
```

### Red Flags

Mark as **"Needs Revision"** if you see:

- Direct `fetch()` calls to Canvas endpoints without pagination logic
- Hardcoded `per_page` values that are too small
- No Loop consuming `Link` header's `next` relationship
- Assumptions that "first page" is sufficient
- No tests verifying behavior with 100+ items

### Approved Pattern

```typescript
// GOOD - Uses centralized client
const assignments = await canvasClient.fetchAllPages<CanvasAssignment>(
  `/api/v1/courses/${courseId}/assignments`,
  { 'include[]': 'submission_summary' }
);

// NOT OK - Direct fetch without pagination
const response = await fetch(
  `${CANVAS_BASE_URL}/api/v1/courses/${courseId}/assignments?per_page=50`,
  { headers: { Authorization: `Bearer ${token}` } }
);
const assignments = await response.json(); // Only first 50!
```

---

## Prevention Strategy 2: Centralized Canvas Client Pattern

**Never make direct fetch calls to Canvas in route handlers.** Use the centralized `canvasClient` from `src/lib/canvas.ts`.

### Why Centralization Matters

1. **Single Source of Truth:** Pagination logic in one place
2. **Consistency:** All calls handle Link headers identically
3. **Maintainability:** Bug fixes apply globally
4. **Testability:** Client can be mocked/tested independently
5. **Future Enhancements:** Caching, retry logic, rate limiting can be added once

### Correct Implementation

**File:** `/Users/jdec/Documents/boss-battle-grader/src/lib/canvas.ts`

The `CanvasClient` class provides:

```typescript
// For any collection endpoint, ALWAYS use fetchAllPages
async fetchAllPages<T>(endpoint: string, params: Record<string, string> = {}): Promise<T[]>

// Usage examples:
const courses = await canvasClient.fetchAllPages<CanvasCourse>('/api/v1/courses', {...});
const assignments = await canvasClient.fetchAllPages<CanvasAssignment>(
  `/api/v1/courses/${courseId}/assignments`,
  { 'include[]': 'submission_summary' }
);
const submissions = await canvasClient.fetchAllPages<CanvasSubmission>(
  `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`,
  { 'include[]': 'user,submission_comments' }
);
```

### Key Implementation Details

**Pagination Logic (in canvasClient.fetchAllPages):**

```typescript
async fetchAllPages<T>(endpoint: string, params: Record<string, string> = {}): Promise<T[]> {
  const allData: T[] = [];
  const queryParams = new URLSearchParams({ per_page: '100', ...params });
  let url: string | null = `${endpoint}?${queryParams}`;

  // Loop through all pages
  while (url) {
    const { data, linkHeader } = await this.fetch<T[]>(url);
    allData.push(...data);
    url = getNextPageUrl(linkHeader); // Extract 'next' link or null if last page
  }

  return allData;
}
```

**Link Header Parsing:**

```typescript
// Canvas returns Link headers like:
// Link: <url?page=2>; rel="next", <url?page=1>; rel="prev", <url?page=3>; rel="last"

function getNextPageUrl(linkHeader: string | null): string | null {
  const links = parseLinkHeader(linkHeader);
  const nextLink = links.find((link) => link.rel === 'next');
  return nextLink?.url ?? null;
}

function parseLinkHeader(header: string | null): LinkHeader[] {
  if (!header) return [];
  const links: LinkHeader[] = [];
  const parts = header.split(',');
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match) {
      links.push({ url: match[1], rel: match[2] });
    }
  }
  return links;
}
```

### Avoiding Duplication

**Before (Anti-pattern - NOT OK):**
```typescript
// In route handler - duplicate pagination logic
export async function GET(request: Request, { params }: any) {
  const allAssignments: unknown[] = [];
  let url: string | null = `${CANVAS_BASE_URL}/api/v1/courses/${courseId}/assignments?per_page=100`;

  while (url) {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const assignments = await response.json();
    allAssignments.push(...assignments);
    url = getNextPageUrl(response.headers.get('Link'));
  }
  return NextResponse.json(allAssignments);
}
```

**After (Correct pattern - OK):**
```typescript
// In route handler - delegates to client
import { canvasClient } from '@/lib/canvas';

export async function GET(request: Request, { params }: any) {
  const { courseId } = await params;
  const assignments = await canvasClient.fetchAllPages<CanvasAssignment>(
    `/api/v1/courses/${courseId}/assignments`,
    { 'include[]': 'submission_summary' }
  );
  return NextResponse.json(assignments);
}
```

---

## Prevention Strategy 3: Integration Tests

### Test Case: Verify Full Dataset Retrieval for Large Collections

**Scenario:** A course has 100+ assignments. The system must retrieve ALL assignments, not just the first page.

**Test File:** `src/lib/__tests__/canvas.integration.test.ts`

```typescript
import { canvasClient } from '@/lib/canvas';
import type { CanvasAssignment } from '@/types';

describe('Canvas API - Pagination Integration Tests', () => {
  describe('fetchAllPages', () => {
    it('should retrieve all assignments for course with 100+ assignments', async () => {
      // Arrange
      const courseId = 12345; // Test course with known large assignment count

      // Act
      const assignments = await canvasClient.fetchAllPages<CanvasAssignment>(
        `/api/v1/courses/${courseId}/assignments`,
        { 'include[]': 'submission_summary' }
      );

      // Assert
      expect(assignments.length).toBeGreaterThanOrEqual(100);

      // Verify we have diverse assignment data (not just first page duplicated)
      const assignmentIds = assignments.map(a => a.id);
      const uniqueIds = new Set(assignmentIds);
      expect(uniqueIds.size).toBe(assignments.length); // All IDs are unique

      // Verify assignments are spread across pages
      // (First assignment should have lower ID than last assignment in typical scenarios)
      const firstId = Math.min(...assignmentIds);
      const lastId = Math.max(...assignmentIds);
      expect(lastId).toBeGreaterThan(firstId);
    });

    it('should retrieve all submissions for assignment with 100+ student submissions', async () => {
      // Arrange
      const courseId = 12345;
      const assignmentId = 54321;

      // Act
      const submissions = await canvasClient.fetchAllPages<CanvasSubmission>(
        `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`,
        { 'include[]': 'user' }
      );

      // Assert
      expect(submissions.length).toBeGreaterThanOrEqual(100);

      // Verify all submissions have unique user IDs
      const userIds = submissions.map(s => s.user_id);
      const uniqueUsers = new Set(userIds);
      expect(uniqueUsers.size).toBe(submissions.length);
    });

    it('should handle empty results gracefully', async () => {
      // Arrange
      const courseId = 99999; // Non-existent or empty course

      // Act & Assert - should not throw
      const assignments = await canvasClient.fetchAllPages<CanvasAssignment>(
        `/api/v1/courses/${courseId}/assignments`
      );

      expect(Array.isArray(assignments)).toBe(true);
      expect(assignments.length).toBeGreaterThanOrEqual(0);
    });

    it('should maintain correct pagination when per_page is overridden', async () => {
      // Arrange
      const courseId = 12345;

      // Act - Request smaller pages to force multiple pagination iterations
      const assignments = await canvasClient.fetchAllPages<CanvasAssignment>(
        `/api/v1/courses/${courseId}/assignments`,
        { 'include[]': 'submission_summary', 'per_page': '10' }
      );

      // Assert - Should still get all assignments despite smaller page size
      expect(assignments.length).toBeGreaterThan(10); // Multiple pages required
    });

    it('should follow next link in Link header correctly', async () => {
      // Arrange - Spy on fetch calls
      const fetchSpy = jest.spyOn(global, 'fetch');
      const courseId = 12345;

      // Mock responses with Link headers
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 1, name: 'Assignment 1' }],
          headers: new Map([
            ['Link', '<https://canvas.example.com/api/v1/courses/12345/assignments?page=2>; rel="next"'],
            ['Content-Type', 'application/json'],
          ]),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 2, name: 'Assignment 2' }],
          headers: new Map([ // No 'next' link = last page
            ['Content-Type', 'application/json'],
          ]),
        } as any);

      // Act
      const assignments = await canvasClient.fetchAllPages<CanvasAssignment>(
        `/api/v1/courses/${courseId}/assignments`
      );

      // Assert
      expect(fetchSpy).toHaveBeenCalledTimes(2); // Two fetch calls = two pages
      expect(assignments).toHaveLength(2);
      expect(assignments[0].id).toBe(1);
      expect(assignments[1].id).toBe(2);

      fetchSpy.mockRestore();
    });
  });
});
```

### Running Tests

```bash
# Run all Canvas integration tests
npm test -- canvas.integration.test.ts

# Run with coverage
npm test -- --coverage canvas.integration.test.ts

# Run specific test
npm test -- --testNamePattern="should retrieve all assignments"
```

### Test Environment Setup

For local testing, you can use environment variables:

```bash
# .env.test
CANVAS_BASE_URL=https://canvas.example.com
CANVAS_API_TOKEN=your-test-token-here
```

Or mock the Canvas API for unit tests that don't need real data:

```typescript
// Mock example for unit tests
jest.mock('@/lib/canvas', () => ({
  canvasClient: {
    fetchAllPages: jest.fn().mockResolvedValue([
      { id: 1, name: 'Assignment 1' },
      { id: 2, name: 'Assignment 2' },
      // ... up to 100+ items
    ]),
  },
}));
```

---

## Prevention Strategy 4: Best Practices for Canvas API Calls

### Principle: Centralize at the Boundary

Architecture principle: **All Canvas API interaction flows through `src/lib/canvas.ts`**

```
External API (Canvas) ← Boundary
↓
src/lib/canvas.ts (canvasClient) ← Centralized here
↓
src/lib/tools/canvas.ts (agent tool wrappers)
↓
src/app/api/routes (route handlers)
↓
Frontend (UI components)
```

### Rules

1. **Never import `fetch` for Canvas calls in route handlers**
   - Always use `canvasClient` from `src/lib/canvas.ts`

2. **Never hardcode pagination parameters in routes**
   - The client handles `per_page`, `page`, and Link header following
   - Routes only specify custom query parameters via the `params` object

3. **Always use `fetchAllPages()` for collection endpoints**
   - `/api/v1/courses` → `fetchAllPages<CanvasCourse>()`
   - `/api/v1/courses/{id}/assignments` → `fetchAllPages<CanvasAssignment>()`
   - `/api/v1/courses/{id}/assignments/{id}/submissions` → `fetchAllPages<CanvasSubmission>()`

4. **Document when using single-item methods**
   - `canvasClient.get<T>()` - Single fetch, no pagination
   - `canvasClient.post<T>()` - Create resource
   - `canvasClient.put<T>()` - Update resource
   - `canvasClient.delete()` - Delete resource

### Anti-patterns (DO NOT)

```typescript
// ❌ DON'T: Raw fetch in route handler
export async function GET() {
  const response = await fetch(`${CANVAS_BASE_URL}/api/v1/courses?per_page=50`);
  const data = await response.json();
  return NextResponse.json(data);
}

// ❌ DON'T: Duplicate pagination logic
export async function GET() {
  const allData = [];
  let url = `${CANVAS_BASE_URL}/api/v1/assignments?per_page=100`;
  while (url) {
    const response = await fetch(url);
    allData.push(...await response.json());
    url = getNextPageUrl(response.headers.get('Link'));
  }
  return NextResponse.json(allData);
}

// ❌ DON'T: Assume first page is complete
export async function GET() {
  const response = await fetch(
    `${CANVAS_BASE_URL}/api/v1/courses/123/assignments?per_page=100`
  );
  return NextResponse.json(await response.json()); // Missing 21-Nth assignments!
}
```

### Correct Patterns

```typescript
// ✅ DO: Use canvasClient for collections
import { canvasClient, fetchAssignments } from '@/lib/canvas';

export async function GET(request: Request, { params }: any) {
  const { courseId } = await params;
  const result = await fetchAssignments(parseInt(courseId));
  if (!result.success) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result.data);
}

// ✅ DO: Use canvasClient.fetchAllPages directly when needed
import { canvasClient } from '@/lib/canvas';

export async function GET() {
  try {
    const courses = await canvasClient.fetchAllPages<CanvasCourse>(
      '/api/v1/courses',
      {
        'include[]': 'total_students',
        'state[]': 'available',
        'enrollment_type': 'teacher',
      }
    );
    return NextResponse.json(courses);
  } catch (error) {
    console.error('Failed to fetch courses:', error);
    return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 });
  }
}

// ✅ DO: Document API response types with comments
interface CanvasAssignment {
  id: number;
  name: string;
  due_at: string | null;
  points_possible: number;
  submission_summary: {
    graded: number;
    ungraded: number;
    not_submitted: number;
  };
  // ... other fields
}

export async function fetchAllAssignments(courseId: number) {
  return canvasClient.fetchAllPages<CanvasAssignment>(
    `/api/v1/courses/${courseId}/assignments`,
    {
      'include[]': 'submission_summary',
    }
  );
}
```

---

## Prevention Strategy 5: Monitoring & Error Handling

### Logging Pagination Information

Add logging to detect pagination issues in production:

```typescript
// Enhanced logging in canvasClient
async fetchAllPages<T>(endpoint: string, params: Record<string, string> = {}): Promise<T[]> {
  const allData: T[] = [];
  const queryParams = new URLSearchParams({ per_page: '100', ...params });
  let url: string | null = `${endpoint}?${queryParams}`;
  let pageCount = 0;

  while (url) {
    pageCount++;
    const { data, linkHeader } = await this.fetch<T[]>(url);
    allData.push(...data);

    // Log pagination metrics
    console.debug(`[Canvas] Fetched page ${pageCount}`, {
      endpoint,
      itemsInPage: data.length,
      totalItemsSoFar: allData.length,
      hasNextPage: !!getNextPageUrl(linkHeader),
    });

    url = getNextPageUrl(linkHeader);
  }

  console.info(`[Canvas] Complete fetch for ${endpoint}`, {
    pageCount,
    totalItems: allData.length,
  });

  return allData;
}
```

### Alert Conditions

Monitor for these warning signs:

1. **Incomplete Results:** Response count stops at exactly 50, 100, etc.
2. **Slow Pagination:** Pages take >5 seconds per page
3. **API Rate Limiting:** 429 status codes
4. **Malformed Link Headers:** Parsing failures

```typescript
if (allData.length === 100 && !getNextPageUrl(linkHeader)) {
  console.warn(
    '[Canvas] Result exactly equals page size. May indicate truncation.',
    { endpoint, pageSize: 100, totalItems: allData.length }
  );
}
```

---

## Summary: Quick Reference

| Component | Location | Purpose |
|-----------|----------|---------|
| Canvas Client | `src/lib/canvas.ts` | Centralized API communication with pagination |
| Client Methods | `fetchAllPages<T>()` | Retrieves full collections with pagination |
| Link Parser | `parseLinkHeader()` | Extracts pagination links from responses |
| Route Handlers | `src/app/api/**/*.ts` | Call canvasClient methods, no direct fetch |
| Tool Wrappers | `src/lib/tools/canvas.ts` | Agent-callable interface to canvasClient |
| Tests | `src/lib/__tests__/` | Integration tests for 100+ item scenarios |

### Checklist Before Deploying Canvas API Changes

- [ ] Using `canvasClient` centralized library?
- [ ] Collections use `fetchAllPages()`?
- [ ] No direct `fetch()` calls to Canvas?
- [ ] Tested with 100+ item dataset?
- [ ] Link headers properly parsed in logs?
- [ ] Error handling includes pagination context?
- [ ] Code review approves pagination approach?

---

## Related Files

- **Canvas Client Implementation:** `/Users/jdec/Documents/boss-battle-grader/src/lib/canvas.ts`
- **Canvas Tools (Agents):** `/Users/jdec/Documents/boss-battle-grader/src/lib/tools/canvas.ts`
- **Assignment Route Handler:** `/Users/jdec/Documents/boss-battle-grader/src/app/api/courses/[courseId]/assignments/route.ts`
- **Courses Route Handler:** `/Users/jdec/Documents/boss-battle-grader/src/app/api/courses/route.ts`

---

## Additional Resources

- [Canvas API Pagination Documentation](https://canvas.instructure.com/doc/api/)
- [RFC 8288 - Web Linking (Link Headers)](https://tools.ietf.org/html/rfc8288)
- [REST API Best Practices - Pagination](https://www.notion.so/Pagination-in-REST-APIs-92e3d890dd914151bd2787a35dd11b10)
