'use client'

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { AdminShell, type AdminTab } from '@/components/admin/AdminShell'
import { AdminDashboard } from '@/components/admin/AdminDashboard'
import { BulkOrderTemplatePanel } from '@/components/admin/BulkOrderTemplatePanel'
import { InvoiceTemplatePanel } from '@/components/admin/InvoiceTemplatePanel'
import { TermsAgreementTemplatePanel } from '@/components/admin/TermsAgreementTemplatePanel'
import { MainTemplatePanel } from '@/components/admin/MainTemplatePanel'
import { StaffRecordsPanel } from '@/components/admin/StaffRecordsPanel'
import { UserPermissionsForm } from '@/components/admin/UserPermissionsForm'
import { AdminInvoicesPanel } from '@/components/admin/AdminInvoicesPanel'
import { AdminContactMessagesPanel } from '@/components/admin/AdminContactMessagesPanel'
import { AdminCustomerChatPanel } from '@/components/admin/AdminCustomerChatPanel'
import {
  AdminContactMessageToast,
  type ContactMessageNotification,
} from '@/components/admin/AdminContactMessageToast'
import { AdminOrderNotificationPopup } from '@/components/admin/AdminOrderNotificationPopup'
import { AdminOrderNotificationToast } from '@/components/admin/AdminOrderNotificationToast'
import { AdminUpdateToast, type AdminUpdateToastItem } from '@/components/admin/AdminUpdateToast'
import { AdminTableColumnHeader } from '@/components/admin/AdminTableColumnHeader'
import { AdminPasswordCell } from '@/components/admin/AdminPasswordCell'
import { UserAccessToggle } from '@/components/admin/UserAccessToggle'
import { CustomerDetailsModal } from '@/components/admin/CustomerDetailsModal'
import { OrderDetailsModal } from '@/components/admin/OrderDetailsModal'
import { ProductImageModal } from '@/components/admin/ProductImageModal'
import { useApp } from '@/lib/context'
import { apiFetch } from '@/lib/api'
import { formatPrice } from '@/lib/formatPrice'
import {
  getDiscountPercent,
  getMaxPrice,
  syncPricingFields,
  type PricingField,
} from '@/lib/productPricing'
import {
  detectOrderNotifications,
  toOrderSnapshot,
  type AdminOrderNotification,
  type OrderSnapshot,
} from '@/lib/adminNotifications'
import {
  hasPermission,
  permissionsForRole,
  countEnabledPermissions,
  parsePermissions,
  type UserPermissions,
} from '@/lib/permissions'
import type { Product, Order, User, StaffRecord } from '@/lib/types'
import type { ContactMessage } from '@/lib/contactMessages'
import { usernameFromStaffName } from '@/lib/staffUser'
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  CreditCard,
  Users,
  Plus,
  ChevronDown,
  Check,
  Eye,
  EyeOff,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Ticket,
  MessageCircle,
  Hash,
  TrendingUp,
  Tag,
  Percent,
  Layers,
  CheckCircle2,
  Settings,
  User,
  UserCircle,
  Mail,
  Shield,
  Key,
  Lock,
  Calendar,
  Trash2,
  Activity,
  IndianRupee,
  RefreshCw,
} from 'lucide-react'
import styles from './page.module.css'

type DbOrder = Order & {
  createdAt: string | Date
  customerName?: string
  customerUsername?: string
}

const STAFF_ROLES = [
  { value: 'staff', label: 'Staff', description: 'Manage orders & inventory' },
  { value: 'admin', label: 'Admin', description: 'Full system access' },
] as const

const ORDER_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
] as const

const STATUS_BADGE: Record<string, string> = {
  pending: 'badgePending',
  confirmed: 'badgeConfirmed',
  shipped: 'badgeShipped',
  delivered: 'badgeDelivered',
  cancelled: 'badgeCancelled',
}

function customerColumnLabel(order: DbOrder) {
  const raw = order.customerName || order.customerUsername || order.userId
  return raw.replace(/\s+customer$/i, '').trim() || raw
}

function OrderStatusDropdown({
  value,
  disabled,
  onChange,
}: {
  value: string
  disabled?: boolean
  onChange: (status: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, minWidth: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const selected =
    ORDER_STATUSES.find((status) => status.value === value) ?? ORDER_STATUSES[0]
  const badgeClass = styles[STATUS_BADGE[value] as keyof typeof styles] ?? styles.badgePending

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    setMenuPosition({
      top: rect.bottom + 6,
      left: rect.left,
      minWidth: rect.width,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updateMenuPosition()
  }, [open, updateMenuPosition])

  useEffect(() => {
    if (!open) return
    const handleReposition = () => updateMenuPosition()
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)
    return () => {
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [open, updateMenuPosition])

  if (disabled) {
    return <span className={`${styles.badge} ${badgeClass}`}>{selected.label}</span>
  }

  const menu =
    open && typeof document !== 'undefined'
      ? createPortal(
          <>
            <button
              type="button"
              className={styles.statusBackdrop}
              onClick={() => setOpen(false)}
              aria-label="Close status menu"
            />
            <ul
              className={styles.statusMenuPortal}
              role="listbox"
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
                minWidth: menuPosition.minWidth,
              }}
            >
              {ORDER_STATUSES.map((status) => {
                const optionBadge =
                  styles[STATUS_BADGE[status.value] as keyof typeof styles] ?? styles.badgePending
                return (
                  <li key={status.value} role="option" aria-selected={value === status.value}>
                    <button
                      type="button"
                      className={`${styles.statusOption} ${value === status.value ? styles.statusOptionActive : ''}`}
                      onClick={() => {
                        onChange(status.value)
                        setOpen(false)
                      }}
                    >
                      <span className={`${styles.badge} ${optionBadge}`}>{status.label}</span>
                      {value === status.value && <Check className={styles.selectCheck} />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </>,
          document.body
        )
      : null

  return (
    <div className={styles.statusSelectWrap}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.statusTrigger} ${open ? styles.statusTriggerOpen : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`${styles.badge} ${badgeClass}`}>{selected.label}</span>
        <ChevronDown className={`${styles.selectChevron} ${open ? styles.selectChevronOpen : ''}`} />
      </button>
      {menu}
    </div>
  )
}

function RoleDropdown({
  value,
  onChange,
}: {
  value: string
  onChange: (role: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = STAFF_ROLES.find((r) => r.value === value) ?? STAFF_ROLES[0]

  return (
    <div className={styles.selectWrap}>
      <button
        type="button"
        className={`${styles.selectTrigger} ${open ? styles.selectTriggerOpen : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>
          <span className={styles.selectTriggerLabel}>{selected.label}</span>
          <span className={styles.selectTriggerHint}>{selected.description}</span>
        </span>
        <ChevronDown className={`${styles.selectChevron} ${open ? styles.selectChevronOpen : ''}`} />
      </button>

      {open && (
        <>
          <button
            type="button"
            className={styles.selectBackdrop}
            onClick={() => setOpen(false)}
            aria-label="Close role menu"
          />
          <ul className={styles.selectMenu} role="listbox">
            {STAFF_ROLES.map((role) => (
              <li key={role.value} role="option" aria-selected={value === role.value}>
                <button
                  type="button"
                  className={`${styles.selectOption} ${value === role.value ? styles.selectOptionActive : ''}`}
                  onClick={() => {
                    onChange(role.value)
                    setOpen(false)
                  }}
                >
                  <span>
                    <span className={styles.selectOptionLabel}>{role.label}</span>
                    <span className={styles.selectOptionHint}>{role.description}</span>
                  </span>
                  {value === role.value && <Check className={styles.selectCheck} />}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function StaffMemberDropdown({
  value,
  staff,
  onChange,
}: {
  value: string
  staff: StaffRecord[]
  onChange: (staffRecordId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = staff.find((member) => member.id === value)

  return (
    <div className={styles.selectWrap}>
      <button
        type="button"
        className={`${styles.selectTrigger} ${open ? styles.selectTriggerOpen : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>
          <span className={styles.selectTriggerLabel}>
            {selected ? selected.employeeName : 'Select staff without login'}
          </span>
          <span className={styles.selectTriggerHint}>
            {selected
              ? selected.contactNumber
                ? `Contact: ${selected.contactNumber}`
                : 'No contact number on file'
              : 'Choose an employee who needs a login account'}
          </span>
        </span>
        <ChevronDown className={`${styles.selectChevron} ${open ? styles.selectChevronOpen : ''}`} />
      </button>

      {open && (
        <>
          <button
            type="button"
            className={styles.selectBackdrop}
            onClick={() => setOpen(false)}
            aria-label="Close staff menu"
          />
          <ul className={`${styles.selectMenu} ${styles.selectMenuScroll}`} role="listbox">
            <li role="option" aria-selected={!value}>
              <button
                type="button"
                className={`${styles.selectOption} ${!value ? styles.selectOptionActive : ''}`}
                onClick={() => {
                  onChange('')
                  setOpen(false)
                }}
              >
                <span>
                  <span className={styles.selectOptionLabel}>Select staff without login</span>
                  <span className={styles.selectOptionHint}>Clear current selection</span>
                </span>
                {!value && <Check className={styles.selectCheck} />}
              </button>
            </li>
            {staff.map((member) => (
              <li key={member.id} role="option" aria-selected={value === member.id}>
                <button
                  type="button"
                  className={`${styles.selectOption} ${value === member.id ? styles.selectOptionActive : ''}`}
                  onClick={() => {
                    onChange(member.id)
                    setOpen(false)
                  }}
                >
                  <span>
                    <span className={styles.selectOptionLabel}>{member.employeeName}</span>
                    <span className={styles.selectOptionHint}>
                      {member.contactNumber || 'No contact'}
                      {member.joiningDate ? ` · Joined ${member.joiningDate}` : ''}
                    </span>
                  </span>
                  {value === member.id && <Check className={styles.selectCheck} />}
                </button>
              </li>
            ))}
            {staff.length === 0 && (
              <li className={styles.selectEmptyState}>No staff available without a login account</li>
            )}
          </ul>
        </>
      )}
    </div>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const { user, authLoading, logout, products, refreshProducts } = useApp()
  const [tab, setTab] = useState<AdminTab>('dashboard')
  const [orders, setOrders] = useState<DbOrder[]>([])
  const [staffUsers, setStaffUsers] = useState<Record<string, unknown>[]>([])
  const [dashboardRefresh, setDashboardRefresh] = useState(0)
  const [error, setError] = useState('')
  const [highlightedColumn, setHighlightedColumn] = useState<string | null>(null)
  const [updateToastQueue, setUpdateToastQueue] = useState<AdminUpdateToastItem[]>([])
  const [activeUpdateToast, setActiveUpdateToast] = useState<AdminUpdateToastItem | null>(null)
  const [customerDetails, setCustomerDetails] = useState<{
    userId: string
    displayName: string
  } | null>(null)
  const [viewPaymentOrder, setViewPaymentOrder] = useState<DbOrder | null>(null)
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null)

  const [editProduct, setEditProduct] = useState<Partial<Product> | null>(null)
  const [newProduct, setNewProduct] = useState(false)
  const [stockInput, setStockInput] = useState('')
  const [maxPriceInput, setMaxPriceInput] = useState('')
  const [discountedPriceInput, setDiscountedPriceInput] = useState('')
  const [discountInput, setDiscountInput] = useState('')

  const handlePricingChange = (source: PricingField, field: 'max' | 'discount' | 'sale', raw: string) => {
    if (raw !== '' && !/^\d+$/.test(raw)) return

    const next = syncPricingFields(
      source,
      field === 'max' ? raw : maxPriceInput,
      field === 'discount' ? raw : discountInput,
      field === 'sale' ? raw : discountedPriceInput
    )

    setMaxPriceInput(next.max)
    setDiscountInput(next.discount)
    setDiscountedPriceInput(next.sale)
  }

  const normalizePricingField = (field: 'max' | 'discount' | 'sale') => {
    const next = syncPricingFields(field, maxPriceInput, discountInput, discountedPriceInput)
    setMaxPriceInput(next.max === '' ? '0' : next.max)
    setDiscountInput(next.discount === '' ? '0' : next.discount)
    setDiscountedPriceInput(next.sale === '' ? '0' : next.sale)
  }
  const [newUserForm, setNewUserForm] = useState({
    staffRecordId: '',
    username: '',
    email: '',
    name: '',
    password: '',
    role: 'staff',
    phone: '',
    permissions: permissionsForRole('staff'),
  })
  const [availableStaff, setAvailableStaff] = useState<StaffRecord[]>([])
  const [showNewUserPassword, setShowNewUserPassword] = useState(false)
  const [accessUpdatingId, setAccessUpdatingId] = useState<string | null>(null)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const [editingAccess, setEditingAccess] = useState<{
    id: string
    name: string
    role: string
    permissions: UserPermissions
  } | null>(null)
  const [notificationQueue, setNotificationQueue] = useState<AdminOrderNotification[]>([])
  const [activeNotification, setActiveNotification] = useState<AdminOrderNotification | null>(null)
  const [toastNotificationQueue, setToastNotificationQueue] = useState<AdminOrderNotification[]>([])
  const [activeToastNotification, setActiveToastNotification] =
    useState<AdminOrderNotification | null>(null)
  const [unreadContactCount, setUnreadContactCount] = useState(0)
  const [unreadCustomerChatCount, setUnreadCustomerChatCount] = useState(0)
  const [contactToastQueue, setContactToastQueue] = useState<ContactMessageNotification[]>([])
  const [activeContactToast, setActiveContactToast] = useState<ContactMessageNotification | null>(
    null
  )

  const ordersSnapshotRef = useRef<Map<string, OrderSnapshot>>(new Map())
  const snapshotReadyRef = useRef(false)
  const bulkSnapshotRef = useRef<Set<string>>(new Set())
  const bulkSnapshotReadyRef = useRef(false)
  const contactSnapshotRef = useRef<Set<string>>(new Set())
  const contactSnapshotReadyRef = useRef(false)

  const enqueueNotifications = useCallback((items: AdminOrderNotification[]) => {
    if (items.length === 0) return
    setNotificationQueue((prev) => [...prev, ...items])
  }, [])

  const enqueueToastNotifications = useCallback((items: AdminOrderNotification[]) => {
    if (items.length === 0) return
    setToastNotificationQueue((prev) => [...prev, ...items])
  }, [])

  const enqueueContactToasts = useCallback((items: ContactMessageNotification[]) => {
    if (items.length === 0) return
    setContactToastQueue((prev) => [...prev, ...items])
  }, [])

  const syncOrderSnapshot = useCallback(
    (orderList: DbOrder[], emitNotifications: boolean) => {
      const previous = ordersSnapshotRef.current
      let notifications: AdminOrderNotification[] = []

      if (snapshotReadyRef.current && emitNotifications) {
        notifications = detectOrderNotifications(previous, orderList)
      }

      const next = new Map<string, OrderSnapshot>()
      for (const order of orderList) {
        next.set(order.id, toOrderSnapshot(order))
      }
      ordersSnapshotRef.current = next
      snapshotReadyRef.current = true

      return notifications
    },
    []
  )

  const loadOrders = useCallback(
    async (emitNotifications = false) => {
      try {
        const data = await apiFetch<{ orders: DbOrder[] }>('/api/admin/orders')
        const notifications = syncOrderSnapshot(data.orders, emitNotifications)
        setOrders(data.orders)
        if (emitNotifications) {
          if (user?.role === 'admin') {
            enqueueToastNotifications(notifications)
          } else {
            enqueueNotifications(notifications)
          }
          if (notifications.length > 0) {
            setDashboardRefresh((n) => n + 1)
          }
        }
      } catch {
        setError('Failed to load orders')
      }
    },
    [syncOrderSnapshot, enqueueNotifications, enqueueToastNotifications, user?.role]
  )

  const loadBulkConfirmations = useCallback(
    async (emitNotifications = false) => {
      try {
        const data = await apiFetch<{
          confirmations: {
            id: string
            userName: string
            items: unknown[]
            total: number
            orderId?: string
          }[]
        }>('/api/admin/bulk-confirmations')

        if (emitNotifications && bulkSnapshotReadyRef.current) {
          const notifications: AdminOrderNotification[] = []
          for (const item of data.confirmations) {
            if (!bulkSnapshotRef.current.has(item.id)) {
              notifications.push({
                id: `bulk-${item.id}-${Date.now()}`,
                type: 'bulk_order_confirmed',
                orderId: item.orderId || item.id,
                title: 'Bulk Order Confirmed',
                message: `${item.userName} completed payment for a bulk order (${item.items.length} item(s)).`,
                total: item.total,
              })
            }
          }

          if (user?.role === 'admin') {
            enqueueToastNotifications(notifications)
          } else {
            enqueueNotifications(notifications)
          }
        }

        bulkSnapshotRef.current = new Set(data.confirmations.map((c) => c.id))
        bulkSnapshotReadyRef.current = true
      } catch {
        // staff without access may not load bulk confirmations
      }
    },
    [enqueueNotifications, enqueueToastNotifications, user?.role]
  )

  const loadContactMessages = useCallback(
    async (emitNotifications = false) => {
      if (!user || user.role !== 'admin') return
      try {
        const data = await apiFetch<{ messages: ContactMessage[]; unreadCount: number }>(
          '/api/admin/contact-messages'
        )
        setUnreadContactCount(data.unreadCount ?? 0)

        if (emitNotifications && contactSnapshotReadyRef.current) {
          const notifications: ContactMessageNotification[] = []
          for (const message of data.messages) {
            if (!message.read && !contactSnapshotRef.current.has(message.id)) {
              notifications.push({
                id: `contact-${message.id}-${Date.now()}`,
                messageId: message.id,
                name: message.name,
                subject: message.subject,
              })
            }
          }
          enqueueContactToasts(notifications)
        }

        contactSnapshotRef.current = new Set(data.messages.map((message) => message.id))
        contactSnapshotReadyRef.current = true
      } catch {
        // admin-only endpoint
      }
    },
    [user, enqueueContactToasts]
  )

  const markContactMessagesRead = useCallback(async () => {
    try {
      const data = await apiFetch<{ unreadCount: number }>('/api/admin/contact-messages', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'mark_read' }),
      })
      setUnreadContactCount(data.unreadCount ?? 0)
    } catch {
      // ignore
    }
  }, [])

  const loadCustomerChatUnread = useCallback(async () => {
    if (!user || (user.role !== 'admin' && user.role !== 'staff')) return
    try {
      const data = await apiFetch<{ unreadCount: number }>('/api/admin/customer-chat')
      setUnreadCustomerChatCount(data.unreadCount ?? 0)
    } catch {
      // staff/admin endpoint
    }
  }, [user])

  const loadUsers = useCallback(async () => {
    if (!user || !hasPermission(user, 'users_manage')) return
    try {
      const data = await apiFetch<{ users: Record<string, unknown>[] }>('/api/admin/users')
      setStaffUsers(data.users)
    } catch {
      setError('Failed to load users')
    }
  }, [user])

  const loadAvailableStaff = useCallback(async () => {
    if (!user || !hasPermission(user, 'users_manage')) return
    try {
      const data = await apiFetch<{ staff: StaffRecord[] }>('/api/admin/staff-records')
      setAvailableStaff(data.staff.filter((record) => !record.userId))
    } catch {
      setAvailableStaff([])
    }
  }, [user])

  useEffect(() => {
    if (authLoading) return
    if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
      router.replace('/login')
      return
    }
    loadOrders()
    loadUsers()
    loadBulkConfirmations()
    loadContactMessages()
    loadCustomerChatUnread()
  }, [
    user,
    authLoading,
    router,
    loadOrders,
    loadUsers,
    loadBulkConfirmations,
    loadContactMessages,
    loadCustomerChatUnread,
  ])

  useEffect(() => {
    if (!activeNotification && notificationQueue.length > 0) {
      setActiveNotification(notificationQueue[0])
      setNotificationQueue((prev) => prev.slice(1))
    }
  }, [activeNotification, notificationQueue])

  useEffect(() => {
    if (!activeToastNotification && toastNotificationQueue.length > 0) {
      setActiveToastNotification(toastNotificationQueue[0])
      setToastNotificationQueue((prev) => prev.slice(1))
    }
  }, [activeToastNotification, toastNotificationQueue])

  useEffect(() => {
    if (!activeContactToast && contactToastQueue.length > 0) {
      setActiveContactToast(contactToastQueue[0])
      setContactToastQueue((prev) => prev.slice(1))
    }
  }, [activeContactToast, contactToastQueue])

  useEffect(() => {
    if (!activeUpdateToast && updateToastQueue.length > 0) {
      setActiveUpdateToast(updateToastQueue[0])
      setUpdateToastQueue((prev) => prev.slice(1))
    }
  }, [activeUpdateToast, updateToastQueue])

  const showMsg = useCallback((msg: string, columnKey?: string) => {
    setError('')
    setUpdateToastQueue((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, message: msg }])
    if (columnKey) {
      setHighlightedColumn(columnKey)
      window.setTimeout(() => setHighlightedColumn(null), 2400)
    }
  }, [])

  const canViewOrders = Boolean(
    user &&
      (hasPermission(user, 'orders_view') ||
        hasPermission(user, 'orders_manage') ||
        hasPermission(user, 'payments_view') ||
        hasPermission(user, 'payments_manage'))
  )

  useEffect(() => {
    if (authLoading || !user || !canViewOrders) return

    const interval = window.setInterval(() => {
      loadOrders(true)
      loadBulkConfirmations(true)
    }, 15000)

    return () => window.clearInterval(interval)
  }, [authLoading, user, canViewOrders, loadOrders, loadBulkConfirmations])

  useEffect(() => {
    if (authLoading || !user || user.role !== 'admin') return

    const interval = window.setInterval(() => {
      void loadContactMessages(true)
    }, 10000)

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadContactMessages(true)
      }
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [authLoading, user, loadContactMessages])

  useEffect(() => {
    if (authLoading || !user || (user.role !== 'admin' && user.role !== 'staff')) return

    const interval = window.setInterval(() => {
      void loadCustomerChatUnread()
    }, 10000)

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadCustomerChatUnread()
      }
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [authLoading, user, loadCustomerChatUnread])

  useEffect(() => {
    if (tab !== 'messages' || user?.role !== 'admin') return
    void markContactMessagesRead()
  }, [tab, user?.role, markContactMessagesRead])

  useEffect(() => {
    if (authLoading || !user) return
    if (tab !== 'users' || !hasPermission(user, 'users_manage')) return
    void loadAvailableStaff()
  }, [authLoading, user, tab, loadAvailableStaff])

  const updateOrder = async (
    id: string,
    updates: Partial<{ status: string; paymentStatus: string; authorized: boolean; trackingNumber: string }>
  ) => {
    try {
      await apiFetch('/api/admin/orders', {
        method: 'PATCH',
        body: JSON.stringify({ id, ...updates }),
      })
      await loadOrders()
      setDashboardRefresh((n) => n + 1)
      const columnKey =
        updates.status !== undefined
          ? 'status'
          : updates.paymentStatus !== undefined
            ? 'payment'
            : 'actions'
      const columnLabel =
        updates.status !== undefined
          ? 'Status'
          : updates.paymentStatus !== undefined
            ? 'Payment'
            : 'Tracking'
      showMsg(`${columnLabel} column updated successfully`, columnKey)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    }
  }

  const saveProduct = async () => {
    if (!editProduct) return
    if (!editProduct.modelId?.trim()) {
      setError('Model ID is required')
      return
    }
    if (!editProduct.manufacturingId?.trim()) {
      setError('Manufacturing ID is required')
      return
    }
    const stock = stockInput === '' ? 0 : Math.max(0, parseInt(stockInput, 10) || 0)
    const price = discountedPriceInput === '' ? 0 : Math.max(0, parseInt(discountedPriceInput, 10) || 0)
    const maxPrice = maxPriceInput === '' ? price : Math.max(0, parseInt(maxPriceInput, 10) || 0)
    const originalPrice = maxPrice > price ? maxPrice : undefined
    const payload = {
      ...editProduct,
      modelId: editProduct.modelId.trim(),
      manufacturingId: editProduct.manufacturingId.trim(),
      stock,
      price,
      originalPrice,
      inStock: stock > 0,
    }
    try {
      if (newProduct) {
        await apiFetch('/api/admin/products', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        showMsg('Product added successfully', 'product')
      } else {
        await apiFetch('/api/admin/products', {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        showMsg('Product updated successfully', 'product')
      }
      setEditProduct(null)
      setNewProduct(false)
      setStockInput('')
      setMaxPriceInput('')
      setDiscountedPriceInput('')
      setDiscountInput('')
      await refreshProducts()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  const openNewProduct = () => {
    setNewProduct(true)
    setStockInput('0')
    setMaxPriceInput('0')
    setDiscountedPriceInput('0')
    setDiscountInput('0')
    setEditProduct({
      name: '',
      modelId: '',
      manufacturingId: '',
      price: 0,
      stock: 0,
      image: '/images/drone-sentinel-pro.png',
      category: 'Professional Drones',
      subcategory: 'General',
      description: '',
      rating: 4.5,
      reviews: 0,
    })
  }

  const openEditProduct = (product: Product) => {
    setNewProduct(false)
    setStockInput(String(product.stock ?? 0))
    setMaxPriceInput(String(getMaxPrice(product)))
    setDiscountedPriceInput(String(product.price ?? 0))
    setDiscountInput(String(getDiscountPercent(product)))
    setEditProduct({ ...product })
  }

  const closeProductEditor = () => {
    setEditProduct(null)
    setNewProduct(false)
    setStockInput('')
    setMaxPriceInput('')
    setDiscountedPriceInput('')
    setDiscountInput('')
  }

  const deleteProduct = async (id: string) => {
    if (!confirm('Delete this product?')) return
    try {
      await apiFetch('/api/admin/products', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      })
      showMsg('Product deleted', 'actions')
      await refreshProducts()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  const handleStaffMemberChange = (staffRecordId: string) => {
    const staff = availableStaff.find((record) => record.id === staffRecordId)
    if (!staff) {
      setNewUserForm({
        ...newUserForm,
        staffRecordId: '',
        username: '',
        name: '',
        phone: '',
      })
      return
    }
    setNewUserForm({
      ...newUserForm,
      staffRecordId,
      username: usernameFromStaffName(staff.employeeName),
      name: staff.employeeName,
      phone: staff.contactNumber || '',
    })
  }

  const createStaffUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUserForm.staffRecordId) {
      setError('Select a staff member without a login account')
      return
    }
    try {
      await apiFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(newUserForm),
      })
      showMsg('User created successfully', 'username')
      setNewUserForm({
        staffRecordId: '',
        username: '',
        email: '',
        name: '',
        password: '',
        role: 'staff',
        phone: '',
        permissions: permissionsForRole('staff'),
      })
      setShowNewUserPassword(false)
      await loadUsers()
      await loadAvailableStaff()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    }
  }

  const saveUserAccess = async () => {
    if (!editingAccess) return
    try {
      await apiFetch('/api/admin/users', {
        method: 'PATCH',
        body: JSON.stringify({
          id: editingAccess.id,
          role: editingAccess.role,
          permissions: editingAccess.permissions,
        }),
      })
      showMsg('User access updated successfully', 'accessibility')
      setEditingAccess(null)
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update access')
    }
  }

  const toggleStaffAccess = async (userId: string, accessLocked: boolean) => {
    setAccessUpdatingId(userId)
    try {
      await apiFetch('/api/admin/users', {
        method: 'PATCH',
        body: JSON.stringify({ id: userId, accessLocked }),
      })
      showMsg(accessLocked ? 'Staff access locked' : 'Staff access granted', 'accountAccess')
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account access')
    } finally {
      setAccessUpdatingId(null)
    }
  }

  const deleteUserAccount = async (target: Record<string, unknown>) => {
    const username = String(target.username ?? '')
    if (!window.confirm(`Delete account "${username}" permanently?`)) return
    setDeletingUserId(String(target.id))
    try {
      await apiFetch('/api/admin/users', {
        method: 'DELETE',
        body: JSON.stringify({ id: target.id }),
      })
      showMsg('Account deleted successfully', 'delete')
      if (editingAccess?.id === target.id) setEditingAccess(null)
      await loadUsers()
      await loadAvailableStaff()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account')
    } finally {
      setDeletingUserId(null)
    }
  }

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  const canManageInventory = hasPermission(user, 'inventory_manage')
  const canManageOrders = hasPermission(user, 'orders_manage')
  const canManagePayments = hasPermission(user, 'payments_manage')
  const canManageUsers = hasPermission(user, 'users_manage')
  const isFullAdmin = user?.role === 'admin'
  const canViewStaffRecords = hasPermission(user, 'staff_records')

  const canViewInvoices = Boolean(
    user &&
      (hasPermission(user, 'orders_view') ||
        hasPermission(user, 'orders_manage') ||
        hasPermission(user, 'payments_view') ||
        hasPermission(user, 'payments_manage'))
  )

  const navItems: {
    id: AdminTab
    label: string
    icon: typeof Package
    badgeCount?: number
  }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'users', label: 'System Users', icon: Users },
    { id: 'staff-data', label: 'Staff Records', icon: ClipboardList },
    { id: 'messages', label: 'Ticket Generation', icon: Ticket },
    { id: 'customer-chat', label: 'Customer Chat', icon: MessageCircle },
    { id: 'template', label: 'Edit Template', icon: FileSpreadsheet },
  ].filter((item) => {
    if (item.id === 'dashboard') return hasPermission(user, 'dashboard')
    if (item.id === 'inventory')
      return hasPermission(user, 'inventory_view') || hasPermission(user, 'inventory_manage')
    if (item.id === 'orders')
      return hasPermission(user, 'orders_view') || hasPermission(user, 'orders_manage')
    if (item.id === 'invoices') return canViewInvoices
    if (item.id === 'payments')
      return hasPermission(user, 'payments_view') || hasPermission(user, 'payments_manage')
    if (item.id === 'users') return canManageUsers
    if (item.id === 'staff-data') return canViewStaffRecords
    if (item.id === 'messages') return isFullAdmin
    if (item.id === 'customer-chat') return user.role === 'admin' || user.role === 'staff'
    if (item.id === 'template') return isFullAdmin
    return true
  }).map((item) => {
    if (item.id === 'messages') return { ...item, badgeCount: unreadContactCount }
    if (item.id === 'customer-chat') return { ...item, badgeCount: unreadCustomerChatCount }
    return item
  })

  const dismissNotification = () => setActiveNotification(null)

  const dismissUpdateToast = () => setActiveUpdateToast(null)

  const dismissToastNotification = () => setActiveToastNotification(null)

  const dismissContactToast = () => setActiveContactToast(null)

  const viewOrderFromNotification = () => {
    setActiveNotification(null)
    setActiveToastNotification(null)
    setTab('orders')
  }

  const viewMessagesFromNotification = () => {
    setActiveContactToast(null)
    setTab('messages')
  }

  return (
    <AdminShell
      user={user}
      tab={tab}
      onTabChange={setTab}
      onLogout={handleLogout}
      navItems={navItems}
    >
      {error && <div className={styles.messageError}>{error}</div>}

      {tab === 'dashboard' && (
        <AdminDashboard refreshKey={dashboardRefresh} />
      )}

          {tab === 'inventory' && (
            <>
              <div className="flex justify-between items-center mb-4">
                <h1 className={styles.pageTitle} style={{ marginBottom: 0 }}>
                  Inventory Management
                </h1>
                {canManageInventory && (
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    onClick={openNewProduct}
                  >
                    <Plus className="w-4 h-4 inline mr-1" />
                    Add Product
                  </button>
                )}
              </div>

              {editProduct && (
                <div className={styles.editPanel}>
                  <h3 className="font-bold mb-3 text-slate-100">{newProduct ? 'New Product' : 'Edit Product'}</h3>
                  <div className={styles.formGrid}>
                    <div>
                      <label className={styles.formLabel}>Name</label>
                      <input
                        className={styles.formInput}
                        value={editProduct.name || ''}
                        onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={styles.formLabel}>Model ID *</label>
                      <input
                        required
                        className={styles.formInput}
                        value={editProduct.modelId || ''}
                        onChange={(e) => setEditProduct({ ...editProduct, modelId: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={styles.formLabel}>Manufacturing ID *</label>
                      <input
                        required
                        className={styles.formInput}
                        value={editProduct.manufacturingId || ''}
                        onChange={(e) =>
                          setEditProduct({ ...editProduct, manufacturingId: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className={styles.formLabel}>Max Price (₹)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        className={styles.formInput}
                        value={maxPriceInput}
                        onChange={(e) => handlePricingChange('max', 'max', e.target.value)}
                        onBlur={() => normalizePricingField('max')}
                      />
                    </div>
                    <div>
                      <label className={styles.formLabel}>Discount %</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        className={styles.formInput}
                        value={discountInput}
                        placeholder="0"
                        onChange={(e) => handlePricingChange('discount', 'discount', e.target.value)}
                        onBlur={() => normalizePricingField('discount')}
                      />
                    </div>
                    <div>
                      <label className={styles.formLabel}>Discounted Price (₹)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        className={styles.formInput}
                        value={discountedPriceInput}
                        onChange={(e) => handlePricingChange('sale', 'sale', e.target.value)}
                        onBlur={() => normalizePricingField('sale')}
                      />
                    </div>
                    <div>
                      <label className={styles.formLabel}>Stock Qty</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        className={styles.formInput}
                        value={stockInput}
                        onChange={(e) => {
                          const raw = e.target.value
                          if (raw === '' || /^\d+$/.test(raw)) {
                            setStockInput(raw)
                          }
                        }}
                        onBlur={() => {
                          const parsed = stockInput === '' ? 0 : Math.max(0, parseInt(stockInput, 10) || 0)
                          setStockInput(String(parsed))
                        }}
                      />
                    </div>
                    <div>
                      <label className={styles.formLabel}>Category</label>
                      <input
                        className={styles.formInput}
                        value={editProduct.category || ''}
                        onChange={(e) => setEditProduct({ ...editProduct, category: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={styles.formLabel}>Image URL</label>
                      <input
                        className={styles.formInput}
                        value={editProduct.image || ''}
                        onChange={(e) => setEditProduct({ ...editProduct, image: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className={styles.formLabel}>Description</label>
                    <input
                      className={styles.formInput}
                      value={editProduct.description || ''}
                      onChange={(e) =>
                        setEditProduct({ ...editProduct, description: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className={`${styles.btn} ${styles.btnSuccess}`} onClick={saveProduct}>
                      Save
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnDanger}`}
                      onClick={closeProductEditor}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <AdminTableColumnHeader icon={Package} label="Product" highlighted={highlightedColumn === 'product'} />
                      <AdminTableColumnHeader icon={Hash} label="Model ID / MFG ID" highlighted={highlightedColumn === 'modelId'} />
                      <AdminTableColumnHeader icon={TrendingUp} label="Max Price" highlighted={highlightedColumn === 'maxPrice'} />
                      <AdminTableColumnHeader icon={Tag} label="Discounted" highlighted={highlightedColumn === 'discounted'} />
                      <AdminTableColumnHeader icon={Percent} label="Discount" highlighted={highlightedColumn === 'discount'} />
                      <AdminTableColumnHeader icon={Layers} label="Stock" highlighted={highlightedColumn === 'stock'} />
                      <AdminTableColumnHeader icon={CheckCircle2} label="Status" highlighted={highlightedColumn === 'status'} />
                      <AdminTableColumnHeader icon={Settings} label="Actions" highlighted={highlightedColumn === 'actions'} />
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => {
                      const discount = getDiscountPercent(p)
                      return (
                      <tr key={p.id}>
                        <td>
                          <button
                            type="button"
                            className={styles.productNameBtn}
                            onClick={() => setPreviewProduct(p)}
                            title="View product image"
                          >
                            {p.name}
                          </button>
                        </td>
                        <td>
                          <div className={styles.modelIdCell}>
                            <span>{p.modelId}</span>
                            <span className={styles.modelIdSub}>MFG: {p.manufacturingId || '—'}</span>
                          </div>
                        </td>
                        <td>{formatPrice(getMaxPrice(p))}</td>
                        <td>{formatPrice(p.price)}</td>
                        <td>{discount > 0 ? `${discount}%` : '—'}</td>
                        <td>{p.stock}</td>
                        <td>{p.inStock ? `In Stock (${p.stock} qty)` : 'Out of Stock'}</td>
                        <td>
                          {canManageInventory ? (
                            <>
                              <button
                                type="button"
                                className={`${styles.btn} ${styles.btnPrimary} mr-2`}
                                onClick={() => openEditProduct(p)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className={`${styles.btn} ${styles.btnDanger}`}
                                onClick={() => deleteProduct(p.id)}
                              >
                                Delete
                              </button>
                            </>
                          ) : (
                            <span className="text-slate-500 text-xs">View only</span>
                          )}
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'orders' && (
            <>
              <h1 className={styles.pageTitle}>Order Management</h1>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <AdminTableColumnHeader icon={Hash} label="Order ID" highlighted={highlightedColumn === 'orderId'} />
                      <AdminTableColumnHeader icon={UserCircle} label="Customer" highlighted={highlightedColumn === 'customer'} />
                      <AdminTableColumnHeader icon={IndianRupee} label="Total" highlighted={highlightedColumn === 'total'} />
                      <AdminTableColumnHeader icon={Activity} label="Status" highlighted={highlightedColumn === 'status'} className={styles.tableStatusCol} />
                      <AdminTableColumnHeader icon={CreditCard} label="Payment" highlighted={highlightedColumn === 'payment'} />
                      <AdminTableColumnHeader icon={Settings} label="Actions" highlighted={highlightedColumn === 'actions'} />
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <button
                            type="button"
                            className={styles.orderIdBtn}
                            onClick={() => setViewPaymentOrder(order)}
                            title="View order details"
                          >
                            {order.id}
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={styles.customerBtn}
                            onClick={() =>
                              setCustomerDetails({
                                userId: order.userId,
                                displayName:
                                  order.customerName ||
                                  order.customerUsername ||
                                  order.userId,
                              })
                            }
                            title="View customer profile and order history"
                          >
                            {customerColumnLabel(order)}
                          </button>
                        </td>
                        <td>{formatPrice(order.total)}</td>
                        <td className={styles.tableStatusCol}>
                          <OrderStatusDropdown
                            value={order.status}
                            disabled={!canManageOrders}
                            onChange={(status) => updateOrder(order.id, { status })}
                          />
                        </td>
                        <td>
                          <span className={`${styles.badge} ${styles.badgePending}`}>
                            {order.paymentStatus}
                          </span>
                        </td>
                        <td>
                          <input
                            className={styles.input}
                            placeholder="Tracking #"
                            disabled={!canManageOrders}
                            defaultValue={order.trackingNumber || ''}
                            onBlur={(e) => {
                              if (e.target.value)
                                updateOrder(order.id, { trackingNumber: e.target.value })
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                    {orders.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center text-muted-foreground py-8">
                          No orders yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'invoices' && canViewInvoices && <AdminInvoicesPanel />}

          {tab === 'payments' && (
            <>
              <h1 className={styles.pageTitle}>Payment Management</h1>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <AdminTableColumnHeader icon={Hash} label="Order ID" highlighted={highlightedColumn === 'orderId'} />
                      <AdminTableColumnHeader icon={IndianRupee} label="Amount" highlighted={highlightedColumn === 'amount'} />
                      <AdminTableColumnHeader icon={CreditCard} label="Method" highlighted={highlightedColumn === 'method'} />
                      <AdminTableColumnHeader icon={Activity} label="Status" highlighted={highlightedColumn === 'payment'} />
                      <AdminTableColumnHeader icon={RefreshCw} label="Update" highlighted={highlightedColumn === 'update'} />
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <button
                            type="button"
                            className={styles.orderIdBtn}
                            onClick={() => setViewPaymentOrder(order)}
                            title="View order details"
                          >
                            {order.id}
                          </button>
                        </td>
                        <td>{formatPrice(order.total)}</td>
                        <td>{order.paymentMethod || 'Card'}</td>
                        <td>
                          <span
                            className={`${styles.badge} ${
                              order.paymentStatus === 'paid'
                                ? styles.badgePaid
                                : styles.badgePending
                            }`}
                          >
                            {order.paymentStatus}
                          </span>
                        </td>
                        <td>
                          <select
                            className="hds-select-dark hds-select-compact"
                            value={order.paymentStatus}
                            disabled={!canManagePayments}
                            onChange={(e) =>
                              updateOrder(order.id, { paymentStatus: e.target.value })
                            }
                          >
                            <option value="pending">Pending</option>
                            <option value="paid">Paid</option>
                            <option value="failed">Failed</option>
                            <option value="refunded">Refunded</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'users' && canManageUsers && (
            <>
              <h1 className={styles.pageTitle}>Staff & User Management</h1>

              <form onSubmit={createStaffUser} className={styles.editPanel}>
                <h3 className="font-bold mb-3 text-slate-100">Create New User</h3>
                <div className={styles.formGrid}>
                  <div>
                    <label className={styles.formLabel}>Staff Member *</label>
                    <StaffMemberDropdown
                      value={newUserForm.staffRecordId}
                      staff={availableStaff}
                      onChange={handleStaffMemberChange}
                    />
                    {availableStaff.length === 0 && (
                      <p className={styles.sectionHint}>
                        All staff records already have login accounts. Add a new staff record first.
                      </p>
                    )}
                    {newUserForm.username && (
                      <p className={styles.sectionHint}>Login username: {newUserForm.username}</p>
                    )}
                  </div>
                  <div>
                    <label className={styles.formLabel}>Full Name *</label>
                    <input
                      required
                      className={styles.formInput}
                      value={newUserForm.name}
                      onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={styles.formLabel}>Email *</label>
                    <input
                      required
                      type="email"
                      className={styles.formInput}
                      value={newUserForm.email}
                      onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className={styles.formLabel}>Password *</label>
                    <div className={styles.passwordInputWrap}>
                      <input
                        required
                        type={showNewUserPassword ? 'text' : 'password'}
                        className={styles.formInput}
                        value={newUserForm.password}
                        onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                      />
                      <button
                        type="button"
                        className={styles.passwordToggleBtn}
                        onClick={() => setShowNewUserPassword((prev) => !prev)}
                        aria-label={showNewUserPassword ? 'Hide password' : 'Show password'}
                        title={showNewUserPassword ? 'Hide password' : 'Show password'}
                      >
                        {showNewUserPassword ? (
                          <EyeOff className={styles.passwordToggleIcon} />
                        ) : (
                          <Eye className={styles.passwordToggleIcon} />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={styles.formLabel}>Role</label>
                    <RoleDropdown
                      value={newUserForm.role}
                      onChange={(role) =>
                        setNewUserForm({
                          ...newUserForm,
                          role,
                          permissions: permissionsForRole(role as 'staff' | 'admin'),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className={styles.formLabel}>Phone</label>
                    <input
                      className={styles.formInput}
                      value={newUserForm.phone}
                      onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                    />
                  </div>
                </div>

                <h4 className={styles.sectionTitle}>Accessibility</h4>
                <p className={styles.sectionHint}>
                  {newUserForm.role === 'admin'
                    ? 'Admin role has full system access.'
                    : 'Select what this staff member can access in the control center.'}
                </p>
                <UserPermissionsForm
                  value={newUserForm.permissions}
                  onChange={(permissions) => setNewUserForm({ ...newUserForm, permissions })}
                  disabled={newUserForm.role === 'admin'}
                />

                <div className="mt-4">
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                  Create User
                </button>
                </div>
              </form>

              {editingAccess && (
                <div className={styles.editAccessPanel}>
                  <h3 className="font-bold mb-1 text-slate-100">
                    Edit Accessibility — {editingAccess.name}
                  </h3>
                  {isFullAdmin && editingAccess.id !== user?.id && (
                    <div className={styles.editRoleField}>
                      <label className={styles.formLabel}>Role</label>
                      <RoleDropdown
                        value={editingAccess.role}
                        onChange={(role) =>
                          setEditingAccess({
                            ...editingAccess,
                            role,
                            permissions: permissionsForRole(role as 'staff' | 'admin'),
                          })
                        }
                      />
                    </div>
                  )}
                  <p className={styles.sectionHint}>
                    {editingAccess.role === 'admin'
                      ? 'Admin accounts have full access. Switch role to Staff to customize permissions.'
                      : 'Select what this user can access in the control center.'}
                  </p>
                  <UserPermissionsForm
                    value={editingAccess.permissions}
                    onChange={(permissions) =>
                      setEditingAccess({ ...editingAccess, permissions })
                    }
                    disabled={editingAccess.role === 'admin'}
                  />
                  <div className="flex gap-2 mt-4">
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      onClick={saveUserAccess}
                      disabled={editingAccess.id === user?.id && editingAccess.role === 'admin'}
                    >
                      Save Access
                    </button>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnDanger}`}
                      onClick={() => setEditingAccess(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <AdminTableColumnHeader icon={User} label="Username" highlighted={highlightedColumn === 'username'} />
                      <AdminTableColumnHeader icon={UserCircle} label="Name" highlighted={highlightedColumn === 'name'} />
                      <AdminTableColumnHeader icon={Mail} label="Email" highlighted={highlightedColumn === 'email'} />
                      <AdminTableColumnHeader icon={Shield} label="Role" highlighted={highlightedColumn === 'role'} />
                      <AdminTableColumnHeader icon={Key} label="Accessibility" highlighted={highlightedColumn === 'accessibility'} />
                      <AdminTableColumnHeader icon={Lock} label="Account Access" highlighted={highlightedColumn === 'accountAccess'} />
                      {isFullAdmin && (
                        <AdminTableColumnHeader icon={Eye} label="Password" highlighted={highlightedColumn === 'password'} />
                      )}
                      <AdminTableColumnHeader icon={Calendar} label="Created" highlighted={highlightedColumn === 'created'} />
                      {isFullAdmin && (
                        <AdminTableColumnHeader icon={Trash2} label="Delete" highlighted={highlightedColumn === 'delete'} />
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {staffUsers
                      .filter((u) => u.role === 'staff' || u.role === 'admin')
                      .map((u) => {
                      const role = u.role as string
                      const perms = (u.permissions as UserPermissions | null) ??
                        parsePermissions(null, role as User['role']) ??
                        permissionsForRole('staff')
                      const enabled = role === 'admin' ? 'Full' : `${countEnabledPermissions(perms)} areas`
                      const accessLocked = Boolean(u.access_locked)
                      const isSelf = user?.id === u.id
                      return (
                      <tr key={u.id as string}>
                        <td>{u.username as string}</td>
                        <td>{u.name as string}</td>
                        <td>{u.email as string}</td>
                        <td>
                          <span className={`${styles.badge} ${styles.badgeConfirmed}`}>
                            {role}
                          </span>
                        </td>
                        <td>
                          <span className={styles.accessBadge}>{enabled}</span>
                          {(role === 'staff' || role === 'admin') && (
                            <button
                              type="button"
                              className={`${styles.btn} ${styles.btnPrimary} ml-2`}
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.6875rem' }}
                              onClick={() =>
                                setEditingAccess({
                                  id: u.id as string,
                                  name: u.name as string,
                                  role,
                                  permissions:
                                    role === 'admin'
                                      ? permissionsForRole('admin')
                                      : perms,
                                })
                              }
                            >
                              Edit
                            </button>
                          )}
                        </td>
                        <td>
                          {role === 'staff' && isFullAdmin ? (
                            <UserAccessToggle
                              locked={accessLocked}
                              disabled={accessUpdatingId === u.id || isSelf}
                              onChange={(locked) => toggleStaffAccess(u.id as string, locked)}
                            />
                          ) : (
                            <span className={styles.adminAccessBadge}>Always Active</span>
                          )}
                        </td>
                        {isFullAdmin && (
                          <td>
                            <AdminPasswordCell
                              password={u.password_plain as string | null | undefined}
                            />
                          </td>
                        )}
                        <td>{new Date(u.created_at as string).toLocaleDateString()}</td>
                        {isFullAdmin && (
                          <td>
                            <button
                              type="button"
                              className={`${styles.btn} ${styles.btnDanger}`}
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
                              onClick={() => deleteUserAccount(u)}
                              disabled={deletingUserId === u.id || isSelf}
                              title={isSelf ? 'You cannot delete your own account' : 'Delete account'}
                            >
                              {deletingUserId === u.id ? 'Deleting…' : 'Delete'}
                            </button>
                          </td>
                        )}
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'staff-data' && canViewStaffRecords && (
            <StaffRecordsPanel
              onMessage={showMsg}
              onError={setError}
              onStaffCreated={() => {
                void loadUsers()
                void loadAvailableStaff()
                setTab('users')
              }}
            />
          )}

          {tab === 'messages' && isFullAdmin && (
            <AdminContactMessagesPanel
              onMessagesRead={() => setUnreadContactCount(0)}
              onUnreadCountChange={setUnreadContactCount}
            />
          )}

          {tab === 'customer-chat' && (
            <AdminCustomerChatPanel
              onError={setError}
              onUnreadCountChange={setUnreadCustomerChatCount}
            />
          )}

          {tab === 'template' && isFullAdmin && (
            <>
              <h1 className={styles.pageTitle}>Site Templates</h1>
              <BulkOrderTemplatePanel
                isAdmin
                onMessage={showMsg}
                onError={setError}
              />
              <InvoiceTemplatePanel
                isAdmin={isFullAdmin}
                onMessage={showMsg}
                onError={setError}
                onOpenInvoices={() => setTab('invoices')}
              />
              <TermsAgreementTemplatePanel
                isAdmin={isFullAdmin}
                onMessage={showMsg}
                onError={setError}
              />
              <MainTemplatePanel onMessage={showMsg} onError={setError} />
            </>
          )}

      {customerDetails && (
        <CustomerDetailsModal
          userId={customerDetails.userId}
          displayName={customerDetails.displayName}
          onClose={() => setCustomerDetails(null)}
        />
      )}

      {viewPaymentOrder && (
        <OrderDetailsModal
          order={viewPaymentOrder}
          onClose={() => setViewPaymentOrder(null)}
        />
      )}

      {previewProduct && (
        <ProductImageModal
          name={previewProduct.name}
          image={previewProduct.image}
          modelId={previewProduct.modelId}
          manufacturingId={previewProduct.manufacturingId}
          onClose={() => setPreviewProduct(null)}
        />
      )}

      {activeNotification && user?.role !== 'admin' && (
        <AdminOrderNotificationPopup
          notification={activeNotification}
          queueCount={notificationQueue.length}
          onDismiss={dismissNotification}
          onViewOrder={viewOrderFromNotification}
        />
      )}

      {activeToastNotification && user?.role === 'admin' && (
        <AdminOrderNotificationToast
          notification={activeToastNotification}
          queueCount={toastNotificationQueue.length}
          onDismiss={dismissToastNotification}
          onViewOrder={viewOrderFromNotification}
        />
      )}

      {activeContactToast && user?.role === 'admin' && (
        <AdminContactMessageToast
          notification={activeContactToast}
          queueCount={contactToastQueue.length}
          onDismiss={dismissContactToast}
          onViewMessages={viewMessagesFromNotification}
        />
      )}

      {activeUpdateToast && (
        <AdminUpdateToast
          toast={activeUpdateToast}
          queueCount={updateToastQueue.length}
          onDismiss={dismissUpdateToast}
        />
      )}
    </AdminShell>
  )
}
