import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { VerifiedWallet } from "@/lib/models/verifiedWallet";
import { rateLimit } from "@/lib/rateLimit";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    // Rate limit: 60 requests per minute per IP to prevent address enumeration
    const ip = _request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { allowed } = rateLimit(`verify:${ip}`, 60, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429 }
      );
    }

    const { address } = await params;
    const walletAddress = address.toLowerCase();

    await connectToDatabase();

    const wallet = await VerifiedWallet.findOne({ walletAddress });

    if (!wallet) {
      return NextResponse.json({
        verified: false,
        reason: "KYC_NOT_FOUND",
      });
    }

    if (wallet.kycStatus === "declined") {
      return NextResponse.json({
        verified: false,
        reason: "KYC_DECLINED",
      });
    }

    if (wallet.kycStatus === "review") {
      return NextResponse.json({
        verified: false,
        reason: "KYC_PENDING_REVIEW",
      });
    }

    if (wallet.kycStatus === "expired") {
      return NextResponse.json({
        verified: false,
        reason: "KYC_EXPIRED",
      });
    }

    // Status is "approved" — check expiration
    if (wallet.expiresAt && new Date(wallet.expiresAt) <= new Date()) {
      return NextResponse.json({
        verified: false,
        reason: "KYC_EXPIRED",
      });
    }

    return NextResponse.json({
      verified: true,
    });
  } catch (error) {
    console.error("Verify error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
