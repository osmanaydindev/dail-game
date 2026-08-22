import { Router } from 'express';
import { login, register, verifyEmail, resendVerification, refresh, logout } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { authLimiter, registerLimiter } from '../middleware/rateLimiter';
import {
  loginSchema,
  registerSchema,
  verifyEmailSchema,
  resendVerificationSchema,
} from '../validation/auth.schemas';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/register', registerLimiter, validate(registerSchema), register);
router.post('/verify-email', authLimiter, validate(verifyEmailSchema), verifyEmail);
router.post('/resend-verification', registerLimiter, validate(resendVerificationSchema), resendVerification);
router.post('/refresh', authLimiter, refresh);
router.post('/logout', requireAuth, logout);

export default router;
