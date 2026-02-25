# Canvas API Pagination Documentation Index

This directory contains comprehensive documentation for preventing Canvas API pagination bugs.

## Quick Navigation

### I need to understand the Canvas API pagination issue
→ Start with **README-CANVAS-PAGINATION.md**
- Bug overview and impact
- Quick start patterns
- Common scenarios

### I'm implementing Canvas API code
1. Read: **README-CANVAS-PAGINATION.md** - "Quick Start" section
2. Read: **canvas-api-pagination-prevention.md** - "Prevention Strategy 2"
3. Implement: Use `canvasClient.fetchAllPages()` pattern
4. Test: Follow **canvas-api-pagination-testing-guide.md** - "Part 2"

### I'm reviewing Canvas API code
→ Use **CANVAS_API_REVIEW_CHECKLIST.md**
- 10-point checklist for Canvas API changes
- Red flags and approved patterns
- Copy/paste review comment templates

### I'm writing tests for Canvas API code
→ Read **canvas-api-pagination-testing-guide.md**
- Part 1: Unit tests for pagination logic
- Part 2: Integration tests with mock Canvas
- Part 3: Route handler tests
- Part 4: Regression tests
- Part 5: Manual testing procedures
- Part 6: Test configuration and CI/CD

### I found or fixed a Canvas API pagination bug
1. Read: **canvas-api-pagination-prevention.md** - "Prevention Strategy 5"
2. Read: **canvas-api-pagination-testing-guide.md** - "Part 4"
3. Add regression test to prevent recurrence
4. Document the fix and lessons learned

## File Overview

### 📋 README-CANVAS-PAGINATION.md (464 lines)
**Navigation and overview document**
- Directory structure guide
- Quick start patterns (correct vs wrong)
- Workflow for making Canvas API changes
- Common scenarios with code examples
- Troubleshooting guide
- Learning path by role
- Canvas API concepts explained

**Best for:** Getting oriented, understanding the big picture

### 🛡️ canvas-api-pagination-prevention.md (581 lines)
**Prevention strategies and best practices**
- Bug overview and impact
- Strategy 1: Code review checklist
- Strategy 2: Centralized Canvas client pattern
- Strategy 3: Integration test suggestions
- Strategy 4: Best practices and architecture
- Strategy 5: Monitoring and error handling
- Quick reference summary table

**Best for:** Learning how to implement Canvas API calls correctly

### 🧪 canvas-api-pagination-testing-guide.md (754 lines)
**Practical testing strategies with code examples**
- Unit tests for Link header parsing (5 test cases)
- Unit tests for query parameters (4 test cases)
- Integration tests for full pagination flow (6 test cases)
- Route handler tests (2 test cases)
- Regression tests (3 test cases)
- Manual testing procedures (3 scenarios)
- Jest configuration and CI/CD setup
- Ready-to-copy test code

**Best for:** Writing comprehensive tests

### ✅ CANVAS_API_REVIEW_CHECKLIST.md (526 lines)
**Code review checklist for Canvas API changes**
- Quick assessment flow
- 10-point review checklist
- Red flags for each item
- Approved code patterns
- Decision flow diagram
- Copy/paste review comment templates
- Approver responsibilities

**Best for:** Reviewing Canvas API code in pull requests

## Key Files Referenced

| File | Purpose |
|------|---------|
| `src/lib/canvas.ts` | Canvas API client with pagination support |
| `src/lib/tools/canvas.ts` | Agent-callable Canvas operations |
| `src/app/api/courses/route.ts` | Courses endpoint |
| `src/app/api/courses/[courseId]/assignments/route.ts` | Assignments endpoint |

## The Bug in One Sentence

API routes fetched Canvas data with `per_page=100` but didn't follow pagination Link headers, so courses with 100+ assignments only showed the first 100.

## The Fix in One Sentence

Use `canvasClient.fetchAllPages()` which automatically follows Canvas Link headers to retrieve all pages.

## Prevention Strategies

| Strategy | Document | Purpose |
|----------|----------|---------|
| 1. Code Review | Prevention guide | Checklist for reviewing Canvas API calls |
| 2. Centralized Pattern | Prevention guide | Always use `canvasClient.fetchAllPages()` |
| 3. Test Cases | Testing guide | Integration tests for 100+ items |
| 4. Best Practices | Prevention guide | Architecture and rules for Canvas API |
| 5. Monitoring | Prevention guide | Logging and alerting for pagination issues |

## Testing Coverage

- **Unit tests:** Link header parsing and parameters (9 tests)
- **Integration tests:** Full pagination flow (9 tests)
- **Route tests:** API endpoints (2 tests)
- **Regression tests:** Preventing data truncation (3 tests)
- **Manual tests:** End-to-end verification (3 scenarios)
- **Mock helpers:** Canvas server simulation
- **CI/CD:** GitHub Actions integration

## Standards Enforced

✓ All Canvas API calls through `canvasClient`
✓ Collections use `fetchAllPages()`
✓ No direct `fetch()` calls in routes
✓ Pagination with Link headers
✓ TypeScript type safety
✓ Comprehensive error handling
✓ 95% test coverage for `src/lib/canvas.ts`
✓ Tests with 100+ item datasets

## Quick Decision Tree

```
Are you working on Canvas API code?
├─ NO → Use other documentation
└─ YES
   ├─ Implementing? → Prevention guide + Testing guide
   ├─ Reviewing? → Use the checklist
   ├─ Testing? → Testing guide
   └─ Debugging? → Prevention guide "Monitoring" + Testing guide "Part 4"
```

## Common Questions

**Q: What's the correct pattern?**
```typescript
const courses = await canvasClient.fetchAllPages<CanvasCourse>('/api/v1/courses');
```

**Q: What's the wrong pattern?**
```typescript
const response = await fetch(`${CANVAS_BASE_URL}/api/v1/courses`);
const courses = await response.json(); // Only gets first page!
```

**Q: How do I test pagination?**
Use the test patterns in the Testing guide - test with 100+ items to verify multiple API calls.

**Q: How do I review Canvas code?**
Use the 10-point checklist in CANVAS_API_REVIEW_CHECKLIST.md

**Q: What if I find a pagination bug?**
See Prevention guide - "Prevention Strategy 5: Monitoring & Error Handling"

## Document Statistics

- Total lines: 2,325
- Code examples: 50+
- Test cases: 27
- Diagrams: 3
- Tables: 8
- Checklists: 3

## Version

Created: 2026-02-03
Status: Active

## Related Issues

- Original bug: Assignment data truncated for courses with 50+ assignments
- Fix: Added pagination support to Canvas API client
- Type: Integration issue / Data integrity

---

For questions or updates, refer to the specific documentation files.
