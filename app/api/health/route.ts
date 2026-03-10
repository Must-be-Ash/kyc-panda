import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import mongoose from "mongoose";

export async function GET() {
  try {
    await connectToDatabase();
    const readyState = mongoose.connection.readyState;
    // 1 = connected
    if (readyState === 1) {
      return NextResponse.json({ status: "ok", db: "connected" });
    }
    return NextResponse.json(
      { status: "error", db: "not connected", readyState },
      { status: 503 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}
