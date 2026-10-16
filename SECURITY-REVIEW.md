# Security Review Summary

**Date:** 2026-10-16  
**Scope:** Tracked source and reachable Git history for the public `main` branch.

## Findings

### MEDIUM — Public development JWT signing fallback

- **Location:** `backend/src/config/jwt-secret.ts:1,15–16`
- **Confidence:** 8/10
- **Finding:** When `JWT_SECRET` is unset and `NODE_ENV` is anything other than exactly `production`, the application falls back to a hard-coded development signing secret. Since that value is present in public Git history, a deployment that omits its environment configuration could use a signing key known to the public. An attacker able to construct claims could then forge JWTs accepted by that deployment.
- **History:** The fallback is present in the current public `main` history. The local `main` HEAD matched the public branch at the time of review.
- **Recommendation:** Use the fallback only in an explicit development mode. Fail startup when the environment is unset or unsupported, and require a securely generated `JWT_SECRET` for deployed environments.

## Exposure assessment

No likely real provider/API credentials, private-key files, or tracked environment files containing credentials were found in the reviewed reachable history. Environment examples and placeholders are not treated as live credentials.

Ignored local files such as `.env` files, uploads, and build output are not tracked in the reviewed history. This review does not cover deleted or unreachable Git refs, forks, release attachments, external logs, or artifacts.
