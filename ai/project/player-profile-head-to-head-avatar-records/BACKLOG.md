# BACKLOG: player-profile-head-to-head-avatar-records

## Status legend

- `TODO`
- `IN_PROGRESS`
- `BLOCKED`
- `DONE`

## Tasks

| ID  | Status      | Task                                                            | Owner      | Verification            |
| --- | ----------- | --------------------------------------------------------------- | ---------- | ----------------------- |
| 1   | DONE        | Define scope and lock acceptance criteria from issue #64        | AI + Human | Issue and spec aligned  |
| 2   | DONE        | Implement head-to-head aggregation logic + data loading updates | AI         | Unit tests pass         |
| 3   | DONE        | Implement PlayerProfile UI section + style + selectors          | AI         | Component tests pass    |
| 4   | DONE        | Add Cypress coverage for new profile behavior                   | AI         | Cypress spec passes     |
| 5   | IN_PROGRESS | Add changeset, run security checklist, finalize PR              | AI + Human | Checklist + PR complete |

## Notes

- Issue: `#64`
- Branch: `isc-064-head-to-head-avatar-records`
- Target release: `2.2.0` (minor)
- Verification run:
  - `yarn test:unit tests/unit/playerProfileTrends.spec.js tests/unit/PlayerProfile.spec.js`
  - `yarn lint`
  - `yarn test:e2e`
- Security check:
  - `rg -n "AKIA|ASIA|aws_access_key_id|aws_secret_access_key|arn:aws:|execute-api|cloudfront\\.net|hostedzone|[0-9]{12}" ...` (no matches in changed scope)
