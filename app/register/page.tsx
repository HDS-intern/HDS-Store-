'use client'

import { useState, FormEvent, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { useApp } from '@/lib/context'
import { PasswordField } from '@/components/PasswordField'
import { UserPlus } from 'lucide-react'
import styles from './page.module.css'

export default function RegisterPage() {
  const router = useRouter()
  const { register, user } = useApp()
  const [form, setForm] = useState({
    username: '',
    email: '',
    name: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) router.replace('/account')
  }, [user, router])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      await register({
        username: form.username,
        email: form.email,
        name: form.name,
        phone: form.phone || undefined,
        password: form.password,
      })
      router.push('/account')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.main}>
        <div className={styles.card}>
          <h1 className={styles.title}>Register</h1>
          <p className={styles.subtitle}>Create your HDS account</p>

          {error && <p className={styles.error}>{error}</p>}

          <form onSubmit={handleSubmit}>
            <label htmlFor="username" className={styles.label}>Username *</label>
            <input
              id="username"
              required
              className={styles.input}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />

            <label htmlFor="name" className={styles.label}>Full Name *</label>
            <input
              id="name"
              required
              className={styles.input}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />

            <label htmlFor="email" className={styles.label}>Email *</label>
            <input
              id="email"
              type="email"
              required
              className={styles.input}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />

            <label htmlFor="phone" className={styles.label}>Phone</label>
            <input
              id="phone"
              type="tel"
              className={styles.input}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />

            <label htmlFor="password" className={styles.label}>Password *</label>
            <PasswordField
              id="password"
              value={form.password}
              onChange={(password) => setForm({ ...form, password })}
              placeholder="Create a password"
              required
              minLength={4}
              autoComplete="new-password"
            />

            <label htmlFor="confirm" className={styles.label}>Confirm Password *</label>
            <PasswordField
              id="confirm"
              value={form.confirmPassword}
              onChange={(confirmPassword) => setForm({ ...form, confirmPassword })}
              placeholder="Confirm your password"
              required
              minLength={4}
              autoComplete="new-password"
            />

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              <UserPlus className="w-5 h-5 inline mr-2" />
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className={styles.footer}>
            Already have an account?{' '}
            <Link href="/login" className={styles.link}>
              Log In
            </Link>
          </p>
        </div>
      </div>
      <Footer />
    </div>
  )
}
