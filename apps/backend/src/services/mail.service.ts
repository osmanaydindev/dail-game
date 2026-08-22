import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env';

export type MailLocale = 'tr' | 'en';

let transporter: Transporter | null = null;

/**
 * Lazily built so the app boots (and tests run) without SMTP credentials.
 * When SMTP_HOST is unset we fall back to logging the mail — useful in local
 * development, never in production where the env is expected to be complete.
 */
function getTransporter(): Transporter | null {
  if (!env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465, // 587 uses STARTTLS, which nodemailer negotiates
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

interface Copy {
  subject: string;
  heading: string;
  intro: (name: string) => string;
  cta: string;
  fallback: string;
  expiry: string;
  ignore: string;
}

const COPY: Record<MailLocale, Copy> = {
  tr: {
    subject: 'Aydınlar Oynuyor — e-posta adresini doğrula',
    heading: 'E-posta adresini doğrula',
    intro: (name) => `Merhaba ${name}, Aydınlar Oynuyor hesabın neredeyse hazır.`,
    cta: 'Hesabımı doğrula',
    fallback: 'Buton çalışmazsa bu adresi tarayıcına yapıştır:',
    expiry: 'Bu bağlantı 24 saat geçerlidir.',
    ignore: 'Bu hesabı sen açmadıysan bu e-postayı yok sayabilirsin.',
  },
  en: {
    subject: 'Aydınlar Oynuyor — verify your email',
    heading: 'Verify your email',
    intro: (name) => `Hi ${name}, your Aydınlar Oynuyor account is almost ready.`,
    cta: 'Verify my account',
    fallback: "If the button doesn't work, paste this address into your browser:",
    expiry: 'This link is valid for 24 hours.',
    ignore: "If you didn't create this account, you can ignore this email.",
  },
};

function renderHtml(c: Copy, name: string, url: string): string {
  // Inline CSS, one CTA, no images, no tracking pixel — keeps spam scores low.
  return `<!doctype html>
<html lang="tr">
  <body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e6e8eb;">
      <tr><td style="padding:32px;">
        <p style="margin:0 0 4px;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#6b7280;">Aydınlar Oynuyor</p>
        <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">${c.heading}</h1>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">${c.intro(name)}</p>
        <p style="margin:0 0 24px;">
          <a href="${url}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">${c.cta}</a>
        </p>
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">${c.fallback}</p>
        <p style="margin:0 0 24px;font-size:13px;word-break:break-all;"><a href="${url}" style="color:#2563eb;">${url}</a></p>
        <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">${c.expiry}</p>
        <p style="margin:0;font-size:13px;color:#6b7280;">${c.ignore}</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

function renderText(c: Copy, name: string, url: string): string {
  // A text/plain alternative is required — HTML-only mail scores as spam.
  return [
    'Aydınlar Oynuyor',
    '',
    c.heading,
    '',
    c.intro(name),
    '',
    `${c.cta}: ${url}`,
    '',
    c.expiry,
    c.ignore,
    '',
  ].join('\n');
}

export async function sendVerificationEmail(
  to: string,
  displayName: string,
  token: string,
  locale: MailLocale = 'tr',
): Promise<void> {
  const c = COPY[locale] ?? COPY.tr;
  const prefix = locale === 'en' ? '' : `/${locale}`;
  const url = `${env.FRONTEND_URL}${prefix}/verify-email?token=${encodeURIComponent(token)}`;

  const mail = {
    from: env.MAIL_FROM,
    replyTo: env.MAIL_REPLY_TO,
    to,
    subject: c.subject,
    text: renderText(c, displayName, url),
    html: renderHtml(c, displayName, url),
  };

  const tx = getTransporter();
  if (!tx) {
    console.warn('[mail] SMTP_HOST not configured — verification link:', url);
    return;
  }
  await tx.sendMail(mail);
}
