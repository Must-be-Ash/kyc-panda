here's an x402 extension that gates endpoints behind KYC using SIWX

Verify once with your wallet, access any endpoint that requires it.

no PII stored

2/

agent calls an x402 endpoint
→ endpoint has the extension (SIWX + kyc-gate)
→ agent is challenged to sign with its wallet
→ signature is verified, KYC status checked
→ if approved, access granted. if not, directed to complete KYC.

once you're verified, you don't need to do it again.

3/

What's SIWX?

Sign-In-With-X (CAIP-122) is a standard for wallet-based authentication. You sign a message with your wallet, the server verifies you own that address.

Think "Sign In With Ethereum" but chain-agnostic. Works across chains

x402 uses SIWX as an extension. Servers can challenge clients to prove wallet ownership before granting access. or you can just use it to manage user credit or grant benefits or discounts

4/

Didit handles all identity verification (documents, selfies...) and no PII touches KYC Panda and it just store wallet address + status. That's it.

KYC status can only be updated through a signed webhook from Didit, so it can't be faked.

5/

Use Cases

- Age-restricted services
- Regulated markets
- Any x402 endpoint where "who" matters as much as "how much"

repo: https://github.com/AshNouruzi/x402kyc
site: https://kyc-panda.vercel.app
