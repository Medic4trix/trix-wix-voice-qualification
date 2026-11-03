# TRIX — Minimal Realtime Voice Preflight (qualification only)

Scope authorized 2026-11-03: prepare minimal WebRTC voice proof, no live provider invocation.

## Already proven on Android (user logs)
- Chrome and access via Medicatrix/Wix: HTTPS, microphone permission, MediaRecorder, audible playback PASS.
- iframe=false in both logs; this does not independently establish embedded WebView versus external browser.

## This branch
- Existing `index.html` remains untouched.
- `realtime-preflight.html` runs a **local-only** RTCPeerConnection audio SDP offer; it does not call an API, obtain a token, connect to a provider, store audio, or send packets to OpenAI.
- CSP `connect-src 'none'` is an explicit network hard stop.
- No API keys, ephemeral secrets, authenticated users or clinical data.

## Future live WebRTC contract — NOT IMPLEMENTED / NOT AUTHORIZED
1. Canonical authenticated user, consent, tenant, plan/allowance and invocation authority must be validated server-side. Existing `C1PreEntryState.provider_invocation_allowed=False` is a hard block. No mock release or override.
2. Only an authorized server can mint a short-lived client credential for the chosen model, after resolving canonical authority through a separately approved lifecycle.
3. Browser can then negotiate WebRTC using the documented Realtime SDP endpoint; credentials never appear in source control or URLs. No provider request until explicit approval.
4. Establish enforceable session time/cost boundaries and provider-authenticated usage reconciliation before operational billing.

## Model
The current OpenAI public pricing page (checked 2026-11-03) lists `gpt-realtime-2.1-mini`, not sufficient evidence of account-level access or that older `gpt-realtime-mini` is still selectable. Final model and endpoint require account/API verification and current official endpoint documentation before activation. No pricing or API compatibility assumptions embedded in client code.

## Stop conditions
No AWS, Wix settings, Native, provider calls, real secrets, PHI, production, canonical authorities, ledger changes, CB-101 or main merges.

## Testing
Open the file through a branch preview or deploy it **only to an isolated qualification environment** after review. GitHub Pages currently serves main; this branch is not automatically published. Check LOCAL_AUDIO_OFFER=PASS and OPENAI_REQUESTS=0; do not interpret that as remote audio success.
