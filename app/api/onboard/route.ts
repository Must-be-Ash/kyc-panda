import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { connectToDatabase } from "@/lib/mongodb";
import { Onboarding } from "@/lib/models/onboarding";
import { UsedNonce } from "@/lib/models/usedNonce";
import { rateLimit } from "@/lib/rateLimit";
import {
  parseSIWxHeader,
  validateSIWxMessage,
  verifySIWxSignature,
} from "@x402/extensions/sign-in-with-x";

const SIWX_DOMAIN = process.env.SIWX_DOMAIN || "kyc-panda.vercel.app";
const DIDIT_API_KEY = process.env.DIDIT_API_KEY;
const DIDIT_WORKFLOW_ID = process.env.DIDIT_WORKFLOW_ID;
const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes
const NONCE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * GET /api/onboard — API discovery for agents.
 * Returns the request/response schema so agents know how to call this endpoint.
 */
export async function GET() {
  return NextResponse.json({
    description: "Start KYC verification for a wallet. Submit a signed SIWX (CAIP-122) payload to prove wallet ownership, then complete identity verification at the returned URL.",
    method: "POST",
    contentType: "application/json",
    request: {
      siwxHeader: {
        type: "string",
        description: "Base64-encoded SIWX payload JSON. Same format as the SIGN-IN-WITH-X header used in x402 requests. Create with createSIWxPayload() + encodeSIWxHeader() from @x402/extensions/sign-in-with-x, or manually base64-encode a JSON object with: domain, address, uri, version, chainId, type, nonce, issuedAt, signature (and optionally statement, expirationTime, resources).",
        example: "eyJkb21haW4iOiJreWMtcGFuZGEudmVyY2VsLmFwcCIsImFkZHJlc3MiOiIweC4uLiIsInVyaSI6Imh0dHBzOi8va3ljLXBhbmRhLnZlcmNlbC5hcHAvYXBpL29uYm9hcmQiLCJ2ZXJzaW9uIjoiMSIsImNoYWluSWQiOiJlaXAxNTU6ODQ1MzIiLCJ0eXBlIjoiZWlwMTkxIiwibm9uY2UiOiIuLi4iLCJpc3N1ZWRBdCI6Ii4uLiIsInNpZ25hdHVyZSI6IjB4Li4uIn0=",
      },
    },
    siwxParams: {
      domain: SIWX_DOMAIN,
      uri: `https://${SIWX_DOMAIN}/api/onboard`,
      statement: "Sign in to start KYC verification",
      supportedChains: [
        { chainId: "eip155:84532", type: "eip191" },
        { chainId: "eip155:8453", type: "eip191" },
      ],
    },
    response: {
      onboardingId: {
        type: "string (UUID)",
        description: "Tracking ID for this onboarding session",
      },
      verificationUrl: {
        type: "string (URL)",
        description: "Didit hosted verification URL. The human wallet owner must open this to complete identity verification.",
      },
    },
    errors: {
      400: "Invalid SIWX payload, domain mismatch, expired message, or nonce reuse",
      401: "Signature verification failed",
      429: "Rate limit exceeded (10 requests/minute per IP)",
      502: "KYC provider unavailable",
    },
    flow: [
      "1. Create a SIWX payload with domain '" + SIWX_DOMAIN + "' and URI 'https://" + SIWX_DOMAIN + "/api/onboard'",
      "2. Sign the message with the wallet (works for any supported chain — EVM, Solana, etc.)",
      "3. Base64-encode the SIWX payload JSON",
      "4. POST { siwxHeader: '<base64-encoded-payload>' } to this endpoint",
      "5. Receive { onboardingId, verificationUrl }",
      "6. Human opens verificationUrl to complete identity verification",
      "7. Once approved, the wallet can pass KYC-gated x402 endpoints",
    ],
    openapi: "https://kyc-panda.vercel.app/openapi.json",
  });
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 requests per minute per IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { allowed } = rateLimit(`onboard:${ip}`, 10, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429 }
      );
    }

    if (!DIDIT_API_KEY || !DIDIT_WORKFLOW_ID) {
      return NextResponse.json(
        { error: "KYC service not configured" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { siwxHeader } = body;

    if (!siwxHeader) {
      return NextResponse.json(
        { error: "Missing siwxHeader. POST { siwxHeader: '<base64-encoded SIWX payload>' }. GET this endpoint for full docs." },
        { status: 400 }
      );
    }

    // Parse the SIWX payload (base64-encoded JSON)
    let payload;
    try {
      payload = parseSIWxHeader(siwxHeader);
    } catch {
      return NextResponse.json(
        { error: "Invalid SIWX payload. Must be base64-encoded JSON with domain, address, uri, version, chainId, type, nonce, issuedAt, signature." },
        { status: 400 }
      );
    }

    // Validate domain
    if (payload.domain !== SIWX_DOMAIN) {
      return NextResponse.json(
        { error: `Domain mismatch. Expected '${SIWX_DOMAIN}', got '${payload.domain}'.` },
        { status: 400 }
      );
    }

    // Connect to DB (needed for nonce check)
    await connectToDatabase();

    // Validate the SIWX message (timestamps, URI, nonce)
    const resourceUri = `https://${SIWX_DOMAIN}/api/onboard`;
    const validation = await validateSIWxMessage(payload, resourceUri, {
      maxAge: MAX_AGE_MS,
      checkNonce: async (nonce: string) => {
        const existing = await UsedNonce.findOne({ nonce });
        return !existing;
      },
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Verify the signature (works for EVM and Solana)
    const verification = await verifySIWxSignature(payload);
    if (!verification.valid) {
      return NextResponse.json(
        { error: "INVALID_SIGNATURE", message: verification.error || "SIWX signature verification failed" },
        { status: 401 }
      );
    }

    const address = verification.address!;

    // Mark nonce as used
    await UsedNonce.create({
      nonce: payload.nonce,
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + NONCE_TTL_MS),
    });

    // Generate onboarding ID
    const onboardingId = uuidv4();
    const walletAddress = address.toLowerCase();
    const chain = payload.chainId;

    // Create onboarding record
    const onboarding = await Onboarding.create({
      onboardingId,
      walletAddress,
      chain,
      kycStatus: "pending",
    });

    // Create Didit verification session
    let verificationUrl: string;
    try {
      const diditResponse = await fetch("https://verification.didit.me/v2/session/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": DIDIT_API_KEY,
        },
        body: JSON.stringify({
          workflow_id: DIDIT_WORKFLOW_ID,
          vendor_data: onboardingId,
          callback: `https://${SIWX_DOMAIN}/api/webhook`,
          metadata: { walletAddress, chain },
        }),
      });

      if (!diditResponse.ok) {
        const errorText = await diditResponse.text();
        console.error("Didit API error:", diditResponse.status, errorText);
        return NextResponse.json(
          { error: "Failed to create verification session" },
          { status: 502 }
        );
      }

      const diditData = await diditResponse.json();
      verificationUrl = diditData.url;

      // Update onboarding record with Didit session ID
      onboarding.diditSessionId = diditData.session_id;
      await onboarding.save();
    } catch (error) {
      console.error("Didit API call failed:", error);
      return NextResponse.json(
        { error: "Failed to create verification session" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      onboardingId,
      verificationUrl,
    });
  } catch (error) {
    console.error("Onboard error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
