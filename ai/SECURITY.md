# AI Security Guardrails

Use this checklist for all AI-generated changes.

## Never commit
- Cloud account IDs, ARNs, API IDs, distribution IDs, hosted zone IDs.
- Access keys, tokens, secrets, private keys, cert private material.
- Real profile names tied to privileged accounts.
- Internal-only endpoints or non-public admin URLs.
- Raw production outputs that include sensitive identifiers.

## Allowed in public docs
- Placeholders such as:
  - `<ACCOUNT_ID>`
  - `<AWS_REGION>`
  - `<API_ID>`
  - `<DISTRIBUTION_ID>`
  - `<AWS_PROFILE>`
- Public product/domain names that are intentionally public.

## Documentation rules
- Runbooks in public repo must be scrubbed/anonymized.
- Put operator-specific values in a private note outside git.
- Use parameterized commands with placeholders, not hardcoded IDs.

## Change review checklist
1. Search for high-risk patterns before commit:
```bash
rg -n "AKIA|ASIA|aws_access_key_id|aws_secret_access_key|arn:aws:|execute-api|cloudfront\\.net|hostedzone|[0-9]{12}"
```
2. Review docs added/changed under `docs/` and `ai/`.
3. Confirm `.env`, `.env.local`, and local dumps are not staged.
4. Confirm no generated archives/dumps are staged (for example `*.deploy.zip`).

## Runtime safety
- Prefer least-privilege operations and minimal scope updates.
- For production changes:
  - verify first,
  - change one component,
  - verify again,
  - then proceed.
- Keep rollback instructions updated in runbooks.
