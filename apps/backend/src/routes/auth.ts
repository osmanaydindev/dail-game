import { Router } from 'express';
import {
  login, register, verifyEmail, resendVerification,
  forgotPassword, resetPassword, refresh, logout,
} from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { authLimiter, registerLimiter, passwordResetLimiter } from '../middleware/rateLimiter';
import {
  loginSchema,
  registerSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validation/auth.schemas';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/register', registerLimiter, validate(registerSchema), register);
router.post('/verify-email', authLimiter, validate(verifyEmailSchema), verifyEmail);
router.post('/resend-verification', registerLimiter, validate(resendVerificationSchema), resendVerification);
// forgot-password sends mail, so it gets the strict per-IP limiter; the
// per-account cooldown in issuePasswordResetToken covers rotating IPs.
router.post('/forgot-password', passwordResetLimiter, validate(forgotPasswordSchema), forgotPassword);
// reset-password sends no mail but does run bcrypt, so it uses the auth limiter
// rather than being left open to token-guessing at full speed.
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), resetPassword);
router.post('/refresh', authLimiter, refresh);
router.post('/logout', requireAuth, logout);

export default router;
