# Canvas API Pagination - Testing Guide

## Overview

This guide provides practical testing strategies to prevent Canvas API pagination bugs from being deployed. It covers unit tests, integration tests, and manual testing approaches.

---

## Part 1: Unit Tests - Pagination Logic

### Test 1: Link Header Parsing

**Test File:** `src/lib/__tests__/canvas-pagination.test.ts`

```typescript
import { parseLinkHeader, getNextPageUrl } from '@/lib/canvas';

describe('Link Header Parsing', () => {
  describe('parseLinkHeader', () => {
    it('should parse single link', () => {
      const header = '<https://api.example.com/data?page=2>; rel="next"';
      const links = parseLinkHeader(header);

      expect(links).toHaveLength(1);
      expect(links[0]).toEqual({
        url: 'https://api.example.com/data?page=2',
        rel: 'next',
      });
    });

    it('should parse multiple links', () => {
      const header =
        '<https://api.example.com/data?page=2>; rel="next", <https://api.example.com/data?page=1>; rel="prev", <https://api.example.com/data?page=10>; rel="last"';
      const links = parseLinkHeader(header);

      expect(links).toHaveLength(3);
      expect(links.map(l => l.rel)).toEqual(['next', 'prev', 'last']);
    });

    it('should handle header without links', () => {
      const links = parseLinkHeader(null);
      expect(links).toHaveLength(0);
    });

    it('should handle empty string', () => {
      const links = parseLinkHeader('');
      expect(links).toHaveLength(0);
    });

    it('should handle malformed links gracefully', () => {
      const header = '<invalid>; malformed, <https://api.example.com>; rel="next"';
      const links = parseLinkHeader(header);

      // Should parse the valid one and skip invalid
      expect(links.length).toBeGreaterThanOrEqual(1);
      expect(links.some(l => l.rel === 'next')).toBe(true);
    });
  });

  describe('getNextPageUrl', () => {
    it('should extract next page URL', () => {
      const header =
        '<https://api.example.com/data?page=2>; rel="next", <https://api.example.com/data?page=10>; rel="last"';
      const nextUrl = getNextPageUrl(header);

      expect(nextUrl).toBe('https://api.example.com/data?page=2');
    });

    it('should return null when no next link', () => {
      const header = '<https://api.example.com/data?page=1>; rel="prev"';
      const nextUrl = getNextPageUrl(header);

      expect(nextUrl).toBeNull();
    });

    it('should return null for null header', () => {
      const nextUrl = getNextPageUrl(null);
      expect(nextUrl).toBeNull();
    });

    it('should prioritize next over other relations', () => {
      const header =
        '<https://api.example.com/data?page=1>; rel="prev", <https://api.example.com/data?page=2>; rel="next", <https://api.example.com/data?page=10>; rel="last"';
      const nextUrl = getNextPageUrl(header);

      expect(nextUrl).toBe('https://api.example.com/data?page=2');
    });
  });
});
```

### Test 2: Query Parameter Handling

**In same file:** `src/lib/__tests__/canvas-pagination.test.ts`

```typescript
describe('Query Parameter Handling', () => {
  describe('fetchAllPages parameter setup', () => {
    it('should default to per_page=100', async () => {
      const mockFetch = jest.fn();
      global.fetch = mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
        headers: new Map([['Content-Type', 'application/json']]),
      } as any);

      await canvasClient.fetchAllPages('/test');

      const callUrl = new URL(mockFetch.mock.calls[0][0]);
      expect(callUrl.searchParams.get('per_page')).toBe('100');

      mockFetch.mockRestore();
    });

    it('should allow per_page override', async () => {
      const mockFetch = jest.fn();
      global.fetch = mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
        headers: new Map([['Content-Type', 'application/json']]),
      } as any);

      await canvasClient.fetchAllPages('/test', { per_page: '50' });

      const callUrl = new URL(mockFetch.mock.calls[0][0]);
      expect(callUrl.searchParams.get('per_page')).toBe('50');

      mockFetch.mockRestore();
    });

    it('should merge custom params with pagination params', async () => {
      const mockFetch = jest.fn();
      global.fetch = mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
        headers: new Map([['Content-Type', 'application/json']]),
      } as any);

      await canvasClient.fetchAllPages('/test', {
        'include[]': 'submission_summary',
        'state[]': 'available',
      });

      const callUrl = new URL(mockFetch.mock.calls[0][0]);
      expect(callUrl.searchParams.get('per_page')).toBe('100');
      expect(callUrl.searchParams.get('include[]')).toBe('submission_summary');
      expect(callUrl.searchParams.get('state[]')).toBe('available');

      mockFetch.mockRestore();
    });
  });
});
```

---

## Part 2: Integration Tests - Full Pagination Flow

### Setup: Mock Canvas Server

Create a test helper for mocking paginated responses:

**File:** `src/lib/__tests__/canvas-test-helpers.ts`

```typescript
export function createPaginatedResponse<T>(
  items: T[],
  pageSize: number,
  currentPage: number
): {
  data: T[];
  linkHeader: string | null;
} {
  const totalPages = Math.ceil(items.length / pageSize);
  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, items.length);
  const pageItems = items.slice(startIdx, endIdx);

  const links: string[] = [];

  if (currentPage > 1) {
    links.push(`<endpoint?page=${currentPage - 1}>; rel="prev"`);
  }

  if (currentPage < totalPages) {
    links.push(`<endpoint?page=${currentPage + 1}>; rel="next"`);
  }

  links.push(`<endpoint?page=1>; rel="first"`);
  links.push(`<endpoint?page=${totalPages}>; rel="last"`);

  return {
    data: pageItems,
    linkHeader: links.length > 0 ? links.join(', ') : null,
  };
}

export function mockCanvasAPICall(
  totalItems: number = 150,
  pageSize: number = 50,
  itemFactory: (index: number) => any = (i) => ({ id: i, name: `Item ${i}` })
): jest.Mock {
  const allItems = Array.from({ length: totalItems }, (_, i) => itemFactory(i));
  let currentPage = 1;

  return jest.fn(async (url: string) => {
    const urlObj = new URL(url, 'https://canvas.example.com');
    const page = parseInt(urlObj.searchParams.get('page') || '1');
    currentPage = page;

    const { data, linkHeader } = createPaginatedResponse(allItems, pageSize, currentPage);

    return {
      ok: true,
      status: 200,
      json: async () => data,
      headers: new Map([
        ['Link', linkHeader || ''],
        ['Content-Type', 'application/json'],
      ]),
    } as any;
  });
}
```

### Test 3: Fetch All Pages - Multiple Pages

**File:** `src/lib/__tests__/canvas.integration.test.ts`

```typescript
import { canvasClient } from '@/lib/canvas';
import { mockCanvasAPICall } from './canvas-test-helpers';

describe('Canvas Client - Full Pagination Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch all items across 3 pages', async () => {
    const mockFetch = mockCanvasAPICall(150, 50); // 3 pages of 50 items
    global.fetch = mockFetch as any;

    const items = await canvasClient.fetchAllPages('/api/v1/courses/123/assignments');

    expect(items).toHaveLength(150);
    expect(mockFetch).toHaveBeenCalledTimes(3);

    // Verify items are in order
    expect(items[0]).toEqual({ id: 0, name: 'Item 0' });
    expect(items[49]).toEqual({ id: 49, name: 'Item 49' });
    expect(items[50]).toEqual({ id: 50, name: 'Item 50' });
    expect(items[149]).toEqual({ id: 149, name: 'Item 149' });

    mockFetch.mockRestore();
  });

  it('should fetch all items when count is exactly divisible by page size', async () => {
    const mockFetch = mockCanvasAPICall(200, 50); // Exactly 4 pages
    global.fetch = mockFetch as any;

    const items = await canvasClient.fetchAllPages('/api/v1/courses/123/assignments');

    expect(items).toHaveLength(200);
    expect(mockFetch).toHaveBeenCalledTimes(4);

    mockFetch.mockRestore();
  });

  it('should fetch items when count is not divisible by page size', async () => {
    const mockFetch = mockCanvasAPICall(175, 50); // 4 pages: 50+50+50+25
    global.fetch = mockFetch as any;

    const items = await canvasClient.fetchAllPages('/api/v1/courses/123/assignments');

    expect(items).toHaveLength(175);
    expect(mockFetch).toHaveBeenCalledTimes(4);

    mockFetch.mockRestore();
  });

  it('should handle single page of results', async () => {
    const mockFetch = mockCanvasAPICall(25, 50); // Less than one page
    global.fetch = mockFetch as any;

    const items = await canvasClient.fetchAllPages('/api/v1/courses/123/assignments');

    expect(items).toHaveLength(25);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    mockFetch.mockRestore();
  });

  it('should handle empty result set', async () => {
    const mockFetch = mockCanvasAPICall(0, 50); // No items
    global.fetch = mockFetch as any;

    const items = await canvasClient.fetchAllPages('/api/v1/courses/123/assignments');

    expect(items).toHaveLength(0);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    mockFetch.mockRestore();
  });

  it('should handle very large datasets (1000+ items)', async () => {
    const mockFetch = mockCanvasAPICall(1234, 100); // 13 pages of 100
    global.fetch = mockFetch as any;

    const items = await canvasClient.fetchAllPages('/api/v1/courses/123/assignments');

    expect(items).toHaveLength(1234);
    expect(mockFetch).toHaveBeenCalledTimes(13);

    mockFetch.mockRestore();
  });
});
```

### Test 4: Different Per-Page Sizes

**Same file:** `src/lib/__tests__/canvas.integration.test.ts`

```typescript
describe('Canvas Client - Per-Page Variations', () => {
  it('should handle per_page=50 correctly', async () => {
    const mockFetch = mockCanvasAPICall(150, 50);
    global.fetch = mockFetch as any;

    const items = await canvasClient.fetchAllPages('/test', { per_page: '50' });

    expect(items).toHaveLength(150);
    expect(mockFetch).toHaveBeenCalledTimes(3);

    mockFetch.mockRestore();
  });

  it('should handle per_page=100 correctly', async () => {
    const mockFetch = mockCanvasAPICall(350, 100);
    global.fetch = mockFetch as any;

    const items = await canvasClient.fetchAllPages('/test', { per_page: '100' });

    expect(items).toHaveLength(350);
    expect(mockFetch).toHaveBeenCalledTimes(4);

    mockFetch.mockRestore();
  });

  it('should handle small per_page values (forces many pages)', async () => {
    const mockFetch = mockCanvasAPICall(100, 10); // 10 pages of 10
    global.fetch = mockFetch as any;

    const items = await canvasClient.fetchAllPages('/test', { per_page: '10' });

    expect(items).toHaveLength(100);
    expect(mockFetch).toHaveBeenCalledTimes(10);

    mockFetch.mockRestore();
  });
});
```

---

## Part 3: Route Handler Tests

### Test 5: Assignment Route Pagination

**File:** `src/app/api/courses/__tests__/assignments-route.test.ts`

```typescript
import { GET } from '../[courseId]/assignments/route';
import { canvasClient } from '@/lib/canvas';

jest.mock('@/lib/canvas');

describe('Assignments Route - GET', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return all assignments for course', async () => {
    const mockAssignments = Array.from({ length: 120 }, (_, i) => ({
      id: i,
      name: `Assignment ${i}`,
      due_at: new Date().toISOString(),
      points_possible: 100,
    }));

    (canvasClient.fetchAllPages as jest.Mock).mockResolvedValueOnce(mockAssignments);

    const mockRequest = new Request('http://localhost:3000/api/courses/123/assignments');
    const response = await GET(mockRequest, {
      params: Promise.resolve({ courseId: '123' }),
    });

    const data = await response.json();
    expect(data).toHaveLength(120);
    expect(canvasClient.fetchAllPages).toHaveBeenCalledWith(
      '/api/v1/courses/123/assignments',
      expect.objectContaining({
        'include[]': 'submission_summary',
      })
    );
  });

  it('should handle errors gracefully', async () => {
    (canvasClient.fetchAllPages as jest.Mock).mockRejectedValueOnce(
      new Error('Canvas API error')
    );

    const mockRequest = new Request('http://localhost:3000/api/courses/123/assignments');
    const response = await GET(mockRequest, {
      params: Promise.resolve({ courseId: '123' }),
    });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });
});
```

---

## Part 4: Regression Tests - Preventing Known Issues

### Test 6: Never Truncate at Page Size Boundary

This test specifically prevents the original bug from recurring:

**File:** `src/lib/__tests__/canvas.regression.test.ts`

```typescript
describe('Canvas API - Regression Tests', () => {
  describe('Pagination Bug Prevention', () => {
    it('REGRESSION: should not truncate at per_page=50 boundary', async () => {
      // Original bug: returned only 50 items for course with 100+
      const mockFetch = mockCanvasAPICall(100, 50);
      global.fetch = mockFetch as any;

      const items = await canvasClient.fetchAllPages('/api/v1/courses/123/assignments');

      // Should have ALL 100 items, not just first 50
      expect(items.length).toBe(100);
      expect(items.length).not.toBe(50);

      // Verify we made multiple calls (not just first page)
      expect(mockFetch).toHaveBeenCalledTimes(2);

      mockFetch.mockRestore();
    });

    it('REGRESSION: should not truncate at per_page=100 boundary', async () => {
      // Similar issue if per_page was 100
      const mockFetch = mockCanvasAPICall(101, 100);
      global.fetch = mockFetch as any;

      const items = await canvasClient.fetchAllPages('/api/v1/courses/123/assignments');

      // Must have ALL 101 items, not just 100
      expect(items.length).toBe(101);
      expect(items.length).not.toBe(100);

      // Must have made 2 calls to get the extra item on page 2
      expect(mockFetch).toHaveBeenCalledTimes(2);

      mockFetch.mockRestore();
    });

    it('REGRESSION: direct fetch without pagination should fail test', async () => {
      // This test would catch if someone re-introduced direct fetch
      const directFetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => Array.from({ length: 50 }, (_, i) => ({ id: i })),
        headers: new Map([['Content-Type', 'application/json']]),
      } as any);

      const result = await directFetch('/api/v1/courses/123/assignments?per_page=50');
      const data = await result.json();

      // This would only return 50 items - TEST SHOULD FAIL if this pattern is used
      expect(data.length).toBe(50);
      // This assertion should trigger alarm to reviewer
      console.warn(
        'ALERT: Direct fetch used instead of canvasClient.fetchAllPages(). This WILL cause data truncation!'
      );

      directFetch.mockRestore();
    });
  });
});
```

---

## Part 5: Manual Testing Procedures

### Manual Test 1: End-to-End with Real Canvas Instance

**Prerequisites:**
- Access to Canvas instance with test course
- Course has 120+ assignments
- Canvas API token configured in `.env`

**Steps:**

1. Start development server
   ```bash
   npm run dev
   ```

2. Open DevTools and set breakpoint in `canvasClient.fetchAllPages()`

3. Navigate to assignments view for test course

4. Verify breakpoint hits multiple times (3+ times for 120+ assignments with per_page=100)

5. Check Network tab:
   - Should see multiple API requests to `/api/v1/courses/.../assignments`
   - Each request should have `?page=1`, `?page=2`, etc.
   - Should NOT see single request with only first page

6. Verify final count:
   - Console should log total items
   - Should equal or exceed 120

### Manual Test 2: Monitor Pagination in DevTools

**Steps:**

1. Open DevTools → Network tab
2. Filter to Canvas API calls
3. Navigate to assignments list
4. Inspect each request:
   - Check `Link` response header exists
   - Verify `rel="next"` in header when more pages available
   - Last page should have NO `rel="next"`

**Expected:**
```
GET /api/v1/courses/123/assignments?page=1
  Response Header: Link: <...?page=2>; rel="next", <...?page=3>; rel="last"

GET /api/v1/courses/123/assignments?page=2
  Response Header: Link: <...?page=1>; rel="prev", <...?page=3>; rel="next"

GET /api/v1/courses/123/assignments?page=3
  Response Header: Link: <...?page=1>; rel="first", <...?page=2>; rel="prev"
  (No rel="next" - this is the last page)
```

### Manual Test 3: Performance Monitoring

**Monitor for:**

1. **Number of API calls:** Should be `ceil(totalItems / pageSize)`
   - 121 items at per_page=100 = 2 calls
   - 201 items at per_page=100 = 3 calls

2. **Response times:** Each page should be <2 seconds
   - If slowness detected, may indicate rate limiting

3. **Memory usage:** Should not spike with large datasets
   - 1000+ items shouldn't cause memory issues

4. **CPU usage:** Parsing should be near-instant

---

## Part 6: Test Configuration

### Jest Configuration

**File:** `jest.config.js` (partial)

```javascript
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts',
  ],
  setupFilesAfterEnv: ['<rootDir>/src/lib/__tests__/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/lib/canvas.ts',
    'src/app/api/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // Canvas pagination is critical - require 95% coverage
    './src/lib/canvas.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
};
```

### Setup File

**File:** `src/lib/__tests__/setup.ts`

```typescript
// Global test setup
beforeAll(() => {
  // Suppress console during tests unless needed
  if (!process.env.VERBOSE_TESTS) {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
  }
});

afterEach(() => {
  // Clean up all mocks between tests
  jest.clearAllMocks();
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- canvas.integration.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should fetch all"

# Run tests in watch mode
npm test -- --watch

# Update snapshots if needed
npm test -- --updateSnapshot

# Check coverage thresholds
npm test -- --coverage --coverageReporters=text-summary
```

---

## Part 7: Continuous Integration Checks

### Pre-Commit Hook (Husky)

**File:** `.husky/pre-commit`

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run Canvas pagination tests before commit
npm test -- canvas.integration.test.ts canvas.regression.test.ts

if [ $? -ne 0 ]; then
  echo "❌ Canvas pagination tests failed. Fix before committing."
  exit 1
fi
```

### Pre-Push Hook

**File:** `.husky/pre-push`

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Full test suite including coverage
npm test -- --coverage --testPathPattern="canvas"

if [ $? -ne 0 ]; then
  echo "❌ Canvas tests or coverage check failed."
  exit 1
fi
```

### GitHub Actions Workflow

**File:** `.github/workflows/canvas-api-tests.yml`

```yaml
name: Canvas API Pagination Tests

on: [pull_request, push]

jobs:
  canvas-pagination:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run Canvas pagination tests
        run: npm test -- canvas.integration.test.ts canvas.regression.test.ts --coverage

      - name: Check coverage thresholds
        run: npm test -- --coverage --coverageReporters=text --testPathPattern="canvas"

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          flags: canvas-api
```

---

## Summary: Testing Checklist

Before deploying Canvas API changes:

- [ ] Unit tests pass: `npm test -- canvas-pagination.test.ts`
- [ ] Integration tests pass: `npm test -- canvas.integration.test.ts`
- [ ] Regression tests pass: `npm test -- canvas.regression.test.ts`
- [ ] Route handler tests pass: `npm test -- assignments-route.test.ts`
- [ ] Coverage meets 95% threshold for `src/lib/canvas.ts`
- [ ] Manual test with 100+ item dataset completed
- [ ] No direct fetch calls in route handlers
- [ ] All API calls use `canvasClient.fetchAllPages()`
- [ ] Code review approved pagination pattern
- [ ] CI checks pass before merge

---

## Related Documentation

- [Canvas API Pagination Prevention Strategies](/docs/solutions/integration-issues/canvas-api-pagination-prevention.md)
- [Canvas API Documentation](https://canvas.instructure.com/doc/api/)
