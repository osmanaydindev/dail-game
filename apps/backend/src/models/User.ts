import mongoose, { Document, Schema } from 'mongoose';
import type { Role } from '@dail-game/types';

export interface IUser extends Document {
  email: string;
  username: string;
  displayName: string;
  passwordHash: string;
  role: Role;
  avatarUrl?: string;
  isActive: boolean;
  emailVerified: boolean;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 20 },
    displayName: { type: String, required: true, trim: true, maxlength: 50 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    avatarUrl: { type: String, default: undefined },
    isActive: { type: Boolean, default: true },
    // Self-registered users start unverified and cannot log in until they click
    // the emailed link. Admin-created and seeded accounts are verified up front.
    emailVerified: { type: Boolean, default: false },
    createdBy:{ type: Schema.Types.ObjectId, ref: 'User', default: undefined },
  },
  { timestamps: true },
);

userSchema.index({ role: 1 }); // email index is implicit from unique:true

export const User = mongoose.model<IUser>('User', userSchema);
