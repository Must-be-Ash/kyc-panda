import { SiweMessage } from "siwe";
import type { KYCGateConfig, KYCGateResult } from "./types";

const DEFAULT_VERIFY_ENDPOINT = "https://kyc-panda.vercel.app/api/verify";
const DEFAULT_ONBOARDING_URL = "https://kyc-panda.vercel.app/api/onboard";
const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * SIWX payload as defined by the x402 sign-in-with-x extension spec.
 * The SIGN-IN-WITH-X header contains base64-encoded JSON with this shape.
 */
interface SIWxPayload {
  domain: string;
  address: string;
  uri: string;
  version: string;
  chainId: string; // CAIP-2 format, e.g. "eip155:8453"
  type: string; // "eip191" for EVM
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
  notBefore?: string;
  statement?: string;
  requestId?: string;
  resources?: string[];
  signature: string;
}

export function createKYCGateHook(config: KYCGateConfig = {}) {
  const verifyEndpoint = config.verifyEndpoint || DEFAULT_VERIFY_ENDPOINT;

  return async function onProtectedRequest(
    request: Request
  ): Promise<KYCGateResult> {
    // 1. Extract SIWX signed payload from header (base64-encoded JSON per spec)
    const siwxHeader = request.headers.get("SIGN-IN-WITH-X");
    if (!siwxHeader) {
      return {
        grantAccess: false,
        reason: "INVALID_SIGNATURE",
        onboardingUrl: DEFAULT_ONBOARDING_URL,
      };
    }

    // 2. Base64 decode and parse the payload
    let payload: SIWxPayload;
    try {
      const decoded = Buffer.from(siwxHeader, "base64").toString("utf-8");
      payload = JSON.parse(decoded);
    } catch {
      return {
        grantAccess: false,
        reason: "INVALID_SIGNATURE",
        onboardingUrl: DEFAULT_ONBOARDING_URL,
      };
    }

    if (!payload.address || !payload.signature || !payload.chainId) {
      return {
        grantAccess: false,
        reason: "INVALID_SIGNATURE",
        onboardingUrl: DEFAULT_ONBOARDING_URL,
      };
    }

    // 3. Only support EVM chains for now
    if (!payload.chainId.startsWith("eip155:")) {
      return {
        grantAccess: false,
        reason: "INVALID_SIGNATURE",
        onboardingUrl: DEFAULT_ONBOARDING_URL,
      };
    }

    // 4. Validate domain — MUST match the request host exactly
    const requestHost = new URL(request.url).host;
    if (payload.domain !== requestHost) {
      return {
        grantAccess: false,
        reason: "INVALID_SIGNATURE",
        onboardingUrl: DEFAULT_ONBOARDING_URL,
      };
    }

    // 5. Validate temporal bounds per SIWX spec
    const now = Date.now();

    // issuedAt MUST be recent (< 5 minutes) and MUST NOT be in the future
    if (payload.issuedAt) {
      const issuedAt = new Date(payload.issuedAt).getTime();
      if (issuedAt > now) {
        return {
          grantAccess: false,
          reason: "INVALID_SIGNATURE",
          onboardingUrl: DEFAULT_ONBOARDING_URL,
        };
      }
      if (now - issuedAt > MAX_AGE_MS) {
        return {
          grantAccess: false,
          reason: "INVALID_SIGNATURE",
          onboardingUrl: DEFAULT_ONBOARDING_URL,
        };
      }
    }

    // expirationTime MUST be in the future
    if (payload.expirationTime) {
      const expiration = new Date(payload.expirationTime).getTime();
      if (expiration <= now) {
        return {
          grantAccess: false,
          reason: "INVALID_SIGNATURE",
          onboardingUrl: DEFAULT_ONBOARDING_URL,
        };
      }
    }

    // notBefore MUST be in the past
    if (payload.notBefore) {
      const notBefore = new Date(payload.notBefore).getTime();
      if (notBefore > now) {
        return {
          grantAccess: false,
          reason: "INVALID_SIGNATURE",
          onboardingUrl: DEFAULT_ONBOARDING_URL,
        };
      }
    }

    // 6. Extract numeric chain ID from CAIP-2 format (e.g. "eip155:8453" → 8453)
    const numericChainId = parseInt(payload.chainId.split(":")[1], 10);

    // 7. Reconstruct SIWE message from payload fields and verify
    let siweMsg: SiweMessage;
    try {
      siweMsg = new SiweMessage({
        domain: payload.domain,
        address: payload.address,
        uri: payload.uri,
        version: payload.version,
        chainId: numericChainId,
        nonce: payload.nonce,
        issuedAt: payload.issuedAt,
        expirationTime: payload.expirationTime,
        notBefore: payload.notBefore,
        statement: payload.statement,
        requestId: payload.requestId,
        resources: payload.resources,
      });
    } catch {
      return {
        grantAccess: false,
        reason: "INVALID_SIGNATURE",
        onboardingUrl: DEFAULT_ONBOARDING_URL,
      };
    }

    // 8. Verify the EVM signature
    try {
      await siweMsg.verify({ signature: payload.signature });
    } catch {
      return {
        grantAccess: false,
        reason: "INVALID_SIGNATURE",
        onboardingUrl: DEFAULT_ONBOARDING_URL,
      };
    }

    // 9. Recover wallet address
    const walletAddress = siweMsg.address.toLowerCase();

    // 10. Call verify endpoint to check KYC status
    try {
      const response = await fetch(`${verifyEndpoint}/${walletAddress}`);
      const data = await response.json();

      if (data.verified === true) {
        return { grantAccess: true };
      }

      return {
        grantAccess: false,
        reason: data.reason || "KYC_NOT_FOUND",
        onboardingUrl: DEFAULT_ONBOARDING_URL,
      };
    } catch {
      return {
        grantAccess: false,
        reason: "KYC_NOT_FOUND",
        onboardingUrl: DEFAULT_ONBOARDING_URL,
      };
    }
  };
}
