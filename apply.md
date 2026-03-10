# Add KYC to Your x402 Endpoint

> **TLDR:** Install `kyc-panda`, add 2 function calls to your server, done. Agents that haven't completed KYC get rejected with an onboarding URL. Works with EVM and Solana wallets.

## Install

```bash
npm install kyc-panda
```

## Step 1: Declare KYC in your 402 response

When an agent hits your endpoint without payment, your 402 response tells them KYC is required:

```typescript
import { declareKYCGateExtension } from "kyc-panda";

// In your 402 handler:
const extensions = declareKYCGateExtension({
  domain: "your-api.com",
  uri: "https://your-api.com/protected-resource",
});

// Add `extensions` to your 402 response body
return new Response(JSON.stringify({
  x402Version: "2",
  accepts: [/* your payment config */],
  extensions,
}), { status: 402 });
```

## Step 2: Check KYC on incoming requests

Before granting access, verify the agent's wallet is KYC-approved:

```typescript
import { createKYCGateHook } from "kyc-panda";

const checkKYC = createKYCGateHook();

async function handleRequest(request: Request) {
  const result = await checkKYC(request);

  if (!result.grantAccess) {
    // result.reason:       "KYC_NOT_FOUND" | "KYC_EXPIRED" | "KYC_DECLINED" | ...
    // result.onboardingUrl: where the human can complete KYC
    return new Response(JSON.stringify(result), { status: 403 });
  }

  // Wallet is KYC-verified — serve the resource
  return new Response("Here's your data");
}
```

## What happens under the hood

1. Agent sends a `SIGN-IN-WITH-X` header (SIWX / CAIP-122)
2. `checkKYC` parses and verifies the signature (EVM or Solana)
3. Checks KYC status against `https://kyc-panda.vercel.app/api/verify/{address}`
4. Returns `{ grantAccess: true }` or `{ grantAccess: false, reason, onboardingUrl }`

## KYC onboarding (for new wallets)

Wallets that haven't completed KYC get a `KYC_NOT_FOUND` response with an `onboardingUrl`. The flow:

1. Human POSTs a signed SIWX payload to `https://kyc-panda.vercel.app/api/onboard`
2. Gets back a `verificationUrl` — opens it to complete ID verification
3. Once approved, the wallet passes all KYC gates automatically
