# AI Workflow Guide

This directory defines how AI-assisted work is organized in this repository.

## Goals
- Keep planning artifacts in one predictable location.
- Keep sensitive data out of git.
- Make AI changes auditable and reviewable.

## Project workspace convention
For each feature/project, create:

`ai/project/<name-of-project>/SPEC.md`  
`ai/project/<name-of-project>/BACKLOG.md`

Example:
- `ai/project/cache-hardening/SPEC.md`
- `ai/project/cache-hardening/BACKLOG.md`

## Required process
1. Before starting a task, check for an existing open PR for the same issue/scope and reuse it when appropriate (avoid duplicate PRs).
2. For every new task, create and switch to a new git branch before making changes.
3. Use the existing branch naming format: `isc-<issue-number>` with optional range and short slug (for example: `isc-032`, `isc-018-020`, `isc-022-home-game-profile`).
4. Create `SPEC.md` first.
5. Create `BACKLOG.md` from the template and split work into small verifiable tasks.
6. Implement tasks one by one, updating `BACKLOG.md` statuses.
7. When committing, group file changes into logical, sizable chunks and write commit messages that describe what changed (and why when helpful).
8. Before PR/merge, run the security checklist in `ai/SECURITY.md`.
9. In every PR description, include related issue links and use closing keywords for completed work (for example: `Closes #18`).
10. Environment policy: local, test, and prod workflows should all use production data/API by default unless explicitly told otherwise for a task.

## Templates
- `ai/project/_template/SPEC.md`
- `ai/project/_template/BACKLOG.md`
- `ai/BEST_PRACTICES.md`

Copy templates when starting a new project:
```bash
mkdir -p ai/project/<name-of-project>
cp ai/project/_template/SPEC.md ai/project/<name-of-project>/SPEC.md
cp ai/project/_template/BACKLOG.md ai/project/<name-of-project>/BACKLOG.md
```
