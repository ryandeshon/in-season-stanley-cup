# SPEC: release-versioning-system

## Summary
Implement a consistent release/versioning system that starts at `2.0.0`, generates changelog entries automatically, and requires human approval of the final release number before version updates are merged.

## Release Target
- Planned release label (`release/x.y` or `release/x.y.z`): `release/2.0`
- Expected SemVer bump (`major`, `minor`, or `patch`): `minor` (process feature)

## Problem
- No formal app SemVer system exists.
- No automated changelog/release PR workflow exists.
- Issues are not consistently mapped to target release numbers.

## Goals
- Baseline app version to `2.0.0`.
- Automate changelog and version bump prep with review/approval gate.
- Enforce issue-level release tagging.
- Document release policy in AI guides and repo docs.

## Non-Goals
- No npm package publishing automation.
- No branch protection/ruleset administration in GitHub org settings.

## Constraints
- Must work in current GitHub Actions + Yarn setup.
- Must not require secrets beyond standard `GITHUB_TOKEN`.
- Must keep public docs free of secrets/infra IDs.

## Technical Design
- Use Changesets for SemVer and `CHANGELOG.md` generation.
- Add release workflow that creates/updates a `chore(release): version packages` PR from `main`.
- Add issue workflow that ensures `release/x.y` or `release/x.y.z` label is present, and auto-tags from issue form release field when valid.
- Add issue form template requiring release version and semver change type.
- Update AI and repo documentation with explicit release policy.

## Risks and Mitigations
- Risk: Issues created outside template may miss release labels.
  - Mitigation: automated guard workflow adds `needs-release-tag` + reminder comment.
- Risk: contributors forget to add changesets.
  - Mitigation: AI guides and release docs now require `yarn changeset` in PR workflow.

## Acceptance Criteria
1. Given merged changesets in `main`, when release workflow runs, then it opens/updates a version PR with computed SemVer bump and changelog updates.
2. Given a new issue without a release label, when issue guard workflow runs, then issue is labeled `needs-release-tag` and receives guidance comment.
3. Given issue form release value `x.y` or `x.y.z`, when issue guard workflow runs, then matching `release/...` label is auto-applied.
4. AI workflow docs include the new versioning policy and release label requirements.

## Verification Plan
- Run unit tests.
- Validate YAML syntax and workflow logic via lint/manual inspection.
- Manually verify issue template fields and release-label regex behavior.

## Rollback Plan
- Disable new workflows by reverting `.github/workflows/release-versioning.yml` and `.github/workflows/issue-release-tag.yml`.
- Restore previous package version and remove `.changeset/` integration in a follow-up revert commit if required.
