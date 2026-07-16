## Problem

When switching to the Badges tab in `/admin/challenges`, the page crashes into the root error boundary ("Something went wrong / Try again").

**Root cause:** In `src/routes/admin.challenges.tsx`, the tab-switch early return was inserted *before* the component's `useEffect` and `useMemo` hooks:

```tsx
function Page() {
  const [challenges, setChallenges] = useState(...);
  const [categories, setCategories] = useState(...);
  // ...state hooks...
  const [tab, setTab] = useState<"challenges" | "badges">("challenges");

  if (tab === "badges" && !productId) {   // ⬅️ early return BEFORE the effects
    return (<><TabsBar/><BadgesManager/></>);
  }

  useEffect(() => { ... }, []);           // ⬅️ skipped when tab flips
  const list = useMemo(...);              // ⬅️ skipped too
  ...
}
```

Clicking Badges flips `tab`, the early return kicks in, and React sees fewer hooks than on the previous render → Rules of Hooks violation → crash.

## Fix

Move the `tab === "badges"` early return *after* all `useState` / `useEffect` / `useMemo` hooks in `Page()`. All hooks must run unconditionally on every render, regardless of which tab is active.

Only file touched: `src/routes/admin.challenges.tsx`. No other logic changes; no store, no student page, no data model changes.

## Verification

- Typecheck stays clean.
- Navigate to `/admin/challenges`, click the **Badges** tab → the Badges manager renders without hitting the error boundary.
- Click **Challenges** tab back → product picker renders normally.
