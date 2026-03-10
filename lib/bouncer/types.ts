export interface KYCGateConfig {
  verifyEndpoint?: string;
}

export interface KYCGateResult {
  grantAccess: boolean;
  reason?: string;
  onboardingUrl?: string;
}

/** SIWX challenge info fields per CAIP-122 / x402 sign-in-with-x spec */
export interface SIWxChallengeInfo {
  domain: string;
  uri: string;
  version: string;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
  statement?: string;
  notBefore?: string;
  requestId?: string;
  resources?: string[];
}

export interface SupportedChain {
  chainId: string;
  type: string;
  signatureScheme?: string;
}

/** The spec-compliant sign-in-with-x extension shape for 402 responses */
export interface SIWxExtension {
  info: SIWxChallengeInfo;
  supportedChains: SupportedChain[];
  schema: Record<string, unknown>;
}

/** KYC-specific metadata alongside the SIWX challenge */
export interface KYCGateMetadata {
  required: boolean;
  onboardingUrl: string;
  provider: string;
}

/** Combined extensions object for 402 responses */
export interface KYCGateExtensions {
  "sign-in-with-x": SIWxExtension;
  "kyc-gate": KYCGateMetadata;
}

export interface DeclareKYCGateOptions {
  domain: string;
  uri: string;
  statement?: string;
  onboardingUrl?: string;
  provider?: string;
  supportedChains?: SupportedChain[];
}
