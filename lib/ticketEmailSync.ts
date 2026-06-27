import { randomInt } from 'crypto'
import bcrypt from 'bcryptjs'
import { query, queryOne, execute } from './db'
import { sendMail } from './mail'
import type { ContactMessage } from './contactMessages'

const SETTINGS_KEY = 'ticket_notification_email'
const OTP_MINUTES = 10

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function getSyncedTicketEmail(): Promise<string | null> {
  const row = await queryOne<{ data: string }>(
    'SELECT data FROM site_settings WHERE key = ?',
    [SETTINGS_KEY]
  )

  if (!row) return null

  try {
    const parsed = JSON.parse(row.data) as { email?: string }
    const email = parsed.email?.trim()
    return email || null
  } catch {
    return null
  }
}

export async function setSyncedTicketEmail(email: string): Promise<void> {
  const now = new Date().toISOString()
  const normalized = normalizeEmail(email)

  await execute(
    `INSERT INTO site_settings (key, data, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    [SETTINGS_KEY, JSON.stringify({ email: normalized }), now]
  )
}

export async function clearSyncedTicketEmail(): Promise<void> {
  await execute('DELETE FROM site_settings WHERE key = ?', [SETTINGS_KEY])
}

function generateOtp(): string {
  return String(randomInt(100000, 1000000))
}

export async function sendTicketEmailOtp(email: string): Promise<void> {
  const normalized = normalizeEmail(email)
  if (!isValidEmail(normalized)) {
    throw new Error('Please enter a valid email address')
  }

  const otp = generateOtp()
  const otpHash = bcrypt.hashSync(otp, 10)
  const expiresAt = new Date(Date.now() + OTP_MINUTES * 60 * 1000).toISOString()
  const now = new Date().toISOString()

  await execute('DELETE FROM ticket_email_verifications WHERE email = ?', [normalized])
  await execute(
    `INSERT INTO ticket_email_verifications (email, otp_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?)`,
    [normalized, otpHash, expiresAt, now]
  )

  await sendMail({
    to: normalized,
    subject: 'HDS Ticket Notifications — Verification Code',
    text: [
      'HDS Control Center',
      '',
      'Your verification code for ticket email sync is:',
      '',
      otp,
      '',
      `This code expires in ${OTP_MINUTES} minutes.`,
      'If you did not request this, you can ignore this email.',
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
        <h2 style="color:#356ab0;margin:0 0 12px">HDS Control Center</h2>
        <p>Your verification code for ticket email sync is:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px;color:#356ab0">${otp}</p>
        <p style="color:#64748b;font-size:14px">This code expires in ${OTP_MINUTES} minutes.</p>
      </div>
    `,
  })

  if (process.env.NODE_ENV === 'development') {
    console.info(`[ticket-email-sync] OTP for ${normalized}: ${otp}`)
  }
}

export async function verifyTicketEmailOtp(email: string, otp: string): Promise<boolean> {
  const normalized = normalizeEmail(email)
  const code = otp.trim()

  if (!/^\d{6}$/.test(code)) {
    throw new Error('Please enter the 6-digit verification code')
  }

  const row = await queryOne<{ otp_hash: string; expires_at: string }>(
    `SELECT otp_hash, expires_at FROM ticket_email_verifications
     WHERE email = ? ORDER BY created_at DESC LIMIT 1`,
    [normalized]
  )

  if (!row) {
    throw new Error('No verification code found. Please request a new code.')
  }

  if (new Date(row.expires_at) < new Date()) {
    await execute('DELETE FROM ticket_email_verifications WHERE email = ?', [normalized])
    throw new Error('Verification code expired. Please request a new code.')
  }

  if (!bcrypt.compareSync(code, row.otp_hash)) {
    throw new Error('Invalid verification code')
  }

  await execute('DELETE FROM ticket_email_verifications WHERE email = ?', [normalized])
  await setSyncedTicketEmail(normalized)
  return true
}

export async function notifySyncedEmailOfTicket(message: ContactMessage): Promise<void> {
  const syncedEmail = await getSyncedTicketEmail()
  if (!syncedEmail) return

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  const received = new Date(message.createdAt).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  await sendMail({
    to: syncedEmail,
    subject: `[HDS Ticket] ${message.subject}`,
    text: [
      'New support ticket received',
      '',
      `Ticket ID: ${message.id}`,
      `Status: New`,
      `Name: ${message.name}`,
      `Email: ${message.email}`,
      `Phone: ${message.phone || '—'}`,
      `Subject: ${message.subject}`,
      `Received: ${received}`,
      '',
      'Message:',
      message.message,
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#0f172a">
        <h2 style="color:#356ab0;margin:0 0 16px">New Support Ticket</h2>
        <table style="border-collapse:collapse;width:100%;max-width:560px">
          <tr><td style="padding:6px 0;color:#64748b;width:120px">Ticket ID</td><td style="padding:6px 0"><strong>${escapeHtml(message.id)}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Status</td><td style="padding:6px 0">New</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Name</td><td style="padding:6px 0">${escapeHtml(message.name)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Email</td><td style="padding:6px 0">${escapeHtml(message.email)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Phone</td><td style="padding:6px 0">${escapeHtml(message.phone || '—')}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Subject</td><td style="padding:6px 0">${escapeHtml(message.subject)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Received</td><td style="padding:6px 0">${escapeHtml(received)}</td></tr>
        </table>
        <h3 style="margin:20px 0 8px;color:#356ab0">Message</h3>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;white-space:pre-wrap">${escapeHtml(message.message)}</div>
      </div>
    `,
  })
}
