# kyc-panda

KYC gate extension for x402 endpoints. Verify once, transact anywhere.

Adds KYC verification to any x402-protected endpoint using SIWX (CAIP-122) for chain-agnostic wallet authentication. Supports EVM and Solana.

## Install

```bash
npm install kyc-panda
```

## Usage

### 1. Declare KYC requirement in your 402 response

```typescript
import { declareKYCGateExtension } from "kyc-panda";

// In your 402 Payment Required response handler:
const extensions = declareKYCGateExtension({
  domain: "your-api.com",
  uri: "https://your-api.com/protected-resource",
});

// Add `extensions` to your 402 response body alongside `accepts`
```

This tells agents: "this endpoint requires KYC" and provides a SIWX challenge + onboarding URL.

### 2. Check KYC on incoming requests

```typescript
import { createKYCGateHook } from "kyc-panda";

const checkKYC = createKYCGateHook();

// In your request handler:
async function handleRequest(request: Request) {
  const result = await checkKYC(request);

  if (!result.grantAccess) {
    // result.reason: "KYC_NOT_FOUND" | "KYC_EXPIRED" | "KYC_DECLINED" | "INVALID_SIGNATURE" | ...
    // result.onboardingUrl: URL where the human can complete KYC
    return new Response(JSON.stringify(result), { status: 403 });
  }

  // Wallet is KYC-verified — serve the resource
  return new Response("Here's your data");
}
```

### How it works

1. Agent sends a request with a `SIGN-IN-WITH-X` header (base64-encoded SIWX payload)
2. The hook parses, validates, and verifies the signature (EVM or Solana)
3. Recovers the wallet address and checks KYC status against `https://kyc-panda.vercel.app/api/verify`
4. Returns `{ grantAccess: true }` if the wallet is KYC-verified

### Custom verify endpoint

```typescript
const checkKYC = createKYCGateHook({
  verifyEndpoint: "https://your-own-deployment.com/api/verify",
});
```

## KYC Onboarding Flow

For wallets that haven't completed KYC:

1. Human creates a SIWX payload and POSTs `{ siwxHeader }` to `https://kyc-panda.vercel.app/api/onboard`
2. Gets back a `verificationUrl` — human opens it to complete identity verification via Didit
3. Once approved, the wallet passes KYC gates on all x402 endpoints using this package

## Error Codes

| Code | Meaning |
|---|---|
| `KYC_NOT_FOUND` | Wallet has never completed KYC |
| `KYC_EXPIRED` | KYC was approved but has expired (1 year) |
| `KYC_DECLINED` | KYC was rejected |
| `KYC_PENDING_REVIEW` | KYC submitted but under manual review |
| `INVALID_SIGNATURE` | SIWX signature verification failed |
