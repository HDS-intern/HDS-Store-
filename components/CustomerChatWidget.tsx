'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { Bot, Check, ChevronDown, MessageCircle, Send, Ticket, X } from 'lucide-react'
import { useApp } from '@/lib/context'
import { apiFetch } from '@/lib/api'
import { TICKET_SUBJECT_OPTIONS } from '@/lib/ticketSubjects'
import type { ChatMessage } from '@/lib/chatTypes'
import styles from './CustomerChatWidget.module.css'

type WidgetTab = 'bot' | 'ticket'

function formatBody(text: string) {
  return text.replace(/\*\*(.*?)\*\*/g, '$1')
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const TICKET_HINT =
  'Need help from our team? Open Ticket Generation and submit your request — we will respond within one business day.'

const emptyTicketForm = (name = '', email = '') => ({
  name,
  email,
  phone: '',
  subject: TICKET_SUBJECT_OPTIONS[0],
  message: '',
})

const SUBJECT_MENU_CLOSE_MS = 240

function TicketSubjectDropdown({
  value,
  onChange,
}: {
  value: string
  onChange: (subject: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [menuPosition, setMenuPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 256,
    openUp: false,
    bottom: 0,
  })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const closeTimerRef = useRef<number | null>(null)

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const gap = 6
    const viewportPadding = 10
    const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPadding
    const spaceAbove = rect.top - gap - viewportPadding
    const openUp = spaceBelow < 148 && spaceAbove > spaceBelow
    const maxHeight = Math.max(104, Math.min(256, openUp ? spaceAbove : spaceBelow))

    setMenuPosition({
      left: rect.left,
      width: rect.width,
      maxHeight,
      openUp,
      top: openUp ? 0 : rect.bottom + gap,
      bottom: openUp ? window.innerHeight - rect.top + gap : 0,
    })
  }, [])

  const setMenuOpen = useCallback((next: boolean) => {
    setOpen(next)
  }, [])

  const closeMenu = useCallback(() => {
    if (!open || closing) return
    setClosing(true)
    closeTimerRef.current = window.setTimeout(() => {
      setMenuOpen(false)
      setClosing(false)
    }, SUBJECT_MENU_CLOSE_MS)
  }, [open, closing, setMenuOpen])

  const openMenu = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setClosing(false)
    updateMenuPosition()
    setMenuOpen(true)
  }, [setMenuOpen, updateMenuPosition])

  useEffect(() => {
    setMounted(true)
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
    }
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updateMenuPosition()
  }, [open, updateMenuPosition])

  useEffect(() => {
    if (!open) return
    const onReposition = () => updateMenuPosition()
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      closeMenu()
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }

    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onEscape)

    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open, closeMenu, updateMenuPosition])

  const selectOption = (option: string) => {
    onChange(option)
    closeMenu()
  }

  const menuVisible = open || closing

  return (
    <div className={styles.subjectDropdown}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.subjectTrigger} ${open ? styles.subjectTriggerOpen : ''}`}
        onClick={() => (open ? closeMenu() : openMenu())}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="hds-ticket-subject-menu"
      >
        <span className={styles.subjectTriggerLabel}>{value}</span>
        <ChevronDown
          className={`${styles.subjectChevron} ${open ? styles.subjectChevronOpen : ''}`}
          aria-hidden="true"
        />
      </button>

      {mounted &&
        menuVisible &&
        createPortal(
          <ul
            ref={menuRef}
            id="hds-ticket-subject-menu"
            className={`${styles.subjectMenu} ${menuPosition.openUp ? styles.subjectMenuUp : ''} ${closing ? styles.subjectMenuOut : styles.subjectMenuIn}`}
            role="listbox"
            aria-label="Ticket subject"
            style={
              menuPosition.openUp
                ? {
                    left: menuPosition.left,
                    width: menuPosition.width,
                    maxHeight: menuPosition.maxHeight,
                    bottom: menuPosition.bottom,
                    top: 'auto',
                  }
                : {
                    top: menuPosition.top,
                    left: menuPosition.left,
                    width: menuPosition.width,
                    maxHeight: menuPosition.maxHeight,
                    bottom: 'auto',
                  }
            }
            onWheel={(event) => event.stopPropagation()}
          >
            {TICKET_SUBJECT_OPTIONS.map((option, index) => (
              <li key={option} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={value === option}
                  className={`${styles.subjectOption} ${value === option ? styles.subjectOptionActive : ''}`}
                  style={{ '--option-index': index } as React.CSSProperties}
                  onClick={() => selectOption(option)}
                >
                  <span>{option}</span>
                  {value === option && <Check className={styles.subjectCheck} aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  )
}

export function CustomerChatWidget() {
  const pathname = usePathname()
  const { user, authLoading } = useApp()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<WidgetTab>('bot')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [ticketForm, setTicketForm] = useState(emptyTicketForm())
  const [ticketSubmitting, setTicketSubmitting] = useState(false)
  const [ticketSuccess, setTicketSuccess] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const isStaffOrAdmin = user?.role === 'admin' || user?.role === 'staff'
  const isGuest = !user
  const hiddenRoute =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register')

  const canUseChat = !authLoading && !isStaffOrAdmin && !hiddenRoute

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const loadBotMessages = useCallback(async () => {
    if (!canUseChat) return
    setLoading(true)
    try {
      const data = await apiFetch<{ messages: ChatMessage[] }>('/api/chat?channel=bot')
      setMessages(data.messages)
    } catch {
      setMessages([])
    } finally {
      setLoading(false)
    }
  }, [canUseChat])

  const switchToTicketGeneration = useCallback(() => {
    setTab('ticket')
    setNotice(null)
    setTicketSuccess(false)
    setTicketForm((prev) => ({
      ...prev,
      name: user?.name?.replace(/\s+customer$/i, '').trim() || prev.name,
      email: user?.email || prev.email,
    }))
  }, [user?.email, user?.name])

  useEffect(() => {
    if (!open || !canUseChat || tab !== 'bot') return
    void loadBotMessages()
  }, [open, canUseChat, tab, loadBotMessages])

  useEffect(() => {
    if (!open) return
    if (tab === 'bot') scrollToBottom()
  }, [messages, open, tab, scrollToBottom])

  const sendBotMessage = async () => {
    const text = draft.trim()
    if (!text || sending || tab !== 'bot') return

    setSending(true)
    setNotice(null)
    try {
      const data = await apiFetch<{ messages: ChatMessage[] }>('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ channel: 'bot', message: text }),
      })
      setMessages((prev) => [...prev, ...data.messages])
      setDraft('')

      const wantsTicket = /ticket|support|human|agent|real person|contact team/i.test(text)
      if (wantsTicket) {
        setNotice('You can submit a support ticket using Ticket Generation above.')
      }
    } catch {
      setNotice('Unable to send message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const submitTicket = async () => {
    const name = ticketForm.name.trim()
    const email = ticketForm.email.trim()
    const message = ticketForm.message.trim()

    if (!name || !email || !message) {
      setNotice('Name, email, and message are required for ticket generation.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNotice('Please enter a valid email address.')
      return
    }

    if (message.length < 10) {
      setNotice('Message must be at least 10 characters.')
      return
    }

    setTicketSubmitting(true)
    setNotice(null)
    try {
      await apiFetch('/api/contact', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          phone: ticketForm.phone.trim() || undefined,
          subject: ticketForm.subject,
          message,
        }),
      })
      setTicketSuccess(true)
      setTicketForm(emptyTicketForm(user?.name?.replace(/\s+customer$/i, '').trim() || '', user?.email || ''))
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Failed to generate ticket. Please try again.')
    } finally {
      setTicketSubmitting(false)
    }
  }

  if (!canUseChat) return null

  return (
    <div className={styles.customerChatWrap} aria-live="polite">
      {open && (
        <div className={styles.panel} role="dialog" aria-label="HDS chat assistant">
          <div className={styles.header}>
            <div>
              <h2 className={styles.headerTitle}>HDS Assistant</h2>
              <p className={styles.headerSub}>
                {tab === 'bot'
                  ? isGuest
                    ? 'AI help + ticket generation — no login required'
                    : 'AI answers instantly, or generate a support ticket'
                  : 'Submit a ticket — our team will respond within one business day'}
              </p>
            </div>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className={styles.tabs}>
            <button
              type="button"
              className={tab === 'bot' ? styles.tabActive : styles.tab}
              onClick={() => {
                setTab('bot')
                setNotice(null)
              }}
            >
              <Bot className="w-4 h-4" />
              AI Assistant
            </button>
            <button
              type="button"
              className={tab === 'ticket' ? styles.tabActive : styles.tab}
              onClick={switchToTicketGeneration}
            >
              <Ticket className="w-4 h-4" />
              Ticket Generation
            </button>
          </div>

          {tab === 'bot' && (
            <div className={styles.ticketBanner}>
              <p className={styles.ticketBannerText}>{TICKET_HINT}</p>
              <button type="button" className={styles.ticketBannerBtn} onClick={switchToTicketGeneration}>
                <Ticket className="w-4 h-4" />
                Open Ticket Generation
              </button>
            </div>
          )}

          {tab === 'bot' ? (
            <>
              <div className={styles.messages}>
                {loading && <p className={styles.notice}>Loading conversation...</p>}
                {!loading &&
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`${styles.messageRow} ${
                        message.sender === 'customer'
                          ? styles.messageRowCustomer
                          : styles.messageRowBot
                      }`}
                    >
                      <div
                        className={`${styles.bubble} ${
                          message.sender === 'customer' ? styles.bubbleCustomer : styles.bubbleBot
                        }`}
                      >
                        {formatBody(message.body)}
                        <span className={styles.meta}>
                          {message.sender === 'customer' ? 'You' : 'HDS AI Assistant'} ·{' '}
                          {formatTime(message.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                {notice && <p className={styles.notice}>{notice}</p>}
                <div ref={messagesEndRef} />
              </div>

              <div className={styles.composer}>
                <textarea
                  className={styles.input}
                  rows={1}
                  placeholder="Ask the AI about orders, shipping, warranty..."
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void sendBotMessage()
                    }
                  }}
                />
                <button
                  type="button"
                  className={styles.sendBtn}
                  onClick={() => void sendBotMessage()}
                  disabled={sending || !draft.trim()}
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className={styles.ticketPanel}>
              {ticketSuccess ? (
                <div className={styles.ticketSuccess}>
                  <p className={styles.ticketSuccessTitle}>Ticket generated successfully</p>
                  <p className={styles.ticketSuccessText}>
                    Thank you for reaching out. Our team will respond to your inquiry within one
                    business day.
                  </p>
                  <button
                    type="button"
                    className={styles.ticketBannerBtn}
                    onClick={() => {
                      setTicketSuccess(false)
                      switchToTicketGeneration()
                    }}
                  >
                    Generate another ticket
                  </button>
                </div>
              ) : (
                <form
                  className={styles.ticketForm}
                  onSubmit={(e) => {
                    e.preventDefault()
                    void submitTicket()
                  }}
                >
                  <label className={styles.ticketField}>
                    <span>Full Name *</span>
                    <input
                      type="text"
                      value={ticketForm.name}
                      onChange={(e) => setTicketForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Your name"
                      required
                    />
                  </label>
                  <label className={styles.ticketField}>
                    <span>Email *</span>
                    <input
                      type="email"
                      value={ticketForm.email}
                      onChange={(e) => setTicketForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="you@example.com"
                      required
                    />
                  </label>
                  <label className={styles.ticketField}>
                    <span>Phone</span>
                    <input
                      type="tel"
                      value={ticketForm.phone}
                      onChange={(e) => setTicketForm((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="+91 99401 99407"
                    />
                  </label>
                  <label className={styles.ticketField}>
                    <span>Subject *</span>
                    <TicketSubjectDropdown
                      value={ticketForm.subject}
                      onChange={(subject) => setTicketForm((prev) => ({ ...prev, subject }))}
                    />
                  </label>
                  <label className={styles.ticketField}>
                    <span>Message *</span>
                    <textarea
                      rows={4}
                      value={ticketForm.message}
                      onChange={(e) => setTicketForm((prev) => ({ ...prev, message: e.target.value }))}
                      placeholder="Describe your issue or request..."
                      required
                    />
                  </label>
                  {notice && <p className={styles.ticketError}>{notice}</p>}
                  <button type="submit" className={styles.ticketSubmitBtn} disabled={ticketSubmitting}>
                    <Send className="w-4 h-4" />
                    {ticketSubmitting ? 'Submitting...' : 'Generate Ticket'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        className={`${styles.launcher} ${open ? styles.launcherOpen : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? 'Close chat' : 'Open HDS assistant'}
        aria-expanded={open}
      >
        {!open && <span className={styles.launcherRing} aria-hidden="true" />}
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </div>
  )
}
