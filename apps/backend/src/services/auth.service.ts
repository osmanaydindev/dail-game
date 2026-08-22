import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type mongoose from 'mongoose';
import { User } from '../models/User';
import { RefreshToken } from '../models/RefreshToken';
import { VerificationToken } from '../models/VerificationToken';
import { PasswordResetToken } from '../models/PasswordResetToken';
import { signAccessToken } from '../utils/jwt';
import { generateOpaqueToken, hashToken } from '../utils/crypto';
import { env } from '../config/env';
import type { IUser } from '../models/User';

const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function validatePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// bcrypt hash of a value nobody knows. Comparing against it costs the same as a
// real check, so "no such account" and "wrong password" take the same time and
// response latency stops revealing which addresses are registered.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), BCRYPT_ROUNDS);

export async function burnPasswordComparison(password: string): Promise<void> {
  await bcrypt.compare(password, DUMMY_HASH);
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export async function issueTokens(user: IUser, userAgent?: string, ip?: string): Promise<TokenPair> {
  const accessToken = signAccessToken(user.id as string, user.role);
  const rawRefresh = generateOpaqueToken();
  const tokenHash = hashToken(rawRefresh);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_MS);

  await RefreshToken.create({ userId: user._id, tokenHash, expiresAt, userAgent, ip });

  return { accessToken, refreshToken: rawRefresh };
}

export async function rotateRefreshToken(
  rawToken: string,
  userAgent?: string,
  ip?: string,
): Promise<{ tokens: TokenPair; user: IUser } | null> {
  const tokenHash = hashToken(rawToken);
  const record = await RefreshToken.findOne({ tokenHash, revokedAt: { $exists: false } });

  if (!record || record.expiresAt < new Date()) {
    // Revoke all tokens for this user if record found (potential replay attack)
    if (record) await RefreshToken.updateMany({ userId: record.userId }, { revokedAt: new Date() });
    return null;
  }

  const user = await User.findById(record.userId);
  if (!user || !user.isActive) return null;

  // Revoke old token
  record.revokedAt = new Date();
  await record.save();

  const tokens = await issueTokens(user, userAgent, ip);
  return { tokens, user };
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await RefreshToken.findOneAndUpdate({ tokenHash }, { revokedAt: new Date() });
}

// ─── Email verification ──────────────────────────────────────────────────────

/**
 * Issues a fresh verification token, invalidating any outstanding ones so an
 * old link in the user's inbox stops working once they request a new mail.
 * Returns the raw token — only its sha256 hash is stored.
 */
export async function issueVerificationToken(userId: mongoose.Types.ObjectId): Promise<string> {
  await VerificationToken.updateMany(
    { userId, usedAt: { $exists: false } },
    { usedAt: new Date() },
  );

  const rawToken = generateOpaqueToken();
  await VerificationToken.create({
    userId,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + env.EMAIL_VERIFICATION_TTL_MS),
  });
  return rawToken;
}

/** Consumes a verification token. Returns the now-verified user, or null. */
export async function consumeVerificationToken(rawToken: string): Promise<IUser | null> {
  const record = await VerificationToken.findOne({
    tokenHash: hashToken(rawToken),
    usedAt: { $exists: false },
  });
  if (!record || record.expiresAt < new Date()) return null;

  const user = await User.findById(record.userId);
  if (!user || !user.isActive) return null;

  record.usedAt = new Date();
  await record.save();

  if (!user.emailVerified) {
    user.emailVerified = true;
    await user.save();
  }
  return user;
}

// ─── Password reset ──────────────────────────────────────────────────────────

/** Refuse to mint a second reset token this soon after the last one. */
const RESET_COOLDOWN_MS = 60_000;

/**
 * Returns the raw token, or null when a token was already issued within the
 * cooldown. The cooldown is per-account, so a distributed attacker who can
 * rotate IPs past the per-IP rate limit still cannot flood one victim's inbox.
 */
export async function issuePasswordResetToken(
  userId: mongoose.Types.ObjectId,
  ip?: string,
): Promise<string | null> {
  const recent = await PasswordResetToken.findOne({
    userId,
    usedAt: { $exists: false },
    createdAt: { $gt: new Date(Date.now() - RESET_COOLDOWN_MS) },
  });
  if (recent) return null;

  // Requesting a new link invalidates any older one still sitting in the inbox.
  await PasswordResetToken.updateMany(
    { userId, usedAt: { $exists: false } },
    { usedAt: new Date() },
  );

  const rawToken = generateOpaqueToken();
  await PasswordResetToken.create({
    userId,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + env.PASSWORD_RESET_TTL_MS),
    requestedIp: ip,
  });
  return rawToken;
}

export type ResetOutcome =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'same_password' };

/**
 * Consumes a reset token and sets the new password. Every refresh token for the
 * account is revoked: if the reset was triggered because someone else got in,
 * this is what actually kicks them out.
 */
export async function resetPasswordWithToken(
  rawToken: string,
  newPassword: string,
): Promise<ResetOutcome> {
  const record = await PasswordResetToken.findOne({
    tokenHash: hashToken(rawToken),
    usedAt: { $exists: false },
  });
  if (!record || record.expiresAt < new Date()) return { ok: false, reason: 'invalid' };

  const user = await User.findById(record.userId).select('+passwordHash');
  if (!user || !user.isActive) return { ok: false, reason: 'invalid' };

  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    // Leave the token unspent so the user can retry with a different password.
    return { ok: false, reason: 'same_password' };
  }

  record.usedAt = new Date();
  await record.save();

  user.passwordHash = await hashPassword(newPassword);
  // Someone who can read the inbox has proven ownership of the address, so a
  // successful reset also completes email verification.
  user.emailVerified = true;
  await user.save();

  await RefreshToken.updateMany(
    { userId: user._id, revokedAt: { $exists: false } },
    { revokedAt: new Date() },
  );

  return { ok: true };
}
