'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { apiFetch } from '@/lib/api'
import { KeyRound } from 'lucide-react'
import styles from '../login/page.module.css'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [login, setLogin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await apiFetch<{ token: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ login }),
      })

      router.push(`/reset-password?token=${encodeURIComponent(data.token)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.main}>
        <div className={styles.card}>
          <h1 className={styles.title}>Forgot Password</h1>
          <p className={styles.subtitle}>
            Enter your username or email. This works for customer, staff, and admin accounts.
          </p>

          {error && <p className={styles.error}>{error}</p>}

          <form onSubmit={handleSubmit}>
            <label htmlFor="login" className={styles.label}>
              Username or Email
            </label>
            <input
              id="login"
              type="text"
              required
              className={styles.input}
              placeholder="your username or email"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
            />

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              <KeyRound className="w-5 h-5 inline mr-2" />
              {loading ? 'Processing...' : 'Continue'}
            </button>
          </form>

          <p className={styles.footer}>
            Remember your password?{' '}
            <Link href="/login" className={styles.link}>
              Back to Log In
            </Link>
          </p>
        </div>
      </div>
      <Footer />
    </div>
  )
}
