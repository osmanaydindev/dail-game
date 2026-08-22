import { z } from 'zod';

const HTTPS_URL = z.string().url().regex(/^https:\/\//, 'Avatar URL must be HTTPS');

/** Shared by admin user creation and public self-registration. */
export const USERNAME = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores');

// bcrypt only reads the first 72 bytes, so anything past that is dead weight —
// the cap exists to bound what we hash and store, not to limit the user.
// Composition is kept deliberately light (length matters more than symbol
// classes); the real win is the blocklist and the "don't reuse your username"
// check in registerSchema.
export const PASSWORD = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/\p{L}/u, 'Password must contain at least one letter')
  .regex(/\d/, 'Password must contain at least one number');

/** The passwords that actually show up in credential-stuffing lists. */
const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', 'password', 'password1', 'password123',
  'qwerty123', 'qwertyui', 'abc12345', 'iloveyou', 'admin123', 'welcome1',
  'letmein1', 'football', 'baseball', 'sunshine', 'princess', 'dragon12',
  'monkey12', 'trustno1', 'passw0rd', '11111111', '00000000', 'asdasdasd',
  'sifre123', 'parola123', 'galatasaray', 'fenerbahce', 'besiktas1', 'turkiye1',
]);

export function isWeakPassword(password: string, username: string, email: string): string | null {
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return 'This password is too common';
  if (username && lower.includes(username.toLowerCase())) return 'Password must not contain your username';
  const localPart = email.split('@')[0]?.toLowerCase();
  if (localPart && localPart.length >= 3 && lower.includes(localPart)) {
    return 'Password must not contain your email address';
  }
  return null;
}

// 254 is the RFC 5321 maximum for a deliverable address. Bounding it keeps
// oversized values out of the email regex and out of the database.
export const EMAIL = z.string().trim().toLowerCase().max(254).email();

// Rejects Unicode control/format characters (\p{C}) — zero-width joiners,
// RTL overrides and newlines that would otherwise let a display name spoof
// layout in the leaderboard or smuggle headers into outgoing mail.
export const DISPLAY_NAME = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .regex(/^[^\p{C}]+$/u, 'Display name contains invalid characters');

export const createUserSchema = z.object({
  email: EMAIL,
  password: PASSWORD,
  username: USERNAME,
  displayName: DISPLAY_NAME,
  role: z.enum(['admin', 'user']).default('user'),
});

export const updateSelfSchema = z.object({
  username: USERNAME.optional(),
  displayName: DISPLAY_NAME.optional(),
  avatarUrl: HTTPS_URL.optional().nullable(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: PASSWORD,
});

export const adminResetPasswordSchema = z.object({
  newPassword: PASSWORD,
});

export const adminUpdateUserSchema = z.object({
  username: USERNAME.optional(),
  displayName: DISPLAY_NAME.optional(),
  avatarUrl: HTTPS_URL.optional().nullable(),
  role: z.enum(['admin', 'user']).optional(),
  isActive: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateSelfInput = z.infer<typeof updateSelfSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
export type AdminResetPasswordInput = z.infer<typeof adminResetPasswordSchema>;
