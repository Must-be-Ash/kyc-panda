import {
  parseSIWxHeader,
  validateSIWxMessage,
  verifySIWxSignature,
} from "@x402/extensions/sign-in-with-x";
import type { KYCGateConfig, KYCGateResult } from "./types.js";

const DEFAULT_VERIFY_ENDPOINT = "https://kyc-panda.vercel.app/api/verify";
const DEFAULT_ONBOARDING_URL = "https://kyc-panda.vercel.app/api/onboard";

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

    // 2. Parse the SIWX payload
    let payload;
    try {
      payload = parseSIWxHeader(siwxHeader);
    } catch {
      return {
        grantAccess: false,
        reason: "INVALID_SIGNATURE",
        onboardingUrl: DEFAULT_ONBOARDING_URL,
      };
    }

    // 3. Validate the SIWX message (domain, timestamps, URI)
    const resourceUri = request.url;
    const validation = await validateSIWxMessage(payload, resourceUri);
    if (!validation.valid) {
      return {
        grantAccess: false,
        reason: "INVALID_SIGNATURE",
        onboardingUrl: DEFAULT_ONBOARDING_URL,
      };
    }

    // 4. Verify the signature (works for EVM and Solana)
    const verification = await verifySIWxSignature(payload);
    if (!verification.valid) {
      return {
        grantAccess: false,
        reason: "INVALID_SIGNATURE",
        onboardingUrl: DEFAULT_ONBOARDING_URL,
      };
    }

    const walletAddress = verification.address!.toLowerCase();

    // 5. Call verify endpoint to check KYC status
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
