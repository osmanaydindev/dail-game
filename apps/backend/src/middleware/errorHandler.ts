import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { env } from '../config/env';

interface HttpError extends Error {
  status?: number;
  statusCode?: number;
}

export const errorHandler: ErrorRequestHandler = (
  err: HttpError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // body-parser tags its own failures — oversized bodies (413) and malformed
  // JSON (400) are client mistakes, not server faults.
  const status = err.status ?? err.statusCode ?? 500;
  const isClientError = status >= 400 && status < 500;

  if (isClientError) {
    // No stack trace: an attacker looping malformed requests would otherwise
    // fill the disk with stacks. One compact line is enough to spot a pattern.
    console.warn('[error]', status, err.message);
    res.status(status).json({ success: false, error: 'Bad request' });
    return;
  }

  console.error('[error]', err.message, err.stack);
  // Never leak internals to the client outside development.
  const message = env.NODE_ENV === 'development' ? err.message : 'Internal server error';
  res.status(500).json({ success: false, error: message });
};
