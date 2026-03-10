import mongoose, { Schema, Document } from "mongoose";

export interface IUsedNonce extends Document {
  nonce: string;
  usedAt: Date;
  expiresAt: Date;
}

const UsedNonceSchema = new Schema<IUsedNonce>({
  nonce: {
    type: String,
    required: true,
    unique: true,
  },
  usedAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }, // TTL index — MongoDB auto-deletes when expiresAt is reached
  },
});

export const UsedNonce =
  mongoose.models.UsedNonce ||
  mongoose.model<IUsedNonce>("UsedNonce", UsedNonceSchema);
