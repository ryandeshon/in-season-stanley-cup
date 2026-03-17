# Release Rules

This project uses Changesets for versioning and changelog automation.

## Semantic version policy

- `major`: New season kickoff release (for example `2.x.x` to `3.0.0`).
- `minor`: New feature releases.
- `patch`: Bug fixes, copy edits, and small maintenance updates.

## Local workflow

1. Add a changeset during feature/fix work:

```bash
yarn changeset
```

2. Verify pending release impact:

```bash
yarn version:status
```

3. On merge to `main`, GitHub Actions updates the release PR and changelog automatically.
