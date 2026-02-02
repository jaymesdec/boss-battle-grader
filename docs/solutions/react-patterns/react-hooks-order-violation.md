---
title: "React Hooks Order Violation: useEffect After Early Returns"
date: 2026-02-02
category: react-patterns
tags:
  - react
  - hooks
  - rules-of-hooks
  - code-review
  - eslint
module: components
symptoms: "React error: 'Rendered fewer hooks than expected' or inconsistent component behavior between renders"
root_cause: "Placing useEffect, useState, or other hooks after early return statements violates the Rules of Hooks, which require hooks to be called in the same order on every render"
---

# React Hooks Order Violation: useEffect After Early Returns

## Problem

A component placed `useEffect` (or other hooks) after conditional early returns, causing React to throw "Rendered fewer hooks than expected" errors or exhibit undefined behavior.

## Root Cause

React's Rules of Hooks require that hooks are called in the **exact same order** on every render. When a hook is placed after an early return:

```tsx
// BROKEN: Hook order changes based on condition
function BrokenComponent({ data }) {
  if (!data) {
    return <Loading />;  // Early return BEFORE hooks
  }

  // This useEffect only runs when data exists
  // React sees different hook counts between renders
  useEffect(() => {
    fetchDetails(data.id);
  }, [data.id]);

  return <div>{data.name}</div>;
}
```

When `data` changes from `null` to a value:
1. **First render (data=null):** 0 hooks called, returns `<Loading />`
2. **Second render (data=value):** 1 hook called (useEffect)
3. **React error:** Hook count mismatch between renders

## Solution

**Move ALL hooks above ALL early returns:**

```tsx
// CORRECT: Hooks always called in same order
function FixedComponent({ data }) {
  // ALL hooks first, unconditionally
  useEffect(() => {
    if (data?.id) {
      fetchDetails(data.id);
    }
  }, [data?.id]);

  // Early returns AFTER all hooks
  if (!data) {
    return <Loading />;
  }

  return <div>{data.name}</div>;
}
```

## Prevention Checklist

### Before Every PR, Verify:

- [ ] **All hooks are at the top of the component** - before any `if`, `return`, or conditional logic
- [ ] **No hooks inside conditionals** - `if (condition) { useState() }` is always wrong
- [ ] **No hooks inside loops** - `items.map(() => { useEffect() })` is always wrong
- [ ] **ESLint rules-of-hooks is enabled and passing** - this catches most violations
- [ ] **Custom hooks follow the same rules** - hooks inside `useSomething()` must also be unconditional

### Component Structure Template

```tsx
function Component({ props }) {
  // === HOOKS SECTION (always runs) ===
  const [state, setState] = useState(initialValue);
  const memoizedValue = useMemo(() => compute(props), [props]);
  const callbackFn = useCallback(() => doThing(), []);

  useEffect(() => {
    // Guard logic INSIDE the effect, not outside
    if (!props.data) return;
    doSomething(props.data);
  }, [props.data]);

  // === EARLY RETURNS (after all hooks) ===
  if (loading) return <Spinner />;
  if (error) return <Error message={error} />;
  if (!data) return null;

  // === RENDER (after early returns) ===
  return <div>{/* component JSX */}</div>;
}
```

## Code Review Guidelines

### Red Flags to Catch

| Pattern | Problem | Fix |
|---------|---------|-----|
| `if (...) return` before any hook | Hook might not run | Move hooks above returns |
| `if (...) { useEffect(...) }` | Conditional hook call | Move condition inside hook |
| `data && useEffect(...)` | Short-circuit prevents hook | Always call hook, guard inside |
| Hook inside `.map()` or `.forEach()` | Loop-dependent hooks | Extract to child component |
| Hook in try/catch block | Exception might skip hook | Move hook outside try/catch |

### Questions to Ask During Review

1. "Can I trace a path through this component that skips a hook call?"
2. "If any prop changes from undefined to defined, do the same hooks run?"
3. "Is there any `return` statement above a hook?"

### Refactoring Patterns

**Pattern 1: Guard Inside Effect**
```tsx
// Instead of this:
if (userId) {
  useEffect(() => fetchUser(userId), [userId]);
}

// Do this:
useEffect(() => {
  if (!userId) return;  // Guard INSIDE
  fetchUser(userId);
}, [userId]);
```

**Pattern 2: Extract Conditional Rendering**
```tsx
// Instead of this:
function Parent({ items }) {
  return items.map(item => {
    useEffect(() => track(item.id), [item.id]);  // WRONG
    return <div key={item.id}>{item.name}</div>;
  });
}

// Do this:
function Parent({ items }) {
  return items.map(item => (
    <Child key={item.id} item={item} />  // Extract to child
  ));
}

function Child({ item }) {
  useEffect(() => track(item.id), [item.id]);  // CORRECT
  return <div>{item.name}</div>;
}
```

**Pattern 3: Null-Safe Dependencies**
```tsx
// Instead of:
if (data) {
  useEffect(() => process(data.id), [data.id]);
}

// Do this:
useEffect(() => {
  if (!data) return;
  process(data.id);
}, [data?.id]);  // Optional chaining in deps
```

## ESLint Configuration

Ensure `eslint-plugin-react-hooks` is properly configured:

```json
{
  "plugins": ["react-hooks"],
  "rules": {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

**Note:** The `rules-of-hooks` rule catches most violations, but it cannot detect all edge cases (especially in complex control flow). Manual review is still essential.

## Warning Signs in Development

1. **"Rendered fewer/more hooks than expected"** - Definite hooks order violation
2. **"React has detected a change in the order of Hooks"** - Same issue, different message
3. **Hooks work on first render but break on updates** - Likely conditional hook
4. **Effect runs unexpectedly or never runs** - May be after an early return

## Testing Strategy

When writing tests for components with hooks:

```tsx
describe('ComponentWithHooks', () => {
  it('renders correctly with null data', () => {
    // First render path
    render(<Component data={null} />);
    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  it('renders correctly when data arrives', () => {
    // Transition from null to value
    const { rerender } = render(<Component data={null} />);
    rerender(<Component data={{ id: 1, name: 'Test' }} />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('handles data changing between values', () => {
    // Value to different value
    const { rerender } = render(<Component data={{ id: 1 }} />);
    rerender(<Component data={{ id: 2 }} />);
    // Verify effect ran for new data
  });
});
```

## Related

- [React Rules of Hooks Documentation](https://react.dev/reference/rules/rules-of-hooks)
- [ESLint Plugin React Hooks](https://www.npmjs.com/package/eslint-plugin-react-hooks)
