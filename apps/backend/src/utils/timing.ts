/**
 * Holds a response back until at least `minMs` has passed since `startedAt`.
 *
 * Endpoints that must not reveal whether an account exists return an identical
 * body either way, but the work behind them differs — a database hit costs more
 * than a miss — and that difference is measurable. Padding every response to a
 * common floor hides it. This is a timer, not a busy wait: it does not block
 * the event loop.
 */
export function padResponseTime(startedAt: number, minMs = 150): Promise<void> {
  const remaining = minMs - (Date.now() - startedAt);
  if (remaining <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, remaining));
}
