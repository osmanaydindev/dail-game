import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many attempts, please try again later.' },
  skipSuccessfulRequests: false,
});

// Tighter than authLimiter: every request here can send an email, so these are
// mail-bombing guards, not just brute-force guards.
const mailLimiter = () =>
  rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many attempts, please try again later.' },
  });

// Separate instances on purpose — each rateLimit() call owns its own counter.
// Sharing one would mean a burst of signup attempts also locks the user out of
// password recovery, which is exactly when they need it.
export const registerLimiter = mailLimiter();
export const passwordResetLimiter = mailLimiter();

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Rate limit exceeded.' },
});
