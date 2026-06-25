'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import styles from './TicketEmailSyncModal.module.css'

type TicketEmailSyncModalProps = {
  open: boolean
  initialEmail?: string | null
  onClose: () => void
  onSynced: (email: string) => void
}

export function TicketEmailSyncModal({
  open,
  initialEmail,
  onClose,
  onSynced,
}: TicketEmailSyncModalProps) {
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    if (!open) return
    setStep('email')
    setEmail(initialEmail || '')
    setOtp('')
    setError('')
    setInfo('')
  }, [open, initialEmail])

  if (!open) return null

  const handleSendOtp = async () => {
    setError('')
    setInfo('')
    setSending(true)
    try {
      const data = await apiFetch<{ message: string }>('/api/admin/ticket-email-sync', {
        method: 'POST',
        body: JSON.stringify({ action: 'send_otp', email }),
      })
      setStep('otp')
      setOtp('')
      setInfo(data.message || 'Verification code sent.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification code')
    } finally {
      setSending(false)
    }
  }

  const handleVerifyOtp = async () => {
    setError('')
    setInfo('')
    setVerifying(true)
    try {
      const data = await apiFetch<{ syncedEmail: string; message: string }>(
        '/api/admin/ticket-email-sync',
        {
          method: 'POST',
          body: JSON.stringify({ action: 'verify_otp', email, otp }),
        }
      )
      const synced = data.syncedEmail || email.trim()
      onSynced(synced)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.closeIcon} onClick={onClose} aria-label="Close">
          <X className="w-5 h-5" />
        </button>

        <h2 className={styles.title}>Sync Mail ID</h2>
        <p className={styles.subtitle}>
          Verify an email address to receive full ticket details whenever a new support ticket is
          submitted.
        </p>

        {error && <p className={styles.error}>{error}</p>}
        {info && <p className={styles.info}>{info}</p>}

        {step === 'email' ? (
          <>
            <label htmlFor="sync-email" className={styles.label}>
              Email address
            </label>
            <input
              id="sync-email"
              type="email"
              className={styles.input}
              placeholder="admin@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => void handleSendOtp()}
              disabled={sending || !email.trim()}
            >
              {sending ? 'Sending…' : 'Send verification code'}
            </button>
          </>
        ) : (
          <>
            <p className={styles.otpHint}>
              Enter the 6-digit code sent to <strong>{email}</strong>
            </p>
            <label htmlFor="sync-otp" className={styles.label}>
              Verification code
            </label>
            <input
              id="sync-otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              className={styles.otpInput}
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoFocus
            />
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => void handleVerifyOtp()}
              disabled={verifying || otp.length !== 6}
            >
              {verifying ? 'Verifying…' : 'Verify & sync'}
            </button>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => {
                setStep('email')
                setOtp('')
                setError('')
                setInfo('')
              }}
            >
              Change email
            </button>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => void handleSendOtp()}
              disabled={sending}
            >
              {sending ? 'Resending…' : 'Resend code'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
