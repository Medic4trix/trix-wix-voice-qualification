# Bridge 008 — offline HTTP transport qualification

**Status:** synthetic only. No real HTTP client, fetch, origin, credentials, backend, AWS, Wix publication, or runtime activation.

## Existing Native HTTP endpoints (verified from `Medic4trix/trix-v1`, `apps/api/main.py`)

| Operation | Method/path | Requirements |
|---|---|---|
| Bootstrap | POST `/v1/native/bootstrap` | Verified human Cognito bearer, canonical server-side identity |
| Consent read | GET `/v1/native/conversation-consent` | Human bearer; canonical notice/current revision |
| Consent transition | POST `/v1/native/conversation-consent` | Human bearer, `action=ACCEPT/WITHDRAW`, `expected_revision` |
| Text | POST `/v1/native/text-turns` | Human bearer, exact `Idempotency-Key` matching body; `native.text.turn.v1` |

The offline module uses an injected synthetic `dispatch` port and returns only validated nonclinical text/receipt, never a real network request. Synthetic token strings are placeholders, not credentials. No Wix instance token is accepted as human identity authority.

## Operational blockers — not authorized for this intervention

- **CORS/preflight:** no FastAPI `CORSMiddleware` in the inspected `apps/api/main.py`. This does not establish whether an external gateway/proxy permits the Wix origin. Actual allowed origins, methods, `Authorization`, `Content-Type`, `Idempotency-Key`, and `OPTIONS` handling remain unverified. No blanket origin or wildcard-with-credentials configuration is authorized.
- **Browser token handling:** existing Native human Cognito verification is server-side; the secure browser session/token delivery mechanism and cross-origin security are not qualified.
- **Consent:** canonical artifact has `user_interface_enabled=false` and `runtime_gate_enabled=false`. No synthetic UI acceptance can turn these on.
- **Session expiry/revocation:** the backend remains authoritative; no client-side state can override expiration, revoked consent, or invalid binding.
- **Replay:** only matching idempotency can be retried; replay of clinical material must not be displayed.
- **Availability:** actual HTTPS endpoint, domain, TLS, deployment configuration and gateway policies require separate operational qualification.

PRs #3–#6 remain Draft. Bridge 008 is a stacked Draft PR, with no merge. Historical V003/V004 pages remain unchanged.
