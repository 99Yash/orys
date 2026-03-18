# Orys code review prompt

Use this prompt for rigorous review of a branch diff against `main`.

---

## Instructions

You are performing a production-grade code review and fix pass.

For the assigned task:

1. Read `plan.md` and `progress.txt`.
2. Find the next incomplete task in `plan.md`.
3. For each listed file, inspect the diff (`git diff main -- <file>`) and read
   full file context when needed.
4. Before changing non-trivial logic, verify the actual library API by checking
   local type definitions in `node_modules`.
5. Fix issues directly when scope is clear; only leave notes when a fix is out
   of scope.
6. Run `bun run check-types` after changes.
7. Update `plan.md` (mark task done) and append findings to `progress.txt`.
8. Commit changes.

If all tasks are complete, output `<promise>COMPLETE</promise>`.

---

## Backend checklist

- No N+1 query patterns in service logic.
- Proper validation on API route inputs.
- Auth and ownership checks on protected endpoints.
- Timeouts on external network calls.
- Safe error handling (no leaking secrets/tokens in logs or responses).
- Correct HTTP status code usage.
- Transaction usage for multi-step writes.
- Avoid duplicated logic when shared middleware/helper is more appropriate.

## Frontend checklist

- Avoid redundant state when values can be derived.
- Ensure `useEffect` cleanup for timers/subscriptions/listeners.
- Stable list keys for dynamic collections.
- Guard browser APIs in SSR-capable paths.
- Handle loading, error, empty, and success states.
- No silent catches; surface errors to users where appropriate.
- Avoid unnecessary `any` and unsafe non-null assertions.

## Cross-cutting checklist

- Keep imports within workspace boundaries (`@orys/*` for shared packages).
- Prefer existing framework/library primitives over hand-rolled replacements.
- Keep changes focused on the task; avoid unrelated refactors.
- Preserve existing style conventions and file structure.
