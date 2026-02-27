# AI Best Practices For This Project

## Planning
- Start each change with `ai/project/<name>/SPEC.md`.
- Track execution in `ai/project/<name>/BACKLOG.md`.
- Keep tasks small; verify each task before moving on.

## Code changes
- Prefer minimal, targeted diffs.
- Preserve existing app behavior unless explicitly changing it.
- Keep cache/header behavior explicit in backend responses.
- Avoid hardcoding environment-specific values in source.

## Docs changes
- Assume docs are public.
- Use placeholders for infrastructure identifiers.
- Keep runbooks operationally useful without exposing sensitive metadata.

## AWS operations
- Verify before changing production resources.
- Change one layer at a time:
  1. origin behavior
  2. edge behavior
  3. frontend cutover
- Re-verify after each layer.

## Verification defaults
- API checks:
  - `/champion`
  - `/gameid`
  - `/players`
- Confirm:
  - `Cache-Control`
  - `CDN-Cache-Control`
  - `Age` (for edge-cached responses)
- Frontend checks:
  - bundle references correct API base URL
  - static assets have long-lived caching headers

## Safety checks before merge
- Run the checklist in `ai/SECURITY.md`.
- Confirm no `.env*`, tokens, IDs, or temporary deployment artifacts are staged.
- Confirm rollback instructions are present for production-facing work.
