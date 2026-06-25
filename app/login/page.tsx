'use client'

import { useState, FormEvent, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { PasswordField } from '@/components/PasswordField'
import { useApp } from '@/lib/context'
import { LogIn } from 'lucide-react'
import styles from './page.module.css'

export default function LoginPage() {
  const router = useRouter()
  const { login, user } = useApp()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      router.replace(user.role === 'admin' || user.role === 'staff' ? '/admin' : '/account')
    }
  }, [user, router])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const loggedInUser = await login(loginId, password)
      router.push(
        loggedInUser.role === 'admin' || loggedInUser.role === 'staff' ? '/admin' : '/account'
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.main}>
        <div className={styles.card}>
          <h1 className={styles.title}>Log In</h1>
          <p className={styles.subtitle}>Welcome back to HDS</p>

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
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              autoComplete="username"
            />

            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <PasswordField
              id="password"
              value={password}
              onChange={setPassword}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />

            <div className={styles.forgotRow}>
              <Link href="/forgot-password" className={styles.forgotLink}>
                Forgot password?
              </Link>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              <LogIn className="w-5 h-5 inline mr-2" />
              {loading ? 'Signing in...' : 'Log In'}
            </button>
          </form>

          <p className={styles.footer}>
            Don&apos;t have an account?{' '}
            <Link href="/register" className={styles.link}>
              Register
            </Link>
          </p>
        </div>
      </div>
      <Footer />
    </div>
  )
}
