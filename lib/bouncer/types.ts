export interface KYCGateConfig {
  verifyEndpoint?: string;
}

export interface KYCGateResult {
  grantAccess: boolean;
  reason?: string;
  onboardingUrl?: string;
}

export interface KYCGateExtension {
  "kyc-gate": {
    required: boolean;
    onboardingUrl: string;
    supportedChains: string[];
    provider: string;
  };
}
