# BACKLOG: release-versioning-system

## Status legend
- `TODO`
- `IN_PROGRESS`
- `BLOCKED`
- `DONE`

## Tasks
| ID | Status | Task | Owner | Verification |
|---|---|---|---|---|
| 1 | DONE | Define scope and confirm acceptance criteria | AI + Human | `ai/project/release-versioning-system/SPEC.md` |
| 2 | DONE | Implement SemVer + changelog automation with Changesets and baseline `2.0.0` | AI | `.changeset/*`, `CHANGELOG.md`, `package.json` |
| 3 | DONE | Implement release approval gate and issue release-tag automation | AI | `.github/workflows/release-versioning.yml`, `.github/workflows/issue-release-tag.yml`, issue template |
| 4 | DONE | Update AI/repo docs for required release workflow | AI + Human | `ai/README.md`, `ai/BEST_PRACTICES.md`, `.github/copilot-instructions.md`, `README.md` |
| 5 | DONE | Final verification and rollout notes | AI + Human | `yarn lint`, `yarn test:unit`, usage notes documented |

## Notes
- Keep tasks small and independently verifiable.
- Update this file as work progresses.
- Link PRs, commits, and test evidence here.
- For merged PRs that complete tasks/issues, include closing keywords in PR body (e.g., `Closes #123`).
- Ensure related issue is labeled with `release/x.y` or `release/x.y.z`.
- If code changes impact a release, include a changeset entry in the PR.
- Evidence:
  - release workflow added
  - issue guard workflow added
  - issue template includes release version field
  - semver policy documented in AI guides
  - local verification: `yarn lint`, `yarn test:unit`
