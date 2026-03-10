**SIWX x402 KYC extension**: A server-side x402 extension that gates access on KYC. Endpoint providers declare it; agents (or clients) sign in with SIWX; your hook verifies the signature and checks KYC via kyc-panda. Verify once, transact anywhere.

### End-to-end flow

1. Client/agent hits a protected endpoint → gets `402` with a **sign-in-with-x** (SIWX) challenge and **kyc-gate** metadata (including `onboardingUrl`).
2. Standard SIWX client (`createSIWxClientHook`) sees the challenge, signs it, and sends the
   `SIGN-IN-WITH-X` header.
3. Your `createKYCGateHook` verifies the signature and checks KYC status via `/api/verify`.
4. If KYC exists → access granted. If not → the agent sees `kyc-gate.onboardingUrl` and knows
   where to send the human.

### Declaring a KYC gate

The endpoint provider now calls:

```ts
declareKYCGateExtension({
  domain: "api.example.com",
  uri: "https://api.example.com/premium-data",
});
```

instead of the old parameterless call, since the spec requires `domain` and `uri` to be set
per-request.