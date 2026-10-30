import nodemailer, { type Transporter } from 'nodemailer';
import { Resend } from 'resend';
import { emailKeys, emailText } from '../content/email-text.js';
import { getText } from './content.js';

type Email = { to: string | string[]; subject: string; text: string };
type Provider = 'gmail' | 'resend' | 'console';

/**
 * Which service sends email. Set EMAIL_PROVIDER in .env to gmail, resend or console.
 * If it isn't set, it's picked from the keys that exist. Tests never send real email.
 */
function pickProvider(): Provider {
  if (process.env.NODE_ENV === 'test') return 'console';
  const chosen = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (chosen === 'gmail' || chosen === 'resend' || chosen === 'console') return chosen;
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) return 'gmail';
  if (process.env.RESEND_API_KEY) return 'resend';
  return 'console';
}

const senderName = () => process.env.EMAIL_NAME ?? 'AvianDev';

/* ---------- Gmail (free, no domain needed) ---------- */

let gmail: Transporter | null = null;

async function sendWithGmail(email: Email) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD must be set to send with Gmail');

  gmail ??= nodemailer.createTransport({
    service: 'gmail',
    // Google shows app passwords with spaces; they aren't part of the password.
    auth: { user, pass: pass.replace(/\s/g, '') },
    pool: true,
    maxConnections: 2,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  // Gmail only sends from your own address, so the sender is always GMAIL_USER.
  await gmail.sendMail({ from: { name: senderName(), address: user }, ...email });
}

/* ---------- Resend (needs a verified domain to email readers) ---------- */

let resend: Resend | null = null;

async function sendWithResend(email: Email) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY must be set to send with Resend');

  resend ??= new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? `${senderName()} <onboarding@resend.dev>`,
    ...email,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}

/* ---------- Sending ---------- */

/** Returns true if the email was sent. Never throws, so a mail problem can't break a request. */
export async function sendEmail(email: Email) {
  const provider = pickProvider();

  if (provider === 'console') {
    console.log(`[email not sent] To: ${email.to}\nSubject: ${email.subject}\n${email.text}\n`);
    return false;
  }

  try {
    if (provider === 'gmail') await sendWithGmail(email);
    else await sendWithResend(email);
    return true;
  } catch (err) {
    console.error(`[email failed via ${provider}] "${email.subject}":`, err instanceof Error ? err.message : err);
    return false;
  }
}

/* ---------- Email content (from the CMS) ---------- */

const adminUrl = () => process.env.ADMIN_URL ?? 'http://localhost:3001';
const blogUrl = () => process.env.BLOG_URL ?? 'http://localhost:3002';

function fill(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (Object.hasOwn(values, key) ? values[key] : match));
}

export const emails = {
  async newSignup(name: string, email: string) {
    const t = await getText(emailKeys.newSignup, emailText.newSignup);
    return { subject: fill(t.subject, { name }), text: fill(t.body, { name, email, url: `${adminUrl()}/team` }) };
  },

  async approved(name: string) {
    const t = await getText(emailKeys.approved, emailText.approved);
    return { subject: fill(t.subject, { name }), text: fill(t.body, { name, url: `${adminUrl()}/login` }) };
  },

  async rejected(name: string) {
    const t = await getText(emailKeys.rejected, emailText.rejected);
    return { subject: fill(t.subject, { name }), text: fill(t.body, { name }) };
  },

  async invite(inviteUrl: string, role: 'admin' | 'super_admin') {
    const t = await getText(emailKeys.invite, emailText.invite);
    const roleText = role === 'super_admin' ? t.roleSuperAdmin : t.roleAdmin;
    return { subject: t.subject, text: fill(t.body, { role: roleText, url: inviteUrl }) };
  },

  async verifyEmail(name: string, token: string) {
    const t = await getText(emailKeys.verifyEmail, emailText.verifyEmail);
    return { subject: t.subject, text: fill(t.body, { name, url: `${blogUrl()}/verify-email?token=${token}` }) };
  },

  async resetPassword(name: string, token: string) {
    const t = await getText(emailKeys.resetPassword, emailText.resetPassword);
    return { subject: t.subject, text: fill(t.body, { name, url: `${blogUrl()}/reset-password?token=${token}` }) };
  },

  async accountExists(name: string) {
    const t = await getText(emailKeys.accountExists, emailText.accountExists);
    return {
      subject: t.subject,
      text: fill(t.body, { name, loginUrl: `${blogUrl()}/login`, resetUrl: `${blogUrl()}/forgot-password` }),
    };
  },

  async commentWaiting(postTitle: string, comment: string) {
    const t = await getText(emailKeys.commentWaiting, emailText.commentWaiting);
    const preview = comment.length > 500 ? `${comment.slice(0, 500)}…` : comment;
    return {
      subject: fill(t.subject, { postTitle }),
      text: fill(t.body, { postTitle, comment: preview, url: `${adminUrl()}/comments` }),
    };
  },
};