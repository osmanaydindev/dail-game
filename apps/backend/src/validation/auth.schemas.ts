import { z } from 'zod';
import { USERNAME, PASSWORD } from './user.schemas';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Same field rules as admin-created users — role is deliberately not accepted,
// self-registration can never mint an admin.
export const registerSchema = z.object({
  email: z.string().email(),
  password: PASSWORD,
  username: USERNAME,
  displayName: z.string().min(1).max(50).trim(),
  locale: z.enum(['tr', 'en']).default('tr'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(16).max(256),
});

export const resendVerificationSchema = z.object({
  email: z.string().email(),
  locale: z.enum(['tr', 'en']).default('tr'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
