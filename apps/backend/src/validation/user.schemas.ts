import { z } from 'zod';

const HTTPS_URL = z.string().url().regex(/^https:\/\//, 'Avatar URL must be HTTPS');

/** Shared by admin user creation and public self-registration. */
export const USERNAME = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(20, 'Username must be at most 20 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores');

export const PASSWORD = z.string().min(8, 'Password must be at least 8 characters').max(128);

export const createUserSchema = z.object({
  email: z.string().email(),
  password: PASSWORD,
  username: USERNAME,
  displayName: z.string().min(1).max(50).trim(),
  role: z.enum(['admin', 'user']).default('user'),
});

export const updateSelfSchema = z.object({
  username: USERNAME.optional(),
  displayName: z.string().min(1).max(50).trim().optional(),
  avatarUrl: HTTPS_URL.optional().nullable(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export const adminResetPasswordSchema = z.object({
  newPassword: z.string().min(8).max(128),
});

export const adminUpdateUserSchema = z.object({
  username: USERNAME.optional(),
  displayName: z.string().min(1).max(50).trim().optional(),
  avatarUrl: HTTPS_URL.optional().nullable(),
  role: z.enum(['admin', 'user']).optional(),
  isActive: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateSelfInput = z.infer<typeof updateSelfSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
export type AdminResetPasswordInput = z.infer<typeof adminResetPasswordSchema>;
