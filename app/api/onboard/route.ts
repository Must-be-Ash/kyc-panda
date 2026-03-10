import { NextRequest, NextResponse } from "next/server";
import { SiweMessage } from "siwe";
import { v4 as uuidv4 } from "uuid";
import { connectToDatabase } from "@/lib/mongodb";
import { Onboarding } from "@/lib/models/onboarding";
import { UsedNonce } from "@/lib/models/usedNonce";
import { rateLimit } from "@/lib/rateLimit";

const SIWX_DOMAIN = process.env.SIWX_DOMAIN || "kyc-panda.vercel.app";
const DIDIT_API_KEY = process.env.DIDIT_API_KEY;
const DIDIT_WORKFLOW_ID = process.env.DIDIT_WORKFLOW_ID;
const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes
const NONCE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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

    const body = await request.json();
    const { siwxMessage, signature } = body;

    if (!siwxMessage || !signature) {
      return NextResponse.json(
        { error: "Missing siwxMessage or signature" },
        { status: 400 }
      );
    }

    // Parse the SIWX message
    let siweMsg: SiweMessage;
    try {
      siweMsg = new SiweMessage(siwxMessage);
    } catch {
      return NextResponse.json(
        { error: "Invalid SIWX message format" },
        { status: 400 }
      );
    }

    // Validate domain
    if (siweMsg.domain !== SIWX_DOMAIN) {
      return NextResponse.json(
        { error: "Domain mismatch" },
        { status: 400 }
      );
    }

    // Validate issuedAt is within the last 5 minutes and not in the future
    if (siweMsg.issuedAt) {
      const issuedAt = new Date(siweMsg.issuedAt).getTime();
      if (issuedAt > Date.now()) {
        return NextResponse.json(
          { error: "issuedAt is in the future" },
          { status: 400 }
        );
      }
      if (Date.now() - issuedAt > MAX_AGE_MS) {
        return NextResponse.json(
          { error: "Message too old — issuedAt is more than 5 minutes ago" },
          { status: 400 }
        );
      }
    }

    // Validate expirationTime is in the future
    if (siweMsg.expirationTime) {
      const expiration = new Date(siweMsg.expirationTime).getTime();
      if (expiration <= Date.now()) {
        return NextResponse.json(
          { error: "Message has expired" },
          { status: 400 }
        );
      }
    }

    // Connect to DB
    await connectToDatabase();

    // Check nonce hasn't been used
    const existingNonce = await UsedNonce.findOne({ nonce: siweMsg.nonce });
    if (existingNonce) {
      return NextResponse.json(
        { error: "NONCE_REUSED", message: "Replay attack detected — nonce already used" },
        { status: 400 }
      );
    }

    // Verify the EVM signature using siwe's built-in verification
    try {
      await siweMsg.verify({ signature });
    } catch {
      return NextResponse.json(
        { error: "INVALID_SIGNATURE", message: "SIWX signature verification failed" },
        { status: 401 }
      );
    }

    // Mark nonce as used
    await UsedNonce.create({
      nonce: siweMsg.nonce,
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + NONCE_TTL_MS),
    });

    // Generate onboarding ID
    const onboardingId = uuidv4();
    const walletAddress = siweMsg.address.toLowerCase();
    const chain = `eip155:${siweMsg.chainId}`;

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
          "x-api-key": DIDIT_API_KEY || "",
        },
        body: JSON.stringify({
          workflow_id: DIDIT_WORKFLOW_ID,
          vendor_data: onboardingId,
          callback: `https://${SIWX_DOMAIN}`,
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
