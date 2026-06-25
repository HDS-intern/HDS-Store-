'use client'

import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import styles from './PasswordField.module.css'

type PasswordFieldProps = {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  minLength?: number
  autoComplete?: string
}

export function PasswordField({
  id,
  value,
  onChange,
  placeholder = 'Enter your password',
  required = false,
  minLength,
  autoComplete = 'current-password',
}: PasswordFieldProps) {
  const [focused, setFocused] = useState(false)
  const [visible, setVisible] = useState(false)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (blurTimer.current) clearTimeout(blurTimer.current)
    }
  }, [])

  const handleFocus = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current)
    setFocused(true)
  }

  const handleBlur = () => {
    blurTimer.current = setTimeout(() => {
      setFocused(false)
      setVisible(false)
    }, 150)
  }

  return (
    <div className={styles.passwordWrap}>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        className={`${styles.input} ${focused ? styles.inputFocused : ''}`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      {focused && (
        <button
          type="button"
          className={styles.passwordToggleBtn}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          title={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? (
            <EyeOff className={styles.passwordToggleIcon} />
          ) : (
            <Eye className={styles.passwordToggleIcon} />
          )}
        </button>
      )}
    </div>
  )
}
