import type { Request, Response } from 'express';
import { User } from '../models/User';
import {
  validatePassword,
  hashPassword,
  issueTokens,
  rotateRefreshToken,
  revokeRefreshToken,
  issueVerificationToken,
  consumeVerificationToken,
} from '../services/auth.service';
import { sendVerificationEmail, type MailLocale } from '../services/mail.service';
import { ok, created, badRequest, unauthorized, forbidden, conflict, serverError } from '../utils/response';
import { env } from '../config/env';
import type { IUser } from '../models/User';
import type { RegisterInput, VerifyEmailInput, ResendVerificationInput } from '../validation/auth.schemas';

const COOKIE_NAME = '__refresh';

/** Marker the frontend keys off to offer a "resend verification mail" action. */
export const EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED';

function publicUser(user: IUser) {
  return {
    _id: user.id as string,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
  };
}

/** Sends the verification mail without ever failing the caller's request. */
async function deliverVerificationMail(user: IUser, locale: MailLocale): Promise<void> {
  try {
    const token = await issueVerificationToken(user._id as never);
    await sendVerificationEmail(user.email, user.displayName, token, locale);
  } catch (err) {
    // A dead SMTP relay must not turn a successful signup into a 500 — the user
    // can retry from the "resend" action once mail is working again.
    console.error('[auth.verificationMail]', err);
  }
}

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: env.REFRESH_TOKEN_TTL_MS,
  path: '/api/auth',
};

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body as { email: string; password: string };

    const user = await User.findOne({ email: email.toLowerCase(), isActive: true }).select('+passwordHash');
    if (!user) {
      unauthorized(res, 'Invalid credentials');
      return;
    }

    const valid = await validatePassword(password, user.passwordHash);
    if (!valid) {
      unauthorized(res, 'Invalid credentials');
      return;
    }

    // Checked only after the password is verified — otherwise this response
    // would confirm that an email address is registered.
    if (!user.emailVerified) {
      forbidden(res, EMAIL_NOT_VERIFIED);
      return;
    }

    const { accessToken, refreshToken } = await issueTokens(
      user,
      req.headers['user-agent'],
      req.ip,
    );

    res.cookie(COOKIE_NAME, refreshToken, cookieOptions);
    ok(res, { user: publicUser(user), accessToken });
  } catch (err) {
    console.error('[auth.login]', err);
    serverError(res);
  }
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, username, displayName, locale } = req.body as RegisterInput;
    const normalizedEmail = email.toLowerCase();

    const existing = await User.findOne({ $or: [{ email: normalizedEmail }, { username }] });
    if (existing) {
      // Username collisions are safe to report (usernames are public); email
      // collisions are not, so those get the neutral "check your inbox" path.
      if (existing.username === username) {
        conflict(res, 'Username already taken');
        return;
      }
      if (!existing.emailVerified) await deliverVerificationMail(existing, locale);
      created(res, { email: normalizedEmail });
      return;
    }

    const user = await User.create({
      email: normalizedEmail,
      username,
      displayName,
      passwordHash: await hashPassword(password),
      role: 'user',
      emailVerified: false,
    });

    await deliverVerificationMail(user, locale);
    created(res, { email: normalizedEmail });
  } catch (err) {
    console.error('[auth.register]', err);
    serverError(res);
  }
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  try {
    const { token } = req.body as VerifyEmailInput;

    const user = await consumeVerificationToken(token);
    if (!user) {
      badRequest(res, 'Invalid or expired verification link');
      return;
    }

    // Clicking the link logs the user straight in — no second password prompt.
    const { accessToken, refreshToken } = await issueTokens(
      user,
      req.headers['user-agent'],
      req.ip,
    );

    res.cookie(COOKIE_NAME, refreshToken, cookieOptions);
    ok(res, { user: publicUser(user), accessToken });
  } catch (err) {
    console.error('[auth.verifyEmail]', err);
    serverError(res);
  }
}

export async function resendVerification(req: Request, res: Response): Promise<void> {
  try {
    const { email, locale } = req.body as ResendVerificationInput;

    const user = await User.findOne({ email: email.toLowerCase(), isActive: true });
    if (user && !user.emailVerified) await deliverVerificationMail(user, locale);

    // Always the same response — no account enumeration.
    ok(res, null, 'Verification email sent if the account needs it');
  } catch (err) {
    console.error('[auth.resendVerification]', err);
    serverError(res);
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const rawToken = req.cookies?.[COOKIE_NAME] as string | undefined;
    if (!rawToken) {
      unauthorized(res, 'No refresh token');
      return;
    }

    const result = await rotateRefreshToken(rawToken, req.headers['user-agent'], req.ip);
    if (!result) {
      res.clearCookie(COOKIE_NAME, { path: '/api/auth' });
      unauthorized(res, 'Invalid or expired refresh token');
      return;
    }

    const { tokens, user } = result;
    res.cookie(COOKIE_NAME, tokens.refreshToken, cookieOptions);
    ok(res, { accessToken: tokens.accessToken });
  } catch (err) {
    console.error('[auth.refresh]', err);
    serverError(res);
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const rawToken = req.cookies?.[COOKIE_NAME] as string | undefined;
    if (rawToken) await revokeRefreshToken(rawToken);
    res.clearCookie(COOKIE_NAME, { path: '/api/auth' });
    ok(res, null, 'Logged out');
  } catch (err) {
    console.error('[auth.logout]', err);
    serverError(res);
  }
}
