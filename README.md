# kyc-panda 

`kyc-panda ` is a Next.js service for wallet-based KYC gating in x402 flows.
It lets clients sign in with SIWX, start KYC onboarding, and verify whether a wallet is approved.

## What It Does

- `POST /api/onboard` verifies a SIWX signature and creates a KYC session.
- `GET /api/verify/[address]` returns whether a wallet is KYC-approved.
- `POST /api/webhook` receives KYC provider updates and syncs wallet status.

The repo also includes helpers in `lib/bouncer/` for declaring a KYC gate in a `402` response and validating the returned SIWX proof.

## Privacy

This app stores **no PII**. The only data persisted is wallet addresses (public), KYC status, and timestamps. All identity verification — documents, selfies, personal info — is handled entirely by Didit's hosted flow. The app never sees or stores any identity documents.

## Local Setup

Required env vars:

- `MONGODB_URI`
- `SIWX_DOMAIN`
- `DIDIT_API_KEY`
- `DIDIT_WORKFLOW_ID`
- `DIDIT_WEBHOOK_SECRET`

Run locally:

```bash
npm install
npm run dev
```
