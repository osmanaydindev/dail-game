import mongoose, { Document, Schema } from 'mongoose';

export interface IVerificationToken extends Document {
  userId: mongoose.Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

const verificationTokenSchema = new Schema<IVerificationToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: undefined },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

verificationTokenSchema.index({ userId: 1 });
verificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index — auto-delete expired

export const VerificationToken = mongoose.model<IVerificationToken>(
  'VerificationToken',
  verificationTokenSchema,
);
