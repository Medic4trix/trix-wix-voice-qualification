# TRIX/Wix — controlled synthetic integration fix 001

Baseline: Bridge 008 PR #7 HEAD `86e433fb77d7ccc61be991ba51199998d484b5c8`.
Scope: additive synthetic composition of existing Bridge 005 UI, Bridge 007 consent and Bridge 008 HTTP simulator, reusing Bridge 004 through Bridge 005. No fetch, AWS, real Cognito, Wix publishing, clinical output, production or consent activation.

Flow: injected synthetic human authentication → canonical Native consent read → explicit consent write/re-read (when required) → restart of conversation by explicit start → server-shaped bootstrap → send-time consent recheck → nonclinical text/receipt. The consent and conversation presenters remain independent: after explicit acceptance, the caller must invoke conversation.start(); consent does not automatically confer conversation authority.

Failures: missing authority, revoked/absent consent, HTTP rejections, invalid responses, and close during pending dispatch fail closed. The Native backend remains the final authority. No browser token persistence or operational OAuth flow is implemented.

Operational NO-GO: no deployed API, real browser auth, CORS/origin, TLS evidence, runtime consent gate, live tests or merge approval. Historical V003/V004 untouched. PRs #3–#7 remain Draft.
