import { SiweMessage } from "siwe";
import type { KYCGateConfig, KYCGateResult } from "./types";

const DEFAULT_VERIFY_ENDPOINT = "https://kyc-panda.vercel.app/api/verify";
const DEFAULT_ONBOARDING_URL = "https://kyc-panda.vercel.app/api/onboard";

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

    // 4. Extract numeric chain ID from CAIP-2 format (e.g. "eip155:8453" → 8453)
    const numericChainId = parseInt(payload.chainId.split(":")[1], 10);

    // 5. Reconstruct SIWE message from payload fields and verify
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

    // 6. Verify the EVM signature
    try {
      await siweMsg.verify({ signature: payload.signature });
    } catch {
      return {
        grantAccess: false,
        reason: "INVALID_SIGNATURE",
        onboardingUrl: DEFAULT_ONBOARDING_URL,
      };
    }

    // 7. Recover wallet address
    const walletAddress = siweMsg.address.toLowerCase();

    // 8. Call verify endpoint to check KYC status
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
