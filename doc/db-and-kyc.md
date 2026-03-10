# Security Model

## How KYC approval works

Approval is a two-step process. No single endpoint can mark a wallet as KYC-approved.

1. **`POST /api/onboard`** — Client signs a SIWX message and submits it. The server verifies the signature, creates a `pending` onboarding record in MongoDB, and starts a Didit verification session. This endpoint cannot set status to `approved`.

2. **`POST /api/webhook`** — Didit calls this endpoint when verification completes. The server validates the request with HMAC-SHA256 using `DIDIT_WEBHOOK_SECRET`, then updates the record to `approved`, `declined`, or `review`.

Only the webhook can promote a record from `pending` to `approved`, and only with a valid HMAC signature from Didit.

## Attack surface

### Can someone forge a webhook to approve themselves?

No. The webhook endpoint requires:
- A valid HMAC-SHA256 signature (`x-signature` header) computed with `DIDIT_WEBHOOK_SECRET`
- A fresh timestamp (`x-timestamp` header) within a 5-minute window
- Timing-safe comparison to prevent side-channel attacks

Without the secret, an attacker cannot produce a valid signature.

### Can someone create fake onboarding records?

They can create `pending` records, but only with a valid SIWX signature (requires owning a wallet private key). These records are useless — only the webhook can change their status. Additional guards:
- Domain validation against `SIWX_DOMAIN`
- `issuedAt` must be within the last 5 minutes and not in the future
- `expirationTime` must be in the future
- Nonce replay protection (each nonce can only be used once, stored with 24h TTL)
- Rate limiting: 10 requests per minute per IP

### Can someone read or enumerate wallet statuses?

`GET /api/verify/[address]` is read-only and rate-limited (60 req/min per IP). It returns only `verified: true/false` and a status code — no PII or internal IDs.

## What is stored

| Collection | Fields | Sensitive? |
|---|---|---|
| `onboarding` | onboardingId, walletAddress, chain, diditSessionId, kycStatus, timestamps | No — wallet addresses are public |
| `verifiedWallet` | walletAddress, chain, kycStatus, diditSessionId, verifiedAt, expiresAt | No |
| `usedNonce` | nonce, usedAt, expiresAt (24h TTL) | No |

No PII is stored. All identity documents, selfies, and personal info are handled by Didit and never touch this service.

## Environment variables

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | Database connection |
| `SIWX_DOMAIN` | Expected domain in SIWX messages |
| `DIDIT_API_KEY` | Authenticates requests to Didit API |
| `DIDIT_WORKFLOW_ID` | Identifies the KYC workflow in Didit |
| `DIDIT_WEBHOOK_SECRET` | Verifies incoming webhook signatures from Didit |

All five must be set. Missing `DIDIT_API_KEY`, `DIDIT_WORKFLOW_ID`, or `DIDIT_WEBHOOK_SECRET` will return 503 at runtime.
