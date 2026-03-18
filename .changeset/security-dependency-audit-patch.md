---
"in-season-stanley-cup": patch
---

Perform a dependency security maintenance pass by upgrading lockfile-resolved packages and pinning vulnerable transitive packages (`cross-spawn`, `serialize-javascript`) to patched versions. This reduces audit findings to remaining moderate issues tied to Vue CLI webpack tooling.
