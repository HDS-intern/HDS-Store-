import nodemailer from 'nodemailer'

type SendMailInput = {
  to: string
  subject: string
  text: string
  html?: string
}

function getTransporter() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    return null
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: { user, pass },
  })
}

export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

export async function sendMail(input: SendMailInput): Promise<void> {
  const transporter = getTransporter()
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || 'noreply@hawkingdefence.com'

  if (!transporter) {
    if (process.env.NODE_ENV === 'development') {
      console.info('[mail:dev] SMTP not configured. Email would be sent to:', input.to)
      console.info('[mail:dev] Subject:', input.subject)
      console.info('[mail:dev] Body:\n', input.text)
      return
    }
    throw new Error(
      'Email is not configured on the server. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in your environment.'
    )
  }

  await transporter.sendMail({
    from: `HDS Store <${from}>`,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  })
}
