# Changelog

## 2.2.0

### Minor Changes

- 1bb6421: Add a head-to-head section on player profile pages that shows opponent avatars with per-opponent win-loss records, including tie/no-game handling and avatar state mapping (angry/happy/sad).

  This also adds deterministic head-to-head aggregation logic, extends profile data loading with season players for ownership inference, and adds unit plus Cypress coverage for the new profile behavior.

### Patch Changes

- 7afdb73: Add GitHub Actions automation to auto-enable merge for `changeset-release/main` release PRs so version bump PRs merge automatically after required checks pass.

## 2.1.1

### Patch Changes

- 2fedbed: Perform a dependency security maintenance pass by upgrading lockfile-resolved packages and pinning vulnerable transitive packages (`cross-spawn`, `serialize-javascript`) to patched versions. This reduces audit findings to remaining moderate issues tied to Vue CLI webpack tooling.

## 2.1.0

### Minor Changes

- b707db9: Add player profile trend snapshot analytics and improve profile page layout consistency/mobile responsiveness.

### Patch Changes

- 1ed8879: Fix GitHub Actions workflow stability by correcting issue release-tag workflow YAML parsing and preventing release-versioning hard failures when repository PR creation is restricted for `GITHUB_TOKEN`.

All notable changes to this project are tracked in this file.

The format follows Keep a Changelog and Semantic Versioning.

## 2.0.0 - 2026-03-16

### Added

- Season-aware data contracts across API and UI (`season/meta`, champion history, selector-driven reads).
- Champion timeline and "What's Next" home surfaces with owner/date context.
- Player profile trend analytics (recent form, best team, weakest matchup) and stronger profile states.
- Unit test harness with Vitest plus PR unit-test workflow.
- Changesets-based release automation and issue release label governance.
- Footer app version display linked to changelog visibility.

### Changed

- Homepage data orchestration moved into composables for cleaner state flow.
- Draft experience improved with better realtime handling and optimistic concurrency support.
- Asset strategy updated toward remote-hosted images with local fallback behavior.
- CI/test pipeline hardened (Cypress install/cache, PR checks, workflow guardrails).

### Fixed

- Local fallback behavior for season contract endpoints to avoid noisy local failures.
- Team ownership hydration fallbacks for missing player-team mappings.
- Multiple home/profile loading and error-state edge cases.

## 1.0.0 - 2024-10-04

This version is backfilled from commit history as a best-effort summary of the pre-September foundation.

### Added

- Initial Vue 3 + Vuetify + Tailwind app foundation with routing and page structure.
- AWS-backed API/Lambda integration for champion, game state, players, and records.
- Core game experience: home champion flow, standings, player profiles, and game details.
- Draft workflow foundation with websocket-driven updates and participant/admin interactions.
- Theme and presentation work (light/dark, avatars, custom logos, responsive UI refinements).
- Cypress end-to-end testing setup with fixtures and CI integration.

### Changed

- Check-game Lambda evolved into adaptive scheduling/finalization behavior with stronger observability.
- Frontend data fetching progressively shifted from local/static assumptions to API contracts.
- App structure and services refactored over time for maintainability and safer data handling.

### Fixed

- Champion/game-day edge cases, matchup reset behavior, and mirror-match handling.
- API/CORS/error handling improvements across frontend and Lambda responses.
- UI resilience and polish improvements across home, standings, profile, and draft views.
