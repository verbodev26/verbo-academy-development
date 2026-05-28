# Fix `/student` crash — stable snapshot for sessions store

## Root cause
`src/routes/student.index.tsx` calls `useSyncExternalStore(subscribeSessions, () => loadSessions(), () => loadSessions())`. `loadSessions()` returns a fresh array each call, so React throws "getSnapshot should be cached", the root `errorComponent` catches it, and the page renders the generic "Something went wrong" fallback.

## Fix (single file: `src/lib/sessions-store.ts`)
Add a cached snapshot so repeated reads return the same reference until data actually changes:

1. Keep a module-level `cached: ExtSession[] | null = null`.
2. Add `getSessionsSnapshot()`:
   - If `cached` is `null`, set `cached = loadSessions()` and return it.
   - Otherwise return the same `cached` reference.
3. In `persistSessions(next)`, set `cached = next` before dispatching the event so subscribers see the new reference on the next snapshot read.
4. In `subscribeSessions`, invalidate `cached = null` when the `verbo:sessions-updated` event or cross-tab `storage` event fires, then call the listener (so the next `getSnapshot` re-reads from localStorage with a new reference).
5. Add a stable SSR snapshot constant (e.g. `const SSR_SNAPSHOT = SEED_SESSIONS as ExtSession[]`) and export `getServerSessionsSnapshot = () => SSR_SNAPSHOT` so SSR always returns the same reference.

## Fix (consumer: `src/routes/student.index.tsx`)
Replace the inline arrow callbacks with the new stable functions:

```ts
const sessions = useSyncExternalStore(
  subscribeSessions,
  getSessionsSnapshot,
  getServerSessionsSnapshot,
);
```

No other behavior changes — cancellation flow, upcoming/history filtering, and the cancellation modal stay exactly as built.

## Verification
- Reload `/student` — dashboard renders, no error fallback.
- Click "Can't attend" → confirm in modal → the session disappears and stays gone after reload (snapshot cache invalidated correctly).
- Check `code--read_runtime_errors` afterward to confirm no "getSnapshot should be cached" warning.

## Scope
Two files touched: `src/lib/sessions-store.ts` and `src/routes/student.index.tsx`. No visual/UX changes from the last design pass.
