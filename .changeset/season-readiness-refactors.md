---
'in-season-stanley-cup': patch
---

Refactor season loading, draft timers/version handling, and Lambda modules behind behavior tests. Prevent stale season owners and game-recovery stalls, stop abandoned socket reconnects, and add disconnected draft polling. Commit game results, champion transitions, and defense counters atomically so retries cannot lose statistics. Add API/scheduler contracts, disposable DynamoDB transaction and closeout tests, broader Cypress coverage, and verified Lambda packaging.
