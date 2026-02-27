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
1. Create `SPEC.md` first.
2. Create `BACKLOG.md` from the template and split work into small verifiable tasks.
3. Implement tasks one by one, updating `BACKLOG.md` statuses.
4. Before PR/merge, run the security checklist in `ai/SECURITY.md`.

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
