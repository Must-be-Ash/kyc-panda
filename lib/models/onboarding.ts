import mongoose, { Schema, Document } from "mongoose";

export interface IOnboarding extends Document {
  onboardingId: string;
  walletAddress: string;
  chain: string;
  diditSessionId: string;
  kycStatus: "pending" | "approved" | "declined" | "review";
  createdAt: Date;
  updatedAt: Date;
}

const OnboardingSchema = new Schema<IOnboarding>(
  {
    onboardingId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    walletAddress: {
      type: String,
      required: true,
      index: true,
    },
    chain: {
      type: String,
      required: true,
    },
    diditSessionId: {
      type: String,
      default: "",
    },
    kycStatus: {
      type: String,
      enum: ["pending", "approved", "declined", "review"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

export const Onboarding =
  mongoose.models.Onboarding ||
  mongoose.model<IOnboarding>("Onboarding", OnboardingSchema);
