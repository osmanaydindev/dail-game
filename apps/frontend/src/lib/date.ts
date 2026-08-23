const TZ = 'Europe/Istanbul';

export function todayLocal(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

export function currentMonthLocal(): string {
  return todayLocal().slice(0, 7);
}

/**
 * Seconds until the game day rolls over — midnight in Istanbul, the timezone
 * every date in this app is keyed to.
 */
export function secondsUntilNextGameDay(): number {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0);
  // `24` is what en-GB reports for midnight itself; normalise it to 0.
  const elapsed = (get('hour') % 24) * 3600 + get('minute') * 60 + get('second');
  return 86_400 - elapsed;
}

/** Long-form date for display, e.g. "23 Ağustos 2026 · Cumartesi". */
export function formatGameDay(date: string, locale: string): string {
  // Parsed as UTC noon so the calendar day can't shift under any timezone.
  const d = new Date(`${date}T12:00:00Z`);
  const day = new Intl.DateTimeFormat(locale, {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ,
  }).format(d);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: TZ }).format(d);
  return `${day} · ${weekday}`;
}
