import crypto from "crypto";
import type { KYCGateExtensions, DeclareKYCGateOptions } from "./types";

const DEFAULT_ONBOARDING_URL = "https://kyc-panda.vercel.app/api/onboard";
const EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

/** JSON Schema for the SIWX client proof, per the sign-in-with-x spec */
const SIWX_PROOF_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: {
    domain: { type: "string" },
    address: { type: "string" },
    statement: { type: "string" },
    uri: { type: "string", format: "uri" },
    version: { type: "string" },
    chainId: { type: "string" },
    type: { type: "string" },
    nonce: { type: "string" },
    issuedAt: { type: "string", format: "date-time" },
    expirationTime: { type: "string", format: "date-time" },
    notBefore: { type: "string", format: "date-time" },
    requestId: { type: "string" },
    resources: { type: "array", items: { type: "string", format: "uri" } },
    signature: { type: "string" },
  },
  required: [
    "domain",
    "address",
    "uri",
    "version",
    "chainId",
    "type",
    "nonce",
    "issuedAt",
    "signature",
  ],
};

/**
 * Declares the extensions object for a 402 response.
 * Emits a spec-compliant `sign-in-with-x` challenge (with fresh nonce + timestamps)
 * alongside `kyc-gate` metadata so agents know KYC is required.
 */
export function declareKYCGateExtension(
  options: DeclareKYCGateOptions
): KYCGateExtensions {
  const now = new Date();
  const nonce = crypto.randomBytes(16).toString("hex"); // 32 hex chars

  return {
    "sign-in-with-x": {
      info: {
        domain: options.domain,
        uri: options.uri,
        version: "1",
        nonce,
        issuedAt: now.toISOString(),
        expirationTime: new Date(now.getTime() + EXPIRATION_MS).toISOString(),
        statement: options.statement || "Sign in to verify KYC status",
        resources: [options.uri],
      },
      supportedChains: options.supportedChains || [
        { chainId: "eip155:8453", type: "eip191" },
      ],
      schema: SIWX_PROOF_SCHEMA,
    },
    "kyc-gate": {
      required: true,
      onboardingUrl: options.onboardingUrl || DEFAULT_ONBOARDING_URL,
      provider: options.provider || "didit",
      onboarding: {
        method: "POST",
        contentType: "application/json",
        body: {
          siwxMessage: "SIWX (CAIP-122) formatted message string. Domain must match the onboarding host. Use a fresh nonce, issuedAt within 5 minutes.",
          signature: "Wallet signature of the siwxMessage, hex-encoded with 0x prefix.",
        },
        response: {
          onboardingId: "UUID tracking this onboarding session",
          verificationUrl: "URL where the human wallet owner completes identity verification",
        },
        docsUrl: `${options.onboardingUrl || DEFAULT_ONBOARDING_URL}`,
      },
    },
  };
}
