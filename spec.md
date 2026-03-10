# x402 KYC Gate Extension — Technical Specification

> A server-side x402 extension that acts as a KYC bouncer for agent transactions. Endpoint providers plug it in so only agents whose humans have completed KYC can transact. Verify once, transact anywhere.

---

## Stack

- **Runtime**: Next.js 14+ (App Router) deployed on Vercel
- **Domain**: https://kyc-panda.vercel.app/
- **Database**: MongoDB (user-provided connection string via `MONGODB_URI` env var)
- **KYC Provider**: Didit (hosted verification flow, webhooks)
- **SIWX Chain Support**: EVM only (EIP-191 signature verification). Solana support deferred to a future phase.
- **Language**: TypeScript
- **No frontend**: API routes only. Didit provides the KYC UI. No dashboard, no landing page.
- **No auth layer / API keys**: The SIWX signature is the authentication. The wallet is the identity.

---

## Architecture Overview

```
Human (wallet owner)                    Agent (transacts on behalf of human)
       │                                          │
       │ 1. Signs SIWX challenge                  │
       │    (proves wallet ownership)              │
       ▼                                          │
┌──────────────────────┐                          │
│  kyc-panda.vercel.app  │                          │
│                      │                          │
│  POST /api/onboard   │                          │
│  - verifies SIWX sig │                          │
│  - creates onboarding│                          │
│    record in MongoDB │                          │
│  - creates Didit     │                          │
│    session           │                          │
│  - returns Didit URL │                          │
└──────┬───────────────┘                          │
       │                                          │
       │ 2. Human completes KYC                   │
       │    on Didit's hosted page                │
       ▼                                          │
┌──────────────────────┐                          │
│  Didit               │                          │
│  - ID verification   │                          │
│  - sends webhook     │──────────┐               │
│    with vendor_data  │          │               │
└──────────────────────┘          │               │
                                  ▼               │
                     ┌──────────────────────┐     │
                     │  POST /api/webhook   │     │
                     │  - looks up onboard  │     │
                     │    record by         │     │
                     │    onboarding_id     │     │
                     │  - updates wallet's  │     │
                     │    KYC status in     │     │
                     │    MongoDB           │     │
                     └──────────────────────┘     │
                                                  │
              3. Agent hits an x402 endpoint       │
                 with KYC gate extension           │
                                                  ▼
                     ┌──────────────────────────────────┐
                     │  Endpoint Provider's Server      │
                     │  (uses createKYCGateHook)        │
                     │                                  │
                     │  - Agent sends SIWX signature    │
                     │  - Hook verifies signature       │
                     │  - Hook calls GET /api/verify    │
                     │    on kyc-panda.vercel.app         │
                     │  - If verified → grant access    │
                     │  - If not → reject               │
                     └──────────────────────────────────┘
```

---

## Environment Variables

```
MONGODB_URI=              # MongoDB connection string
DIDIT_API_KEY=            # Didit API key
DIDIT_WEBHOOK_SECRET=     # Didit webhook signing secret for verifying webhook authenticity
SIWX_DOMAIN=kyc-panda.vercel.app   # Domain used in SIWX challenge messages
```

---

## Phase 1: Project Setup

### 1.1 Initialize Project
- [x] Create Next.js 14+ project with App Router and TypeScript
- [x] Configure for Vercel deployment to https://kyc-panda.vercel.app/
- [x] Install dependencies: `mongoose`, `viem` (for EVM signature verification), `siwe` (for SIWX message formatting/parsing), `@x402/server` (for extension types)
- [x] Set up `.env.local` with `MONGODB_URI`, `DIDIT_API_KEY`, `DIDIT_WEBHOOK_SECRET`, `SIWX_DOMAIN`

### 1.2 MongoDB Connection
- [x] Create a shared MongoDB connection utility using Mongoose with connection caching (serverless-safe)
- [x] Verify connection works in a health check route `GET /api/health`

---

## Phase 2: Database Models

### 2.1 `onboarding` Collection
Tracks the link between a wallet and a Didit KYC session.

- [x] Define Mongoose schema:
  - `onboardingId`: string (UUID, unique) — internal opaque ID
  - `walletAddress`: string — the SIWX EVM address
  - `chain`: string — e.g. `eip155:1`
  - `diditSessionId`: string — Didit's session ID
  - `kycStatus`: enum — `pending` | `approved` | `declined` | `review`
  - `createdAt`: Date
  - `updatedAt`: Date
- [x] Index on `onboardingId` (unique)
- [x] Index on `walletAddress`

### 2.2 `verifiedWallets` Collection
The source of truth for which wallets are KYC-verified. This is what the bouncer checks.

- [x] Define Mongoose schema:
  - `walletAddress`: string (unique, lowercased)
  - `chain`: string
  - `kycStatus`: enum — `approved` | `declined` | `review` | `expired`
  - `diditSessionId`: string — for audit trail
  - `verifiedAt`: Date
  - `expiresAt`: Date (e.g. 1 year from verification)
  - `createdAt`: Date
  - `updatedAt`: Date
- [x] Index on `walletAddress` (unique)
- [x] Index on `kycStatus`

### 2.3 `usedNonces` Collection
Prevents SIWX signature replay attacks.

- [x] Define Mongoose schema:
  - `nonce`: string (unique)
  - `usedAt`: Date
  - `expiresAt`: Date (TTL index — auto-delete after 24h)
- [x] TTL index on `expiresAt` for automatic cleanup

---

## Phase 3: KYC Onboarding Flow

### 3.1 `POST /api/onboard` — Start KYC
This is the entry point. A human (or their app) calls this to begin KYC.

Request body:
```json
{
  "siwxMessage": "...the SIWX message string...",
  "signature": "0x..."
}
```

- [x] Parse the SIWX message using the `siwe` library
- [x] Validate SIWX message fields:
  - `domain` matches `SIWX_DOMAIN` env var
  - `issuedAt` is within the last 5 minutes
  - `expirationTime` is in the future
  - `nonce` has not been used before
- [x] Verify the EVM signature against the message using `viem`
- [x] Mark the nonce as used in `usedNonces`
- [x] Generate a UUID `onboardingId`
- [x] Create an onboarding record in MongoDB: `{ onboardingId, walletAddress, chain, kycStatus: 'pending' }`
- [x] Call Didit API `POST /v2/session/` to create a verification session:
  - Pass `vendor_data: onboardingId`
  - Pass `metadata: { walletAddress, chain }` (for debugging)
  - Pass `callback` URL (the Didit redirect-after-completion URL, if needed)
- [x] Return the Didit hosted verification URL to the caller:
```json
{
  "onboardingId": "uuid-here",
  "verificationUrl": "https://verify.didit.me/session/..."
}
```
- [x] Human opens the URL and completes KYC on Didit's hosted page

### 3.2 `POST /api/webhook` — Didit Webhook Handler
Didit calls this when KYC status changes.

- [x] Verify the webhook signature using `DIDIT_WEBHOOK_SECRET` to confirm it's from Didit
- [x] Extract `vendor_data` (the `onboardingId`) and `status`/`decision` from the payload
- [x] Look up the onboarding record by `onboardingId`
- [x] If not found, return 404
- [x] Update the onboarding record's `kycStatus` based on Didit's decision
- [x] If status is `approved`:
  - Upsert into `verifiedWallets`: set `walletAddress`, `chain`, `kycStatus: 'approved'`, `verifiedAt: now`, `expiresAt: 1 year from now`
- [x] If status is `declined` or `review`:
  - Update `verifiedWallets` accordingly (or create with that status)
- [x] Return 200 OK to Didit

### 3.3 `GET /api/verify/[address]` — Check KYC Status
The bouncer calls this to check if a wallet is KYC-verified.

- [x] Lowercase the address parameter
- [x] Look up the address in `verifiedWallets`
- [x] If not found → return `{ verified: false, reason: "KYC_NOT_FOUND" }`
- [x] If found but expired → return `{ verified: false, reason: "KYC_EXPIRED" }`
- [x] If found but declined → return `{ verified: false, reason: "KYC_DECLINED" }`
- [x] If found but in review → return `{ verified: false, reason: "KYC_PENDING_REVIEW" }`
- [x] If found and approved and not expired → return `{ verified: true }`

---

## Phase 4: The Bouncer (x402 Extension)

### 4.1 `createKYCGateHook` — Server-Side x402 Hook
This is the core product. An endpoint provider imports this and plugs it into their x402 server.

- [x] Export a function `createKYCGateHook(config: { verifyEndpoint: string })` that returns an x402 `onProtectedRequest` hook
- [x] `verifyEndpoint` defaults to `https://kyc-panda.vercel.app/api/verify`
- [x] The hook:
  1. Extracts the SIWX signed payload from the request (from the `SIGN-IN-WITH-X` header)
  2. Verifies the SIWX signature locally (EVM EIP-191 via `viem`)
  3. Validates message fields: domain, nonce, timestamps
  4. Recovers the wallet address from the signature
  5. Calls `GET {verifyEndpoint}/{walletAddress}` to check KYC status
  6. If `verified: true` → returns `{ grantAccess: true }`
  7. If `verified: false` → returns `{ grantAccess: false }` with the reason and a URL to complete KYC

### 4.2 `declareKYCGateExtension` — 402 Response Extension
Adds KYC info to the 402 Payment Required response so agents know KYC is required.

- [x] Export a function that adds a `kyc-gate` extension to the 402 response payload
- [x] Extension payload includes:
  - `required: true`
  - `onboardingUrl`: `https://kyc-panda.vercel.app/api/onboard`
  - `supportedChains`: `["eip155:*"]`
  - `provider`: `"didit"`

### 4.3 Error Codes
- [x] `KYC_NOT_FOUND` — wallet has never completed KYC. Include onboarding URL.
- [x] `KYC_EXPIRED` — KYC was approved but has expired. Include onboarding URL for re-verification.
- [x] `KYC_DECLINED` — KYC was rejected.
- [x] `KYC_PENDING_REVIEW` — KYC submitted but under manual review.
- [x] `INVALID_SIGNATURE` — SIWX signature verification failed.
- [x] `NONCE_REUSED` — replay attack detected.

---

## Phase 5: Security

### 5.1 Core Security
- [x] HTTPS enforced (Vercel handles this automatically)
- [x] Verify Didit webhook signatures on every webhook call
- [x] Never store KYC documents or PII — only store wallet address and status. Didit holds all PII.
- [x] Rate limit `POST /api/onboard` to prevent abuse (e.g. 10 requests per minute per IP)
- [x] Rate limit `GET /api/verify/[address]` to prevent address enumeration
- [x] SIWX nonces are single-use and expire after 24 hours (TTL index)

### 5.2 Anti-Abuse
- [x] Cap the number of SIWX addresses one KYC identity can verify (e.g. max 5 wallets per human). Track via Didit's session deduplication.
- [x] Log all verify requests for audit trail

### 5.3 Compliance
- [x] KYC expires after 1 year — human must re-verify
- [x] Support revocation: admin endpoint or manual DB update to set `kycStatus: 'expired'` for a wallet
- [x] GDPR: on deletion request, remove all records for a wallet address from all collections
- [x] Only store: wallet address (public info) + KYC status + timestamps. No PII touches your database.

---

## Phase 6: Deployment & Testing

### 6.1 Vercel Setup
- [x] Connect Git repo to Vercel
- [ ] Assign custom domain: https://kyc-panda.vercel.app/
- [x] Set environment variables in Vercel dashboard: `MONGODB_URI`, `DIDIT_API_KEY`, `DIDIT_WEBHOOK_SECRET`, `SIWX_DOMAIN`
- [ ] Deploy and verify `GET /api/health` returns OK

### 6.2 Didit Setup
- [ ] Create Didit account and set up a verification workflow
- [ ] Configure webhook URL: `https://kyc-panda.vercel.app/api/webhook`
- [ ] Note the `workflow_id` and add to env vars if needed
- [ ] Test the full flow with Didit's sandbox/test mode

### 6.3 Testing
- [ ] Test onboarding flow end-to-end: sign SIWX → get Didit URL → complete KYC → webhook updates status → verify endpoint returns `verified: true`
- [ ] Test rejection flow: KYC declined → verify endpoint returns `KYC_DECLINED`
- [ ] Test expiration: manually set `expiresAt` to past → verify endpoint returns `KYC_EXPIRED`
- [ ] Test replay attack: reuse a nonce → onboard endpoint rejects
- [ ] Test invalid signature → onboard endpoint rejects
- [ ] Test the bouncer hook against your own x402 endpoint

---

## Future Phases (Not in Scope Now)

### Solana SIWX Support
- [ ] Add Ed25519 signature verification for Solana wallets
- [ ] Support `solana:*` chain identifiers in onboarding and verification
- [ ] Update `createKYCGateHook` to handle both EVM and Solana signatures

### Multi-Tenant Provider System
- [ ] Provider registration and API keys
- [ ] Per-provider analytics (agents verified, transactions gated)
- [ ] Provider dashboard UI
- [ ] npm package distribution: `@x402kyc/gate`

### Agent-Side Client Hook
- [ ] `createKYCClientHook` — agent-side hook that detects KYC gate in 402 responses
- [ ] Auto-surfaces onboarding URL to the agent's human when KYC is required
- [ ] npm package: `@x402kyc/client`