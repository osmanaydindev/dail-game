import { z } from 'zod';
import { USERNAME, PASSWORD, EMAIL, DISPLAY_NAME, isWeakPassword } from './user.schemas';

export const loginSchema = z.object({
  email: EMAIL,
  // Bounded like the registration password so a huge string never reaches bcrypt.
  password: z.string().min(1).max(128),
});

// Same field rules as admin-created users — role is deliberately not accepted,
// self-registration can never mint an admin.
export const registerSchema = z
  .object({
    email: EMAIL,
    password: PASSWORD,
    username: USERNAME,
    displayName: DISPLAY_NAME,
    locale: z.enum(['tr', 'en']).default('tr'),
  })
  .superRefine((v, ctx) => {
    const weak = isWeakPassword(v.password, v.username, v.email);
    if (weak) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['password'], message: weak });
  });

export const verifyEmailSchema = z.object({
  // Tokens are 48 random bytes rendered as hex — nothing else is accepted, so
  // malformed input is rejected before it ever reaches a database lookup.
  token: z.string().length(96).regex(/^[a-f0-9]+$/),
});

export const resendVerificationSchema = z.object({
  email: EMAIL,
  locale: z.enum(['tr', 'en']).default('tr'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
