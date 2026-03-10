import type { KYCGateExtension } from "./types";

const DEFAULT_ONBOARDING_URL = "https://kyc-panda.vercel.app/api/onboard";

export function declareKYCGateExtension(
  overrides: Partial<KYCGateExtension["kyc-gate"]> = {}
): KYCGateExtension {
  return {
    "kyc-gate": {
      required: true,
      onboardingUrl: overrides.onboardingUrl || DEFAULT_ONBOARDING_URL,
      supportedChains: overrides.supportedChains || ["eip155:*"],
      provider: overrides.provider || "didit",
    },
  };
}
