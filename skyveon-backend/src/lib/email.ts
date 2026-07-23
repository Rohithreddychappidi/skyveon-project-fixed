import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env";

let transporter: Transporter | null = null;
let usingConsoleFallback = false;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  if (env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  } else {
    // Local dev fallback: no SMTP configured, so just log the email instead
    // of sending it. Set SMTP_HOST/SMTP_USER/SMTP_PASS to SES or SendGrid's
    // SMTP credentials in .env to send for real — no code changes needed.
    usingConsoleFallback = true;
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }
  return transporter;
}

export async function sendEmail(opts: { to: string; subject: string; html: string; text?: string }) {
  const t = getTransporter();
  const info = await t.sendMail({
    from: env.EMAIL_FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });

  if (usingConsoleFallback) {
    // eslint-disable-next-line no-console
    console.log(`\n📧 [dev email — not sent, SMTP_HOST not set] to=${opts.to} subject="${opts.subject}"`);
    // eslint-disable-next-line no-console
    console.log(opts.text || opts.html);
  }

  return info;
}

export function setupPasswordEmail(params: { name: string; link: string }) {
  return {
    subject: "Set up your Skyveon Learning Hub account",
    html: `<p>Hi ${params.name},</p><p>An account has been created for you on Skyveon Learning Hub. Click below to set your password and get started:</p><p><a href="${params.link}">${params.link}</a></p><p>This link expires in 48 hours.</p>`,
    text: `Hi ${params.name}, set up your Skyveon Learning Hub account: ${params.link} (expires in 48 hours)`,
  };
}

export function resetPasswordEmail(params: { name: string; link: string }) {
  return {
    subject: "Reset your Skyveon Learning Hub password",
    html: `<p>Hi ${params.name},</p><p>We received a request to reset your password. Click below to choose a new one:</p><p><a href="${params.link}">${params.link}</a></p><p>If you didn't request this, you can safely ignore this email. This link expires in 1 hour.</p>`,
    text: `Reset your Skyveon Learning Hub password: ${params.link} (expires in 1 hour)`,
  };
}
