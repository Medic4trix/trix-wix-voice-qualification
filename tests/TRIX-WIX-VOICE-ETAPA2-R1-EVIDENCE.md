# TRIX-WIX-VOICE-ETAPA2-R1 — Evidence and limitations

Repository: `Medic4trix/trix-wix-voice-qualification`
PR: #9 (Draft)
Base main: `2b68fd41498f0fdb4233497b473c931990940408`
Source HTML blob: `22b57bc86435f64df6a09a1aae7f974cdcf927aa`
Test file blob: `0cf9ae2825df40ceaa6d3d88d8154b722121dbc6`

## Change
`v004-c9.html` now serializes concurrent calls to `release()` through one in-flight promise. The original acoustic detector thresholds (120-second warning, 180-second end), explicit start and foreground-no-auto-resume behavior were not intentionally modified. Mobile Voice 003 is outside this intervention.

## Executed evidence (2026-11-14)
- The 17 existing test bodies from `tests/trix-wix-voice-etapa2.test.mjs` were evaluated against the JavaScript extracted from the GitHub HTML blob in a V8 JavaScript isolate, with compatibility shims for `node:test`, `assert`, and `vm`.
- Result: **17/17 PASS, 0 FAIL** in that adapted execution.
- The concurrent-release test uses a deferred mocked `AudioContext.close()` to assert shared pending promise, one close, one track stop, blocked readiness during close, and readiness after close.
- These results **are not** a native `node --test` execution, a real browser/WebRTC qualification, or an Android/device qualification.

## Native Node.js execution evidence (user-provided Windows PowerShell transcript, 2026-11-14)
- Node.js: `v22.23.5`; Git: `2.56.1.windows.1`.
- Checkout of branch `trix-wix-voice-etapa2-qualification-001` with expected HEAD guard `832baf3a1e0f0640130af641455a878e9dcb99a4` passed.
- Command: `node --test tests/trix-wix-voice-etapa2.test.mjs`.
- Terminal summary: `tests 17`, `pass 17`, `fail 0`, `cancelled 0`, `skipped 0`, `todo 0`, `duration_ms 191.0625`.
- Final script marker: `=== TRIX / QUALIFICACAO NATIVA PASS ===`.
- Evidence is grounded in the PowerShell output provided in conversation; no standalone machine-signed log artifact was collected.
- This establishes native automated test PASS, **not** physical browser/WebRTC or Android qualification.

## Physical Chrome test evidence (user-provided local diagnostic, 2026-11-14)
- User confirmed audible emitted and received audio in Chrome on Windows 10 Pro x64.
- `MICROPHONE_GRANTED tracks=1`, `REMOTE_TRACK_RECEIVED audio`, `LOCAL_NEGOTIATION_COMPLETE ice_servers=0`: microphone admission and local WebRTC loopback observed.
- `WINDOW_ACTIVITY` and `ACOUSTIC_ACTIVITY`: acoustic detection observed.
- `START_REJECTED visible=visible releaseReady=false admitted=true`: concurrent start attempt rejected while active.
- `C3_LIFECYCLE STOP ACTIVE -> ENDED` and `TRACK_RELEASE before=audio:live after=audio:ended`: manual stop and capture-track termination observed.
- `PEERS_CLOSED local=true` and `LOCAL_RELEASE_OBSERVED ready=true ... reason=MANUAL_STOP`: application reports peer closure and readiness; not independent browser-level proof of every resource's closure.
- Remaining: background/foreground behavior, actual browser resource teardown inspection, and exception path for `AudioContext.close()` are not yet physically qualified.
- Evidence is a user-provided log transcript, not an independently collected browser trace. No production, external provider, or PHI involved.

## Physical Chrome background/foreground evidence (user-provided local diagnostic, 2026-11-14)
- Local WebRTC negotiation and microphone track acquisition observed before visibility change.
- `VISIBILITY_CHANGE hidden` at 20:45:33.772Z; `C3_LIFECYCLE BACKGROUND ACTIVE -> PAUSED`; `TRACK_RELEASE before=audio:live after=audio:ended` and `LOCAL_RELEASE_OBSERVED ready=true ... reason=BACKGROUND_HIDDEN`.
- `VISIBILITY_CHANGE visible` at 20:45:39.353Z immediately followed by `FOREGROUND_NO_AUTO_RESUME`; no automatic microphone request observed.
- Explicit restart at 20:45:43.555Z: `C3_LIFECYCLE START PAUSED -> ACTIVE`, `MICROPHONE_REQUEST`.
- Manual stop at 20:45:46.113Z before any `MICROPHONE_GRANTED` in this second attempt; `TRACK_RELEASE before=none after=none`.
- PASS for background pause, track termination, and foreground no-auto-resume. Pending: confirm late microphone permission resolution after stop, browser-level AudioContext closure under exception, and remaining asynchronous edge cases.
- This is user-provided diagnostic evidence, not an independently collected browser trace.

## Remaining release gates
1. Native Node.js suite: **PASS (17/17)**. Retain the user-provided transcript or attach a local log if required by governance.
2. Chrome local loopback, manual-stop track release, background pause and no-auto-resume observed; still verify late asynchronous microphone acquisition, browser-level teardown, and exceptional AudioContext close behavior.
3. Review test scope and any remaining asynchronous edge cases before marking Etapa 2 complete.
4. No merge, deployment, AWS, real providers, PHI, paid GitHub Actions, or start of Etapa 5 is authorized by this evidence.

## Status
**R1 implemented; adapted checks PASS; native Node.js 17/17 PASS; Chrome local loopback/manual-stop/background no-auto-resume observed; Etapa 2 OPEN / remaining physical edge cases and final scope review pending.**
