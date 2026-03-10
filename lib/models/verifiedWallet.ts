import mongoose, { Schema, Document } from "mongoose";

export interface IVerifiedWallet extends Document {
  walletAddress: string;
  chain: string;
  kycStatus: "approved" | "declined" | "review" | "expired";
  diditSessionId: string;
  verifiedAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const VerifiedWalletSchema = new Schema<IVerifiedWallet>(
  {
    walletAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    chain: {
      type: String,
      required: true,
    },
    kycStatus: {
      type: String,
      enum: ["approved", "declined", "review", "expired"],
      required: true,
      index: true,
    },
    diditSessionId: {
      type: String,
      required: true,
    },
    verifiedAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export const VerifiedWallet =
  mongoose.models.VerifiedWallet ||
  mongoose.model<IVerifiedWallet>("VerifiedWallet", VerifiedWalletSchema);
