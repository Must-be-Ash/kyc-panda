import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectToDatabase } from "@/lib/mongodb";
import { Onboarding } from "@/lib/models/onboarding";
import { VerifiedWallet } from "@/lib/models/verifiedWallet";

const DIDIT_WEBHOOK_SECRET = process.env.DIDIT_WEBHOOK_SECRET || "";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Verify webhook signature (Didit v3 uses x-signature-v2 header)
    const signature = request.headers.get("x-signature-v2") || "";
    if (!verifyWebhookSignature(rawBody, signature, DIDIT_WEBHOOK_SECRET)) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    const payload = JSON.parse(rawBody);
    const { vendor_data: onboardingId, status, session_id: sessionId } = payload;

    if (!onboardingId) {
      return NextResponse.json(
        { error: "Missing vendor_data (onboardingId)" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Look up onboarding record
    const onboarding = await Onboarding.findOne({ onboardingId });
    if (!onboarding) {
      return NextResponse.json(
        { error: "Onboarding record not found" },
        { status: 404 }
      );
    }

    // Map Didit status to our kycStatus
    let kycStatus: "approved" | "declined" | "review";
    if (status === "Approved") {
      kycStatus = "approved";
    } else if (status === "Declined") {
      kycStatus = "declined";
    } else {
      kycStatus = "review";
    }

    // Update onboarding record
    onboarding.kycStatus = kycStatus;
    if (sessionId) {
      onboarding.diditSessionId = sessionId;
    }
    await onboarding.save();

    // Upsert into verifiedWallets
    const now = new Date();
    const walletUpdate: Record<string, unknown> = {
      walletAddress: onboarding.walletAddress,
      chain: onboarding.chain,
      kycStatus,
      diditSessionId: sessionId || onboarding.diditSessionId,
    };

    if (kycStatus === "approved") {
      walletUpdate.verifiedAt = now;
      walletUpdate.expiresAt = new Date(now.getTime() + ONE_YEAR_MS);
    }

    await VerifiedWallet.findOneAndUpdate(
      { walletAddress: onboarding.walletAddress },
      { $set: walletUpdate },
      { upsert: true, new: true }
    );

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
