---
name: x402-kyc-gate
description: KYC gate extension for x402 payment protocol. Uses Sign-In-With-X (SIWX) for wallet authentication and Didit for identity verification. Verify once, transact anywhere.
---

# x402 KYC Gate Extension

Add KYC requirements to x402-protected endpoints. Wallet owners prove identity once via Didit, then their agents pass KYC gates using SIWX signatures.

## How It Works

1. Agent hits a KYC-gated x402 endpoint
2. Gets 402 response with `sign-in-with-x` challenge + `kyc-gate` extension
3. Agent signs the SIWX challenge with its wallet
4. Server verifies signature and checks KYC status
5. If KYC approved: access granted. If not: agent gets onboarding URL for the human

## For Client Agents (Buyers)

### Check If Your Wallet Is Already Verified

```bash
curl https://kyc-panda.vercel.app/api/verify/0xYourWalletAddress
```

Response:
```json
{ "verified": true }
```

Or if not verified:
```json
{ "verified": false, "reason": "KYC_NOT_FOUND" }
```

Possible reasons: `KYC_NOT_FOUND`, `KYC_EXPIRED`, `KYC_DECLINED`, `KYC_PENDING_REVIEW`

### Handling a KYC-Gated 402 Response

When you get a 402 with these extensions:

```json
{
  "x402Version": "2",
  "accepts": [...],
  "extensions": {
    "sign-in-with-x": {
      "info": {
        "domain": "api.example.com",
        "uri": "https://api.example.com/data",
        "version": "1",
        "nonce": "a1b2c3d4e5f67890a1b2c3d4e5f67890",
        "issuedAt": "2026-03-10T10:30:00.000Z",
        "expirationTime": "2026-03-10T10:35:00.000Z",
        "statement": "Sign in to verify KYC status"
      },
      "supportedChains": [
        { "chainId": "eip155:8453", "type": "eip191" }
      ],
      "schema": { ... }
    },
    "kyc-gate": {
      "required": true,
      "onboardingUrl": "https://kyc-panda.vercel.app/api/onboard",
      "provider": "didit"
    }
  }
}
```

**If your wallet is already KYC verified:** Sign the SIWX challenge and send it in the `SIGN-IN-WITH-X` header (base64-encoded JSON). The server will verify your signature and grant access.

**If your wallet is NOT verified:** Start KYC onboarding.

### Start KYC Onboarding

Build a SIWE message and sign it with your wallet:

```typescript
import { SiweMessage } from "siwe";
import { privateKeyToAccount } from "viem/accounts";
import crypto from "crypto";

const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY as `0x${string}`);

// Build SIWE message
const siweMessage = new SiweMessage({
  domain: "kyc-panda.vercel.app",
  address: account.address,
  uri: "https://kyc-panda.vercel.app/api/onboard",
  version: "1",
  chainId: 8453,
  nonce: crypto.randomBytes(16).toString("hex"),
  issuedAt: new Date().toISOString(),
  expirationTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  statement: "Sign in to verify KYC status",
});

const messageString = siweMessage.prepareMessage();
const signature = await account.signMessage({ message: messageString });

// Submit to onboarding endpoint
const response = await fetch("https://kyc-panda.vercel.app/api/onboard", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ siwxMessage: messageString, signature }),
});

const { onboardingId, verificationUrl } = await response.json();
// The human wallet owner opens verificationUrl to complete KYC on Didit
console.log("Human should open:", verificationUrl);
```

### After KYC Is Complete

Once the human completes verification on Didit, the wallet is approved. Now when hitting KYC-gated endpoints, sign the SIWX challenge from the 402 response:

```typescript
import { SiweMessage } from "siwe";

// Parse the sign-in-with-x challenge from the 402 response
const challenge = extensions["sign-in-with-x"];

const siweMessage = new SiweMessage({
  domain: challenge.info.domain,
  address: account.address,
  uri: challenge.info.uri,
  version: challenge.info.version,
  chainId: parseInt(challenge.supportedChains[0].chainId.split(":")[1]),
  nonce: challenge.info.nonce,
  issuedAt: challenge.info.issuedAt,
  expirationTime: challenge.info.expirationTime,
  statement: challenge.info.statement,
  resources: challenge.info.resources,
});

const messageString = siweMessage.prepareMessage();
const signature = await account.signMessage({ message: messageString });

// Build the SIWX proof
const proof = {
  domain: challenge.info.domain,
  address: account.address,
  uri: challenge.info.uri,
  version: challenge.info.version,
  chainId: challenge.supportedChains[0].chainId,
  type: challenge.supportedChains[0].type,
  nonce: challenge.info.nonce,
  issuedAt: challenge.info.issuedAt,
  expirationTime: challenge.info.expirationTime,
  statement: challenge.info.statement,
  resources: challenge.info.resources,
  signature,
};

// Retry the request with SIWX proof
const retryResponse = await fetch(originalUrl, {
  headers: {
    "SIGN-IN-WITH-X": btoa(JSON.stringify(proof)),
  },
});
```

---

## For Server Agents (Sellers)

### Install

```bash
npm install siwe viem
```

Copy the bouncer library from `lib/bouncer/` or install when published as `@x402kyc/gate`.

### Add KYC Gate to Your x402 Endpoint

#### 1. Declare the extension in your 402 response

```typescript
import { declareKYCGateExtension } from "./lib/bouncer";

// In your payment middleware or 402 response handler:
const extensions = declareKYCGateExtension({
  domain: "api.yourservice.com",
  uri: "https://api.yourservice.com/premium-data",
  statement: "Sign in to access premium data",
  // Optional overrides:
  // supportedChains: [{ chainId: "eip155:1", type: "eip191" }],
  // onboardingUrl: "https://kyc-panda.vercel.app/api/onboard",
  // provider: "didit",
});

// Add to your 402 response:
// { x402Version: "2", accepts: [...], extensions }
```

This generates a fresh SIWX challenge with a cryptographic nonce and 5-minute expiry.

#### 2. Verify SIWX + KYC on incoming requests

```typescript
import { createKYCGateHook } from "./lib/bouncer";

const kycGate = createKYCGateHook({
  // Optional: override verify endpoint
  // verifyEndpoint: "https://kyc-panda.vercel.app/api/verify",
});

// In your request handler:
async function handleRequest(request: Request) {
  const result = await kycGate(request);

  if (result.grantAccess) {
    // Wallet is KYC verified — serve the resource
    return new Response(JSON.stringify({ data: "premium content" }));
  }

  // Not verified — return 402 with KYC gate extension
  return new Response(JSON.stringify({
    error: result.reason,
    onboardingUrl: result.onboardingUrl,
  }), { status: 402 });
}
```

The hook automatically:
- Reads the `SIGN-IN-WITH-X` header
- Base64 decodes and parses the SIWX proof
- Validates domain, timestamps, chain ID
- Verifies the EVM signature (EIP-191)
- Calls the verify endpoint to check KYC status

---

## Extension Shape Reference

### 402 Response Extensions

```json
{
  "extensions": {
    "sign-in-with-x": {
      "info": {
        "domain": "api.yourservice.com",
        "uri": "https://api.yourservice.com/premium-data",
        "version": "1",
        "nonce": "a1b2c3d4e5f67890a1b2c3d4e5f67890",
        "issuedAt": "2026-03-10T10:30:00.000Z",
        "expirationTime": "2026-03-10T10:35:00.000Z",
        "statement": "Sign in to verify KYC status",
        "resources": ["https://api.yourservice.com/premium-data"]
      },
      "supportedChains": [
        { "chainId": "eip155:8453", "type": "eip191" }
      ],
      "schema": { "...JSON Schema for client proof..." }
    },
    "kyc-gate": {
      "required": true,
      "onboardingUrl": "https://kyc-panda.vercel.app/api/onboard",
      "provider": "didit"
    }
  }
}
```

### SIGN-IN-WITH-X Header (Client Proof)

Base64-encoded JSON:
```json
{
  "domain": "api.yourservice.com",
  "address": "0x857b06519E91e3A54538791bDbb0E22373e36b66",
  "uri": "https://api.yourservice.com/premium-data",
  "version": "1",
  "chainId": "eip155:8453",
  "type": "eip191",
  "nonce": "a1b2c3d4e5f67890a1b2c3d4e5f67890",
  "issuedAt": "2026-03-10T10:30:00.000Z",
  "expirationTime": "2026-03-10T10:35:00.000Z",
  "statement": "Sign in to verify KYC status",
  "resources": ["https://api.yourservice.com/premium-data"],
  "signature": "0x..."
}
```

## KYC Status Codes

| Code | Meaning |
|------|---------|
| `KYC_NOT_FOUND` | Wallet has never completed KYC. Direct human to onboardingUrl. |
| `KYC_EXPIRED` | KYC was approved but expired (>1 year). Re-verification needed. |
| `KYC_DECLINED` | KYC was rejected by the identity provider. |
| `KYC_PENDING_REVIEW` | KYC submitted but under manual review. Try again later. |
| `INVALID_SIGNATURE` | SIWX signature verification failed. |
| `NONCE_REUSED` | Replay attack detected. Generate a fresh nonce. |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/verify/{address}` | GET | Check KYC status for a wallet |
| `/api/onboard` | POST | Start KYC onboarding (SIWX message + signature) |
| `/api/health` | GET | Service health check |

## Technical Details

| Property | Value |
|----------|-------|
| Base URL | `https://kyc-panda.vercel.app` |
| SIWX Standard | CAIP-122 / EIP-4361 (SIWE) |
| Supported Chains | EVM (eip155:*) with EIP-191 signatures |
| KYC Provider | Didit |
| KYC Validity | 1 year from approval |
| Nonce TTL | 24 hours (single-use) |
| Rate Limits | Onboard: 10/min, Verify: 60/min per IP |
