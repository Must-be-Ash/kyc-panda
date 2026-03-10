# kyc-panda 

`kyc-panda ` is a Next.js service for wallet-based KYC gating in x402 flows.
It lets clients sign in with SIWX, start KYC onboarding, and verify whether a wallet is approved.

## What It Does

- `POST /api/onboard` verifies a SIWX signature and creates a KYC session.
- `GET /api/verify/[address]` returns whether a wallet is KYC-approved.
- `POST /api/webhook` receives KYC provider updates and syncs wallet status.

## Add KYC to Your x402 Endpoint

```bash
npm install kyc-panda
```

```typescript
import { createKYCGateHook, declareKYCGateExtension } from "kyc-panda";

// 1. Declare KYC requirement in your 402 response
const extensions = declareKYCGateExtension({
  domain: "your-api.com",
  uri: "https://your-api.com/protected-resource",
});

// 2. Check KYC on incoming requests
const checkKYC = createKYCGateHook();
const result = await checkKYC(request);
if (!result.grantAccess) {
  // result.reason: "KYC_NOT_FOUND" | "KYC_EXPIRED" | ...
  // result.onboardingUrl: where the human can complete KYC
}
```

See [apply.md](./apply.md) for the full integration guide.

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
