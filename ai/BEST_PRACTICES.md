# AI Best Practices For This Project

## Planning
- Start each change with `ai/project/<name>/SPEC.md`.
- Track execution in `ai/project/<name>/BACKLOG.md`.
- Keep tasks small; verify each task before moving on.
- Tag every issue with a target release label: `release/x.y` or `release/x.y.z`.

## Code changes
- Prefer minimal, targeted diffs.
- Preserve existing app behavior unless explicitly changing it.
- Keep cache/header behavior explicit in backend responses.
- Avoid hardcoding environment-specific values in source.
- Default all local/test/prod runs to production API/data unless a task explicitly requires mocks or alternate environments.

## Docs changes
- Assume docs are public.
- Use placeholders for infrastructure identifiers.
- Keep runbooks operationally useful without exposing sensitive metadata.

## PR and issue linking
- Every PR must reference related issue(s) in the PR description.
- Use GitHub closing keywords when work is complete so issues auto-close on merge:
  - `Closes #<issue-number>`
  - `Fixes #<issue-number>`
  - `Resolves #<issue-number>`
- Use `Refs #<issue-number>` only for partial/non-closing relationships.
- Every non-doc release-impacting PR must include a changeset file (`yarn changeset`) using:
  - `major` for a new season
  - `minor` for new features
  - `patch` for bug fixes/copy edits/small updates
- Write the changeset summary to cover the totality of the PR changes, not just one file.
- Choose the best SemVer type for impact (prefer the smallest correct bump).
- Approve release numbers by reviewing and merging the automated `chore(release): version packages` PR.

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
