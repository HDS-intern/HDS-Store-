'use client'

import { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { AdminShell, type AdminTab } from '@/components/admin/AdminShell'
import { AdminSlideUp } from '@/components/admin/AdminSlideUp'
import { AdminDashboard } from '@/components/admin/AdminDashboard'
import { startAdminEntranceOnce, completeAdminEntrance } from '@/lib/adminEntrance'
import {
  CertificationAssetViewModal,
  type CertificationAssetPreview,
} from '@/components/admin/CertificationAssetViewModal'
import { BulkOrderTemplatePanel } from '@/components/admin/BulkOrderTemplatePanel'
import { TermsAgreementTemplatePanel } from '@/components/admin/TermsAgreementTemplatePanel'
import { InvoiceDcTemplatePanel } from '@/components/admin/InvoiceDcTemplatePanel'
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
import { AdminLowStockToast } from '@/components/admin/AdminLowStockToast'
import { AdminUpdateToast, type AdminUpdateToastItem } from '@/components/admin/AdminUpdateToast'
import { AdminErrorToast } from '@/components/admin/AdminErrorToast'
import { AdminTableColumnHeader } from '@/components/admin/AdminTableColumnHeader'
import { AdminBadgeDropdown } from '@/components/admin/AdminBadgeDropdown'
import { AdminPasswordCell } from '@/components/admin/AdminPasswordCell'
import { UserAccessToggle } from '@/components/admin/UserAccessToggle'
import { CustomerDetailsModal } from '@/components/admin/CustomerDetailsModal'
import { OrderDetailsModal } from '@/components/admin/OrderDetailsModal'
import { ProductImageModal } from '@/components/admin/ProductImageModal'
import { AnimatedFormSelect } from '@/components/admin/AnimatedFormSelect'
import { CertificationTypeManagerModal } from '@/components/admin/CertificationTypeManagerModal'
import {
  ProductBulkEntryModal,
  createEmptyProductDraftRow,
  type ProductDraftRow,
} from '@/components/admin/ProductBulkEntryModal'
import {
  ProductBulkImagesModal,
  type BulkProductImageDraft,
} from '@/components/admin/ProductBulkImagesModal'
import { validateProductGalleryFile } from '@/lib/productGalleryUpload'
import { useApp } from '@/lib/context'
import { apiFetch, getStoredToken } from '@/lib/api'
import { formatPrice } from '@/lib/formatPrice'
import {
  getDiscountPercent,
  getMaxPrice,
  getMinStockAlert,
  syncPricingFields,
  type PricingField,
} from '@/lib/productPricing'
import {
  detectLowStockNotifications,
  getLowStockProducts,
  isLowStockProduct,
  type AdminLowStockNotification,
} from '@/lib/lowStockAlerts'
import {
  certDraftEntriesToProductCertifications,
  certificationTypesLabel,
  getProductCertifications,
} from '@/lib/productCertifications'
import {
  detectOrderNotifications,
  toOrderSnapshot,
  type AdminOrderNotification,
  type OrderSnapshot,
} from '@/lib/adminNotifications'
import {
  buildCustomRoleValue,
  customRoleIdFromValue,
  isCustomRoleValue,
  loadCustomRoles,
  loadHiddenBuiltInRoles,
  newCustomRoleDraft,
  resolveApiRole,
  saveCustomRoles,
  saveHiddenBuiltInRoles,
  type CustomRole,
} from '@/lib/customRoles'
import {
  hasPermission,
  permissionsForRole,
  countEnabledPermissions,
  parsePermissions,
  type UserPermissions,
} from '@/lib/permissions'
import type { Product, Order, User, StaffRecord, WarrantyInfo } from '@/lib/types'
import type { CertificationTypeRecord } from '@/lib/certificationTypes'
import {
  buildCertificationTypeOptions,
  CREATE_CERT_VALUE,
} from '@/lib/certificationTypeOptions'

const WARRANTY_DURATION_OPTIONS = ['1 Year', '2 Years', '3 Years'] as const

function defaultProductWarranty(): WarrantyInfo {
  return {
    duration: '2 Years',
    type: 'Manufacturer Limited Warranty',
    coverage: ['Manufacturing defects in materials and workmanship'],
    exclusions: ['Physical damage', 'Unauthorized modifications'],
    extendedAvailable: false,
  }
}

function withWarrantyDuration(product: Partial<Product>, duration: string): Partial<Product> {
  return {
    ...product,
    warranty: {
      ...(product.warranty || defaultProductWarranty()),
      duration,
    },
  }
}

function getWarrantyDuration(product: Partial<Product>): string {
  const duration = product.warranty?.duration || '2 Years'
  if (WARRANTY_DURATION_OPTIONS.includes(duration as (typeof WARRANTY_DURATION_OPTIONS)[number])) {
    return duration
  }
  if (duration.includes('1')) return '1 Year'
  if (duration.includes('3')) return '3 Years'
  return '2 Years'
}
import type { ContactMessage } from '@/lib/contactMessages'
import { usernameFromStaffName } from '@/lib/staffUser'
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  CreditCard,
  Users,
  UserPlus,
  Plus,
  ChevronDown,
  Check,
  Eye,
  EyeOff,
  ClipboardList,
  FileSpreadsheet,
  Award,
  FileText,
  Ticket,
  MessageCircle,
  ImageIcon,
  X,
  Trash2,
  Pencil,
} from 'lucide-react'
import styles from './page.module.css'

type DbOrder = Order & {
  createdAt: string | Date
  customerName?: string
  customerUsername?: string
}

function getProductCertificationType(product: Product): string {
  const value = product.specs?.['Certification Type']?.trim()
  if (!value || value === '—') return ''
  return value
}

const STAFF_ROLES = [
  { value: 'staff', label: 'Staff', description: 'Manage orders & inventory' },
  { value: 'admin', label: 'Admin', description: 'Full system access' },
] as const

const PAYMENT_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
] as const

const PAYMENT_BADGE: Record<string, string> = {
  pending: 'badgePending',
  paid: 'badgePaid',
  failed: 'badgeFailed',
  refunded: 'badgeRefunded',
}

function paymentBadgeClass(status: string) {
  return PAYMENT_BADGE[status] ?? 'badgePending'
}

function customerColumnLabel(order: DbOrder) {
  const raw = order.customerName || order.customerUsername || order.userId
  return raw.replace(/\s+customer$/i, '').trim() || raw
}

function useSelectMenuPosition(open: boolean, triggerRef: RefObject<HTMLButtonElement | null>) {
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 })

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    setPosition({
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
    })
  }, [triggerRef])

  useLayoutEffect(() => {
    if (open) updatePosition()
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const handleReposition = () => updatePosition()
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)
    return () => {
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [open, updatePosition])

  return position
}

function SelectMenuPortal({
  open,
  onClose,
  position,
  children,
  scrollable = false,
}: {
  open: boolean
  onClose: () => void
  position: { top: number; left: number; width: number }
  children: ReactNode
  scrollable?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <>
      <button
        type="button"
        className={styles.selectBackdrop}
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        aria-label="Close menu"
      />
      <ul
        className={`${styles.selectMenu} ${styles.selectMenuFixed} ${scrollable ? styles.selectMenuScroll : ''}`}
        role="listbox"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          top: position.top,
          left: position.left,
          width: Math.max(position.width, 240),
        }}
      >
        {children}
      </ul>
    </>,
    document.body
  )
}

function RoleDropdown({
  value,
  onChange,
  customRoles,
  onCustomRolesChange,
  hiddenBuiltInRoles,
  onHiddenBuiltInRolesChange,
}: {
  value: string
  onChange: (role: string, permissions: UserPermissions) => void
  customRoles: CustomRole[]
  onCustomRolesChange: (roles: CustomRole[]) => void
  hiddenBuiltInRoles: string[]
  onHiddenBuiltInRolesChange: (roles: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [creatingRole, setCreatingRole] = useState(false)
  const [draftRoleName, setDraftRoleName] = useState('')
  const [draftRoleDesc, setDraftRoleDesc] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const position = useSelectMenuPosition(open, triggerRef)

  const visibleBuiltInRoles = STAFF_ROLES.filter(
    (role) => role.value === 'admin' || !hiddenBuiltInRoles.includes(role.value)
  )

  const builtIn = STAFF_ROLES.find((r) => r.value === value)
  const custom = isCustomRoleValue(value)
    ? customRoles.find((r) => r.id === customRoleIdFromValue(value))
    : undefined
  const selected = custom
    ? { label: custom.label, description: custom.description }
    : builtIn ?? visibleBuiltInRoles[0] ?? STAFF_ROLES[0]

  const closeMenu = () => {
    setOpen(false)
    setCreatingRole(false)
    setDraftRoleName('')
    setDraftRoleDesc('')
  }

  const pickFallbackRole = (
    nextHidden: string[],
    nextCustom: CustomRole[]
  ): { role: string; permissions: UserPermissions } => {
    const visible = STAFF_ROLES.filter(
      (role) => role.value === 'admin' || !nextHidden.includes(role.value)
    )
    if (visible.length > 0) {
      const first = visible[0]
      return { role: first.value, permissions: permissionsForRole(first.value) }
    }
    if (nextCustom.length > 0) {
      return {
        role: buildCustomRoleValue(nextCustom[0].id),
        permissions: nextCustom[0].permissions,
      }
    }
    return { role: 'admin', permissions: permissionsForRole('admin') }
  }

  const handleDeleteBuiltIn = (roleValue: string, label: string) => {
    if (roleValue === 'admin') return
    if (!window.confirm(`Remove "${label}" role from the list?`)) return
    const nextHidden = [...hiddenBuiltInRoles, roleValue]
    onHiddenBuiltInRolesChange(nextHidden)
    saveHiddenBuiltInRoles(nextHidden)
    if (value === roleValue) {
      const fallback = pickFallbackRole(nextHidden, customRoles)
      onChange(fallback.role, fallback.permissions)
    }
  }

  const handleDeleteCustom = (role: CustomRole) => {
    if (!window.confirm(`Delete "${role.label}" role?`)) return
    const nextCustom = customRoles.filter((r) => r.id !== role.id)
    onCustomRolesChange(nextCustom)
    saveCustomRoles(nextCustom)
    const roleValue = buildCustomRoleValue(role.id)
    if (value === roleValue) {
      const fallback = pickFallbackRole(hiddenBuiltInRoles, nextCustom)
      onChange(fallback.role, fallback.permissions)
    }
  }

  const handleCreateRole = () => {
    const label = draftRoleName.trim()
    if (!label) return
    const role = newCustomRoleDraft(label, draftRoleDesc)
    const next = [...customRoles, role]
    onCustomRolesChange(next)
    saveCustomRoles(next)
    onChange(buildCustomRoleValue(role.id), role.permissions)
    closeMenu()
  }

  return (
    <div className={styles.selectWrap}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.selectTrigger} ${open ? styles.selectTriggerOpen : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((prev) => !prev)
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>
          <span className={styles.selectTriggerLabel}>{selected.label}</span>
          <span className={styles.selectTriggerHint}>{selected.description}</span>
        </span>
        <ChevronDown className={`${styles.selectChevron} ${open ? styles.selectChevronOpen : ''}`} />
      </button>

      <SelectMenuPortal open={open} onClose={closeMenu} position={position}>
        {visibleBuiltInRoles.map((role) => (
          <li key={role.value} className={styles.selectOptionRow} role="option" aria-selected={value === role.value}>
            <button
              type="button"
              className={`${styles.selectOption} ${value === role.value ? styles.selectOptionActive : ''}`}
              onClick={() => {
                onChange(role.value, permissionsForRole(role.value))
                closeMenu()
              }}
            >
              <span>
                <span className={styles.selectOptionLabel}>{role.label}</span>
                <span className={styles.selectOptionHint}>{role.description}</span>
              </span>
              {value === role.value && <Check className={styles.selectCheck} />}
            </button>
            {role.value !== 'admin' && (
              <button
                type="button"
                className={styles.selectRoleDeleteBtn}
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteBuiltIn(role.value, role.label)
                }}
                aria-label={`Delete ${role.label} role`}
                title={`Delete ${role.label} role`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </li>
        ))}

        {customRoles.map((role) => {
          const roleValue = buildCustomRoleValue(role.id)
          return (
            <li key={role.id} className={styles.selectOptionRow} role="option" aria-selected={value === roleValue}>
              <button
                type="button"
                className={`${styles.selectOption} ${value === roleValue ? styles.selectOptionActive : ''}`}
                onClick={() => {
                  onChange(roleValue, role.permissions)
                  closeMenu()
                }}
              >
                <span>
                  <span className={styles.selectOptionLabel}>{role.label}</span>
                  <span className={styles.selectOptionHint}>{role.description}</span>
                </span>
                {value === roleValue && <Check className={styles.selectCheck} />}
              </button>
              <button
                type="button"
                className={styles.selectRoleDeleteBtn}
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteCustom(role)
                }}
                aria-label={`Delete ${role.label} role`}
                title={`Delete ${role.label} role`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          )
        })}

        <li className={styles.selectCreateDivider} aria-hidden="true" />

        {creatingRole ? (
          <li className={styles.selectCreateRoleForm}>
            <label htmlFor="new-role-name">Role name</label>
            <input
              id="new-role-name"
              value={draftRoleName}
              onChange={(e) => setDraftRoleName(e.target.value)}
              placeholder="e.g. Inventory Manager"
              autoFocus
            />
            <label htmlFor="new-role-desc">Description</label>
            <input
              id="new-role-desc"
              value={draftRoleDesc}
              onChange={(e) => setDraftRoleDesc(e.target.value)}
              placeholder="Short summary of access"
            />
            <div className={styles.selectCreateRoleActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleCreateRole}
                disabled={!draftRoleName.trim()}
              >
                Save Role
              </button>
              <button
                type="button"
                className={styles.btn}
                onClick={() => {
                  setCreatingRole(false)
                  setDraftRoleName('')
                  setDraftRoleDesc('')
                }}
              >
                Back
              </button>
            </div>
          </li>
        ) : (
          <li>
            <button
              type="button"
              className={styles.selectCreateRoleBtn}
              onClick={() => setCreatingRole(true)}
            >
              <Plus className="w-4 h-4" />
              Create new role
            </button>
          </li>
        )}
      </SelectMenuPortal>
    </div>
  )
}

function StaffMemberDropdown({
  value,
  staff,
  onChange,
  onDeleteStaff,
  canDelete = false,
}: {
  value: string
  staff: StaffRecord[]
  onChange: (staffRecordId: string) => void
  onDeleteStaff?: (member: StaffRecord) => void | Promise<void>
  canDelete?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const position = useSelectMenuPosition(open, triggerRef)
  const selected = staff.find((member) => member.id === value)

  const handleDeleteStaff = async (member: StaffRecord) => {
    if (!onDeleteStaff) return
    if (!window.confirm(`Delete staff record for "${member.employeeName}" permanently?`)) return
    setDeletingId(member.id)
    try {
      await onDeleteStaff(member)
      if (value === member.id) onChange('')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className={styles.selectWrap}>
      <button
        ref={triggerRef}
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

      <SelectMenuPortal
        open={open}
        onClose={() => setOpen(false)}
        position={position}
        scrollable
      >
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
          <li
            key={member.id}
            className={canDelete ? styles.selectOptionRow : undefined}
            role="option"
            aria-selected={value === member.id}
          >
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
            {canDelete && (
              <button
                type="button"
                className={styles.selectRoleDeleteBtn}
                onClick={(e) => {
                  e.stopPropagation()
                  void handleDeleteStaff(member)
                }}
                disabled={deletingId === member.id}
                aria-label={`Delete ${member.employeeName}`}
                title={`Delete ${member.employeeName}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </li>
        ))}
        {staff.length === 0 && (
          <li className={styles.selectEmptyState}>No staff available without a login account</li>
        )}
      </SelectMenuPortal>
    </div>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const { user, authLoading, logout, products, refreshProducts } = useApp()
  const [tab, setTab] = useState<AdminTab>('dashboard')
  const [entranceSession, setEntranceSession] = useState(0)
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
  const [certificationTypes, setCertificationTypes] = useState<CertificationTypeRecord[]>([])
  const [editCertOptions, setEditCertOptions] = useState(() => buildCertificationTypeOptions([]))
  const [editCertificationType, setEditCertificationType] = useState('')
  const [editCertificationLogo, setEditCertificationLogo] = useState('')
  const [showEditCertTypeManager, setShowEditCertTypeManager] = useState(false)
  const [inventoryCertPreview, setInventoryCertPreview] =
    useState<CertificationAssetPreview | null>(null)

  const [editProduct, setEditProduct] = useState<Partial<Product> | null>(null)
  const [newProduct, setNewProduct] = useState(false)
  const [productDraftRows, setProductDraftRows] = useState<ProductDraftRow[] | null>(null)
  const [bulkImageDrafts, setBulkImageDrafts] = useState<BulkProductImageDraft[] | null>(null)
  const [bulkImagesUploadingRowId, setBulkImagesUploadingRowId] = useState<string | null>(null)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const productImageInputRef = useRef<HTMLInputElement>(null)
  const editCertDocumentInputRef = useRef<HTMLInputElement>(null)
  const [stockInput, setStockInput] = useState('')
  const [minStockAlertInput, setMinStockAlertInput] = useState('')
  const [maxPriceInput, setMaxPriceInput] = useState('')
  const [discountedPriceInput, setDiscountedPriceInput] = useState('')
  const [discountInput, setDiscountInput] = useState('')

  const syncEditCertOptions = (types: CertificationTypeRecord[]) => {
    setCertificationTypes(types)
    setEditCertOptions(buildCertificationTypeOptions(types))
  }

  const loadCertificationTypes = useCallback(async () => {
    try {
      const data = await apiFetch<{ certificationTypes: CertificationTypeRecord[] }>(
        '/api/admin/certification-types'
      )
      syncEditCertOptions(Array.isArray(data.certificationTypes) ? data.certificationTypes : [])
    } catch {
      syncEditCertOptions([])
    }
  }, [])

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
  const [showCreateUserForm, setShowCreateUserForm] = useState(false)
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([])
  const [hiddenBuiltInRoles, setHiddenBuiltInRoles] = useState<string[]>([])
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
  const [lowStockToastQueue, setLowStockToastQueue] = useState<AdminLowStockNotification[]>([])
  const [activeLowStockToast, setActiveLowStockToast] = useState<AdminLowStockNotification | null>(
    null
  )

  const ordersSnapshotRef = useRef<Map<string, OrderSnapshot>>(new Map())
  const snapshotReadyRef = useRef(false)
  const bulkSnapshotRef = useRef<Set<string>>(new Set())
  const bulkSnapshotReadyRef = useRef(false)
  const contactSnapshotRef = useRef<Set<string>>(new Set())
  const contactSnapshotReadyRef = useRef(false)
  const lowStockSnapshotRef = useRef<Set<string>>(new Set())
  const lowStockSnapshotReadyRef = useRef(false)

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

  const enqueueLowStockToasts = useCallback((items: AdminLowStockNotification[]) => {
    if (items.length === 0) return
    setLowStockToastQueue((prev) => [...prev, ...items])
  }, [])

  const syncLowStockSnapshot = useCallback((list: typeof products, emitNotifications: boolean) => {
    const { notifications, next } = detectLowStockNotifications(
      lowStockSnapshotRef.current,
      list,
      emitNotifications && lowStockSnapshotReadyRef.current
    )
    lowStockSnapshotRef.current = next
    lowStockSnapshotReadyRef.current = true
    return notifications
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
    setCustomRoles(loadCustomRoles())
    setHiddenBuiltInRoles(loadHiddenBuiltInRoles())
  }, [])

  useEffect(() => {
    if (tab !== 'inventory' && !editProduct) return
    void loadCertificationTypes()
  }, [tab, editProduct, loadCertificationTypes])

  useEffect(() => {
    if (!editCertificationType) {
      setEditCertificationLogo('')
      return
    }
    const match = certificationTypes.find((item) => item.type === editCertificationType)
    setEditCertificationLogo(match?.logoUrl ?? '')
  }, [certificationTypes, editCertificationType])

  useEffect(() => {
    if (authLoading) return
    if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
      router.replace('/login?admin=1')
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
    if (!activeLowStockToast && lowStockToastQueue.length > 0) {
      setActiveLowStockToast(lowStockToastQueue[0])
      setLowStockToastQueue((prev) => prev.slice(1))
    }
  }, [activeLowStockToast, lowStockToastQueue])

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

  const canViewInventory = Boolean(
    user &&
      (hasPermission(user, 'inventory_view') || hasPermission(user, 'inventory_manage'))
  )

  const lowStockProducts = useMemo(() => getLowStockProducts(products), [products])
  const lowStockCount = lowStockProducts.length

  useEffect(() => {
    if (!canViewInventory) return

    if (!lowStockSnapshotReadyRef.current) {
      syncLowStockSnapshot(products, false)
      return
    }

    if (user?.role !== 'admin') return

    const notifications = syncLowStockSnapshot(products, true)
    if (tab !== 'inventory' && notifications.length > 0) {
      enqueueLowStockToasts(notifications)
    }
  }, [products, tab, canViewInventory, user?.role, syncLowStockSnapshot, enqueueLowStockToasts])

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
      setError('SKU ID is required')
      return
    }
    if (!editProduct.manufacturingId?.trim()) {
      setError('Manufacturing ID is required')
      return
    }
    const stock = stockInput === '' ? 0 : Math.max(0, parseInt(stockInput, 10) || 0)
    const minStockQty =
      minStockAlertInput === '' ? 0 : Math.max(0, parseInt(minStockAlertInput, 10) || 0)
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
      specs: {
        ...(editProduct.specs || {}),
        'Certification Type': editCertificationType || '—',
        'Min Stock Qty': String(minStockQty),
      },
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
      setEditCertificationType('')
      setEditCertificationLogo('')
      setShowEditCertTypeManager(false)
      setStockInput('')
      setMinStockAlertInput('')
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
    setEditProduct(null)
    setProductDraftRows([createEmptyProductDraftRow()])
    setEditCertificationType('')
    setEditCertificationLogo('')
    setShowEditCertTypeManager(false)
  }

  const openEditProduct = (product: Product) => {
    setNewProduct(false)
    const certType = getProductCertificationType(product)
    setEditCertificationType(certType)
    setShowEditCertTypeManager(false)
    setStockInput(String(product.stock ?? 0))
    setMinStockAlertInput(String(getMinStockAlert(product)))
    setMaxPriceInput(String(getMaxPrice(product)))
    setDiscountedPriceInput(String(product.price ?? 0))
    setDiscountInput(String(getDiscountPercent(product)))
    setEditProduct({ ...product })
    void loadCertificationTypes()
  }

  const closeProductEditor = () => {
    setEditProduct(null)
    setNewProduct(false)
    setProductDraftRows(null)
    setBulkImageDrafts(null)
    setBulkImagesUploadingRowId(null)
    setBulkSaving(false)
    setEditCertificationType('')
    setEditCertificationLogo('')
    setShowEditCertTypeManager(false)
    setStockInput('')
    setMinStockAlertInput('')
    setMaxPriceInput('')
    setDiscountedPriceInput('')
    setDiscountInput('')
  }

  const uploadProductFile = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    const token = getStoredToken()
    const res = await fetch('/api/admin/products/upload', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })
    const data = (await res.json()) as { url?: string; error?: string }
    if (!res.ok) throw new Error(data.error || 'Upload failed')
    if (!data.url) throw new Error('Upload failed')
    return data.url
  }

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editProduct) return

    setImageUploading(true)
    try {
      const url = await uploadProductFile(file)
      setEditProduct({
        ...editProduct,
        image: url,
        images: [url, ...(editProduct.images || []).filter((img) => img !== url)],
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed')
    } finally {
      e.target.value = ''
      setImageUploading(false)
    }
  }

  const handleEditCertDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editProduct) return

    setImageUploading(true)
    try {
      const url = await uploadCertificationDocument(file)
      setEditProduct({ ...editProduct, certificationImage: url })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Certificate upload failed')
    } finally {
      e.target.value = ''
      setImageUploading(false)
    }
  }

  const handleEditCertTypeChange = (value: string) => {
    if (value === CREATE_CERT_VALUE) {
      setShowEditCertTypeManager(true)
      return
    }
    setEditCertificationType(value)
    const match = certificationTypes.find((item) => item.type === value)
    setEditCertificationLogo(match?.logoUrl ?? '')
  }

  const handleEditCertTypesUpdated = (types: CertificationTypeRecord[]) => {
    syncEditCertOptions(types)
    if (editCertificationType && !types.some((item) => item.type === editCertificationType)) {
      setEditCertificationType('')
      setEditCertificationLogo('')
    }
  }

  const uploadCertificationDocument = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('kind', 'doc')
    const token = getStoredToken()
    const res = await fetch('/api/admin/certifications/upload', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })
    const data = (await res.json()) as { url?: string; error?: string }
    if (!res.ok) throw new Error(data.error || 'Upload failed')
    if (!data.url) throw new Error('Upload failed')
    return data.url
  }

  const handleBulkCertDocumentUpload = async (rowId: string, certEntryId: string, file: File) => {
    setImageUploading(true)
    try {
      const url = await uploadCertificationDocument(file)
      setProductDraftRows(
        (prev) =>
          prev?.map((row) => {
            if (row.id !== rowId) return row
            return {
              ...row,
              certifications: row.certifications.map((entry) =>
                entry.id === certEntryId ? { ...entry, documentUrl: url } : entry
              ),
            }
          }) ?? null
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Certificate upload failed')
    } finally {
      setImageUploading(false)
    }
  }

  const proceedToBulkImages = () => {
    if (!productDraftRows?.length) return

    for (let i = 0; i < productDraftRows.length; i++) {
      const row = productDraftRows[i]
      const rowLabel = `Row ${i + 1}`

      if (!row.modelId.trim()) {
        setError(`${rowLabel}: SKU ID is required`)
        return
      }
      if (!row.manufacturingId.trim()) {
        setError(`${rowLabel}: MFG ID is required`)
        return
      }
      if (row.stock === '') {
        setError(`${rowLabel}: Total qty is required`)
        return
      }
      if (row.minStockQty === '') {
        setError(`${rowLabel}: Min stock qty is required`)
        return
      }
      if (row.basePrice === '') {
        setError(`${rowLabel}: Base price is required`)
        return
      }
      if (row.mrp === '') {
        setError(`${rowLabel}: MRP is required`)
        return
      }
      if (!row.name.trim()) {
        setError(`${rowLabel}: Product name is required`)
        return
      }
      if (!row.specification.trim()) {
        setError(`${rowLabel}: Specification is required`)
        return
      }
    }

    setError('')
    setBulkImageDrafts(
      productDraftRows.map((row) => ({
        rowId: row.id,
        modelId: row.modelId.trim(),
        manufacturingId: row.manufacturingId.trim(),
        name: row.name.trim(),
        imageUrls: [],
      }))
    )
  }

  const handleBulkGalleryUpload = async (rowId: string, files: File[]) => {
    setBulkImagesUploadingRowId(rowId)
    try {
      const urls: string[] = []
      for (const file of files) {
        const validationError = validateProductGalleryFile(file)
        if (validationError) {
          setError(validationError)
          return
        }
        const url = await uploadProductFile(file)
        urls.push(url)
      }
      setBulkImageDrafts(
        (prev) =>
          prev?.map((draft) =>
            draft.rowId === rowId ? { ...draft, imageUrls: [...draft.imageUrls, ...urls] } : draft
          ) ?? null
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed')
    } finally {
      setBulkImagesUploadingRowId(null)
    }
  }

  const finalizeBulkProducts = async () => {
    if (!productDraftRows?.length || !bulkImageDrafts?.length) return

    setBulkSaving(true)
    setError('')
    try {
      for (const row of productDraftRows) {
        const imagesDraft = bulkImageDrafts.find((draft) => draft.rowId === row.id)
        const gallery = imagesDraft?.imageUrls ?? []
        const defaultImage = '/images/drone-sentinel-pro.png'
        const primaryImage = gallery[0] || defaultImage
        const allImages = gallery.length > 0 ? gallery : [defaultImage]
        const stock = row.stock === '' ? 0 : Math.max(0, parseInt(row.stock, 10) || 0)
        const minStockQty =
          row.minStockQty === '' ? 0 : Math.max(0, parseInt(row.minStockQty, 10) || 0)
        const basePrice =
          row.basePrice === '' ? 0 : Math.max(0, parseInt(row.basePrice, 10) || 0)
        const price =
          row.finalPrice === '' ? 0 : Math.max(0, parseInt(row.finalPrice, 10) || 0)
        const mrp = row.mrp === '' ? price : Math.max(0, parseInt(row.mrp, 10) || 0)
        const originalPrice = mrp > price ? mrp : undefined
        const certifications = certDraftEntriesToProductCertifications(row.certifications)
        const primaryCertification = certifications[0]

        await apiFetch('/api/admin/products', {
          method: 'POST',
          body: JSON.stringify({
            name: row.name,
            modelId: row.modelId.trim(),
            manufacturingId: row.manufacturingId.trim(),
            price,
            originalPrice,
            stock,
            inStock: stock > 0,
            image: primaryImage,
            images: allImages,
            category: 'Professional Drones',
            subcategory: 'General',
            description: row.specification,
            longDescription: row.specification,
            specs: {
              'Base Price': basePrice > 0 ? `₹${basePrice.toLocaleString('en-IN')}` : '—',
              'Min Stock Qty': String(minStockQty),
              Specification: row.specification || '—',
              'Certification Type': primaryCertification?.type || '—',
              'Certification Types': certificationTypesLabel(certifications),
            },
            certificationImage: primaryCertification?.documentUrl,
            certifications,
            rating: 4.5,
            reviews: 0,
            warranty: defaultProductWarranty(),
          }),
        })
      }

      showMsg(
        `${productDraftRows.length} product${productDraftRows.length === 1 ? '' : 's'} added successfully`,
        'product'
      )
      closeProductEditor()
      await refreshProducts()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save products')
    } finally {
      setBulkSaving(false)
    }
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

  const deleteStaffRecord = async (member: StaffRecord) => {
    try {
      await apiFetch('/api/admin/staff-records', {
        method: 'DELETE',
        body: JSON.stringify({ id: member.id }),
      })
      showMsg(`Staff record "${member.employeeName}" deleted`, 'delete')
      if (newUserForm.staffRecordId === member.id) {
        handleStaffMemberChange('')
      }
      await loadAvailableStaff()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete staff record')
      throw err
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
      const { role, permissions } = resolveApiRole(
        newUserForm.role,
        newUserForm.permissions,
        customRoles
      )
      await apiFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ ...newUserForm, role, permissions }),
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
      setShowCreateUserForm(false)
      await loadUsers()
      await loadAvailableStaff()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    }
  }

  const saveUserAccess = async () => {
    if (!editingAccess) return
    try {
      const { role, permissions } = resolveApiRole(
        editingAccess.role,
        editingAccess.permissions,
        customRoles
      )
      await apiFetch('/api/admin/users', {
        method: 'PATCH',
        body: JSON.stringify({
          id: editingAccess.id,
          role,
          permissions,
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

  const handleDashboardReady = useCallback((ready: boolean) => {
    if (!ready) return
    const session = startAdminEntranceOnce()
    if (session > 0) setEntranceSession(session)
  }, [])

  useEffect(() => {
    if (entranceSession <= 0) return
    const timer = window.setTimeout(() => completeAdminEntrance(entranceSession), 1200)
    return () => window.clearTimeout(timer)
  }, [entranceSession])

  const handleLogout = async () => {
    await logout()
    router.push('/login?admin=1')
  }

  const closeCreateUserModal = () => {
    setShowCreateUserForm(false)
    setShowNewUserPassword(false)
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <AdminSlideUp delayMs={0}>
          <p className="text-muted-foreground">Loading...</p>
        </AdminSlideUp>
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

  type AdminNavItem = {
    id: AdminTab
    label: string
    icon: typeof Package
    badgeCount?: number
    alertCount?: number
  }

  const navItems: AdminNavItem[] = (
    [
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
    ] satisfies AdminNavItem[]
  )
    .filter((item) => {
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
    })
    .map((item) => {
      if (item.id === 'messages') return { ...item, badgeCount: unreadContactCount }
      if (item.id === 'customer-chat') return { ...item, badgeCount: unreadCustomerChatCount }
      if (item.id === 'inventory' && user?.role === 'admin') {
        return { ...item, alertCount: lowStockCount }
      }
      return item
    })

  const dismissNotification = () => setActiveNotification(null)

  const dismissUpdateToast = () => setActiveUpdateToast(null)

  const dismissToastNotification = () => setActiveToastNotification(null)

  const dismissContactToast = () => setActiveContactToast(null)

  const dismissLowStockToast = () => setActiveLowStockToast(null)

  const viewOrderFromNotification = () => {
    setActiveNotification(null)
    setActiveToastNotification(null)
    setTab('orders')
  }

  const viewMessagesFromNotification = () => {
    setActiveContactToast(null)
    setTab('messages')
  }

  const viewInventoryFromNotification = () => {
    setActiveLowStockToast(null)
    setTab('inventory')
  }

  return (
    <AdminShell
      user={user}
      tab={tab}
      onTabChange={setTab}
      onLogout={handleLogout}
      navItems={navItems}
      entranceSession={tab === 'dashboard' ? entranceSession : 0}
    >
      {tab === 'dashboard' && (
        <AdminDashboard
          refreshKey={dashboardRefresh}
          entranceSession={entranceSession}
          onReadyChange={handleDashboardReady}
        />
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

              <div className={`${styles.tableWrap} ${styles.inventoryTableWrap}`}>
                <table className={`${styles.table} ${styles.inventoryTable}`}>
                  <colgroup>
                    <col className={styles.inventoryColProduct} />
                    <col className={styles.inventoryColSku} />
                    <col className={styles.inventoryColPrice} />
                    <col className={styles.inventoryColPrice} />
                    <col className={styles.inventoryColNumeric} />
                    <col className={styles.inventoryColNumeric} />
                    <col className={styles.inventoryColMinAlert} />
                    <col className={styles.inventoryColStatus} />
                    <col className={styles.inventoryColCert} />
                    <col className={styles.inventoryColActions} />
                  </colgroup>
                  <thead>
                    <tr>
                      <AdminTableColumnHeader label="Product" highlighted={highlightedColumn === 'product'} />
                      <AdminTableColumnHeader
                        label="SKU / MFG"
                        highlighted={highlightedColumn === 'modelId'}
                        wrap
                      />
                      <AdminTableColumnHeader label="Max Price" highlighted={highlightedColumn === 'maxPrice'} wrap />
                      <AdminTableColumnHeader label="Discounted" highlighted={highlightedColumn === 'discounted'} wrap />
                      <AdminTableColumnHeader label="Discount" highlighted={highlightedColumn === 'discount'} wrap />
                      <AdminTableColumnHeader label="Stock" highlighted={highlightedColumn === 'stock'} />
                      <AdminTableColumnHeader
                        label="Min Stock Alert"
                        highlighted={highlightedColumn === 'minStockAlert'}
                        wrap
                      />
                      <AdminTableColumnHeader label="Status" highlighted={highlightedColumn === 'status'} />
                      <AdminTableColumnHeader
                        label="Certification"
                        highlighted={highlightedColumn === 'certification'}
                        wrap
                      />
                      <AdminTableColumnHeader label="Actions" highlighted={highlightedColumn === 'actions'} />
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => {
                      const discount = getDiscountPercent(p)
                      const minStockAlert = getMinStockAlert(p)
                      const productCertifications = getProductCertifications(p)
                      const lowStock = isLowStockProduct(p)
                      return (
                      <tr key={p.id} className={lowStock ? styles.inventoryRowLowStock : undefined}>
                        <td>
                          <button
                            type="button"
                            className={`${styles.productNameBtn} ${styles.inventoryProductName}`}
                            onClick={() => setPreviewProduct(p)}
                            title={p.name}
                          >
                            {p.name}
                          </button>
                        </td>
                        <td className={styles.inventorySkuCell}>
                          <div className={styles.modelIdCell}>
                            <span title={p.modelId}>{p.modelId}</span>
                            <span className={styles.modelIdSub} title={p.manufacturingId || undefined}>
                              MFG: {p.manufacturingId || '—'}
                            </span>
                          </div>
                        </td>
                        <td className={styles.inventoryPriceCell}>{formatPrice(getMaxPrice(p))}</td>
                        <td className={styles.inventoryPriceCell}>{formatPrice(p.price)}</td>
                        <td className={styles.inventoryNumericCell}>{discount > 0 ? `${discount}%` : '—'}</td>
                        <td className={styles.inventoryNumericCell}>{p.stock}</td>
                        <td className={styles.inventoryNumericCell}>
                          {minStockAlert > 0 ? minStockAlert : '—'}
                        </td>
                        <td className={styles.inventoryStatusCell}>
                          {p.inStock ? 'In Stock' : 'Out of Stock'}
                        </td>
                        <td className={styles.inventoryCertCell}>
                          <div className={styles.inventoryCertContent}>
                            {productCertifications.length === 0 ? (
                              <span className={styles.inventoryCertType}>—</span>
                            ) : (
                              productCertifications.map((cert) => {
                                const certificationLogo = certificationTypes.find(
                                  (item) => item.type === cert.type
                                )?.logoUrl
                                return (
                                  <div key={cert.type} className={styles.inventoryCertItem}>
                                    <span className={styles.inventoryCertType} title={cert.type}>
                                      {cert.type}
                                    </span>
                                    <button
                                      type="button"
                                      className={styles.inventoryCertIconBtn}
                                      onClick={() => {
                                        if (!cert.documentUrl) return
                                        setInventoryCertPreview({
                                          title: cert.type,
                                          url: cert.documentUrl,
                                          productLabel: p.name,
                                        })
                                      }}
                                      disabled={!cert.documentUrl}
                                      title={
                                        cert.documentUrl
                                          ? 'View uploaded certificate'
                                          : 'No certificate uploaded'
                                      }
                                      aria-label={
                                        cert.documentUrl
                                          ? `View ${cert.type} certificate for ${p.name}`
                                          : `No certificate uploaded for ${cert.type}`
                                      }
                                    >
                                      {certificationLogo ? (
                                        <Image
                                          src={certificationLogo}
                                          alt=""
                                          width={28}
                                          height={28}
                                          className={styles.inventoryCertIconImage}
                                          unoptimized
                                        />
                                      ) : (
                                        <Award className="w-4 h-4" />
                                      )}
                                    </button>
                                  </div>
                                )
                              })
                            )}
                          </div>
                        </td>
                        <td>
                          {canManageInventory ? (
                            <div className={styles.inventoryActions}>
                              <button
                                type="button"
                                className={`${styles.btn} ${styles.btnPrimary} ${styles.inventoryActionBtn}`}
                                onClick={() => openEditProduct(p)}
                                aria-label={`Edit ${p.name}`}
                                title="Edit product"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                className={`${styles.btn} ${styles.btnDanger} ${styles.inventoryActionBtn}`}
                                onClick={() => deleteProduct(p.id)}
                                aria-label={`Delete ${p.name}`}
                                title="Delete product"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">View only</span>
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
                      <AdminTableColumnHeader label="Order ID" highlighted={highlightedColumn === 'orderId'} />
                      <AdminTableColumnHeader label="Customer" highlighted={highlightedColumn === 'customer'} />
                      <AdminTableColumnHeader label="Total" highlighted={highlightedColumn === 'total'} />
                      <AdminTableColumnHeader label="Payment" highlighted={highlightedColumn === 'payment'} />
                      <AdminTableColumnHeader label="Tracking" highlighted={highlightedColumn === 'actions'} />
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
                        <td>
                          <span className={`${styles.badge} ${styles[paymentBadgeClass(order.paymentStatus) as keyof typeof styles] ?? styles.badgePending}`}>
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
                        <td colSpan={5} className="text-center text-muted-foreground py-8">
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
                      <AdminTableColumnHeader label="Order ID" highlighted={highlightedColumn === 'orderId'} />
                      <AdminTableColumnHeader label="Amount" highlighted={highlightedColumn === 'amount'} />
                      <AdminTableColumnHeader label="Method" highlighted={highlightedColumn === 'method'} />
                      <AdminTableColumnHeader label="Status" highlighted={highlightedColumn === 'payment'} />
                      <AdminTableColumnHeader label="Update" highlighted={highlightedColumn === 'update'} />
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
                            className={`${styles.badge} ${styles[paymentBadgeClass(order.paymentStatus) as keyof typeof styles] ?? styles.badgePending}`}
                          >
                            {order.paymentStatus}
                          </span>
                        </td>
                        <td>
                          <AdminBadgeDropdown
                            value={order.paymentStatus}
                            options={PAYMENT_STATUSES}
                            badgeClassMap={PAYMENT_BADGE}
                            disabled={!canManagePayments}
                            onChange={(status) =>
                              updateOrder(order.id, { paymentStatus: status })
                            }
                          />
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
              <div className={styles.pageHeader}>
                <h1 className={styles.pageTitle}>Staff & User Management</h1>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={() => setShowCreateUserForm(true)}
                >
                  <UserPlus className="w-4 h-4 inline mr-1" />
                  Create New User
                </button>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <AdminTableColumnHeader label="Username" highlighted={highlightedColumn === 'username'} />
                      <AdminTableColumnHeader label="Name" highlighted={highlightedColumn === 'name'} />
                      <AdminTableColumnHeader label="Email" highlighted={highlightedColumn === 'email'} />
                      <AdminTableColumnHeader label="Role" highlighted={highlightedColumn === 'role'} />
                      <AdminTableColumnHeader label="Accessibility" highlighted={highlightedColumn === 'accessibility'} />
                      <AdminTableColumnHeader label="Account Access" highlighted={highlightedColumn === 'accountAccess'} />
                      {isFullAdmin && (
                        <AdminTableColumnHeader label="Password" highlighted={highlightedColumn === 'password'} />
                      )}
                      <AdminTableColumnHeader label="Created" highlighted={highlightedColumn === 'created'} />
                      {isFullAdmin && (
                        <AdminTableColumnHeader label="Delete" highlighted={highlightedColumn === 'delete'} />
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
              <TermsAgreementTemplatePanel
                isAdmin={isFullAdmin}
                onMessage={showMsg}
                onError={setError}
              />
              <InvoiceDcTemplatePanel isAdmin={isFullAdmin} />
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

      {showCreateUserForm && (
        <div
          className={styles.createUserModalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-user-title"
          onClick={closeCreateUserModal}
        >
          <div className={styles.createUserModal} onClick={(e) => e.stopPropagation()}>
            <AdminSlideUp forceAnimate delayMs={0}>
              <div className={styles.productModalHeader}>
                <h3 id="create-user-title" className={styles.productModalTitle}>
                  Create New User
                </h3>
                <button
                  type="button"
                  className={styles.productModalClose}
                  onClick={closeCreateUserModal}
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </AdminSlideUp>

            <form onSubmit={createStaffUser}>
              <AdminSlideUp forceAnimate delayMs={60}>
                <div className={styles.formGrid}>
                  <div>
                    <label className={styles.formLabel}>Staff Member *</label>
                    <StaffMemberDropdown
                      value={newUserForm.staffRecordId}
                      staff={availableStaff}
                      onChange={handleStaffMemberChange}
                      canDelete={isFullAdmin && canViewStaffRecords}
                      onDeleteStaff={deleteStaffRecord}
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
                      customRoles={customRoles}
                      onCustomRolesChange={setCustomRoles}
                      hiddenBuiltInRoles={hiddenBuiltInRoles}
                      onHiddenBuiltInRolesChange={setHiddenBuiltInRoles}
                      onChange={(role, permissions) =>
                        setNewUserForm({
                          ...newUserForm,
                          role,
                          permissions,
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
              </AdminSlideUp>

              <AdminSlideUp forceAnimate delayMs={120}>
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
              </AdminSlideUp>

              <AdminSlideUp forceAnimate delayMs={180}>
                <div className={`${styles.createUserModalActions} mt-4`}>
                  <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                    Create User
                  </button>
                  <button type="button" className={styles.btn} onClick={closeCreateUserModal}>
                    Cancel
                  </button>
                </div>
              </AdminSlideUp>
            </form>
          </div>
        </div>
      )}

      {editingAccess && (
        <div
          className={styles.createUserModalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-access-title"
          onClick={() => setEditingAccess(null)}
        >
          <div className={styles.createUserModal} onClick={(e) => e.stopPropagation()}>
            <AdminSlideUp forceAnimate delayMs={0}>
              <div className={styles.productModalHeader}>
                <h3 id="edit-access-title" className={styles.productModalTitle}>
                  Edit Accessibility — {editingAccess.name}
                </h3>
                <button
                  type="button"
                  className={styles.productModalClose}
                  onClick={() => setEditingAccess(null)}
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </AdminSlideUp>

            <AdminSlideUp forceAnimate delayMs={60}>
              {isFullAdmin && editingAccess.id !== user?.id && (
                <div className={styles.editRoleField}>
                  <label className={styles.formLabel}>Role</label>
                  <RoleDropdown
                    value={editingAccess.role}
                    customRoles={customRoles}
                    onCustomRolesChange={setCustomRoles}
                    hiddenBuiltInRoles={hiddenBuiltInRoles}
                    onHiddenBuiltInRolesChange={setHiddenBuiltInRoles}
                    onChange={(role, permissions) =>
                      setEditingAccess({
                        ...editingAccess,
                        role,
                        permissions,
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
                onChange={(permissions) => setEditingAccess({ ...editingAccess, permissions })}
                disabled={editingAccess.role === 'admin'}
              />
            </AdminSlideUp>

            <AdminSlideUp forceAnimate delayMs={120}>
              <div className={`${styles.createUserModalActions} mt-4`}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={saveUserAccess}
                  disabled={editingAccess.id === user?.id && editingAccess.role === 'admin'}
                >
                  Save Access
                </button>
                {isFullAdmin && editingAccess.id !== user?.id && (
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnDanger}`}
                    onClick={() => {
                      const target = staffUsers.find((u) => u.id === editingAccess.id)
                      if (target) void deleteUserAccount(target)
                    }}
                    disabled={deletingUserId === editingAccess.id}
                  >
                    {deletingUserId === editingAccess.id ? 'Deleting…' : 'Delete User'}
                  </button>
                )}
                <button type="button" className={styles.btn} onClick={() => setEditingAccess(null)}>
                  Cancel
                </button>
              </div>
            </AdminSlideUp>
          </div>
        </div>
      )}

      {productDraftRows && newProduct && (
        <ProductBulkEntryModal
          rows={productDraftRows}
          saving={bulkSaving}
          certDocumentUploading={imageUploading}
          onRowsChange={setProductDraftRows}
          onCertDocumentUpload={handleBulkCertDocumentUpload}
          onSave={proceedToBulkImages}
          onClose={closeProductEditor}
        />
      )}

      {bulkImageDrafts && productDraftRows && newProduct && (
        <ProductBulkImagesModal
          drafts={bulkImageDrafts}
          saving={bulkSaving}
          uploadingRowId={bulkImagesUploadingRowId}
          onDraftsChange={setBulkImageDrafts}
          onUploadFiles={handleBulkGalleryUpload}
          onError={setError}
          onConfirm={finalizeBulkProducts}
          onBack={() => setBulkImageDrafts(null)}
          onClose={closeProductEditor}
        />
      )}

      {editProduct && !newProduct && (
        <div
          className={styles.productModalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-editor-title"
          onClick={closeProductEditor}
        >
          <div className={styles.productModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.productModalHeader}>
              <h3 id="product-editor-title" className={styles.productModalTitle}>
                {newProduct ? 'New Product' : 'Edit Product'}
              </h3>
              <button
                type="button"
                className={styles.productModalClose}
                onClick={closeProductEditor}
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

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
                <label className={styles.formLabel}>SKU ID *</label>
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
                <label className={styles.formLabel}>Min Stock Alert</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className={styles.formInput}
                  value={minStockAlertInput}
                  placeholder="0"
                  onChange={(e) => {
                    const raw = e.target.value
                    if (raw === '' || /^\d+$/.test(raw)) {
                      setMinStockAlertInput(raw)
                    }
                  }}
                  onBlur={() => {
                    const parsed =
                      minStockAlertInput === '' ? 0 : Math.max(0, parseInt(minStockAlertInput, 10) || 0)
                    setMinStockAlertInput(String(parsed))
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
                <span className={styles.formLabel}>Product Image</span>
                <div className={styles.imagePickerRow}>
                  {editProduct.image && (
                    <div className={styles.imageThumb}>
                      <Image
                        src={editProduct.image}
                        alt={editProduct.name || 'Product'}
                        width={48}
                        height={48}
                        className={styles.imageThumbImg}
                        unoptimized
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    className={styles.imageIconBtn}
                    onClick={() => productImageInputRef.current?.click()}
                    disabled={imageUploading}
                    title={imageUploading ? 'Uploading...' : 'Upload product image'}
                    aria-label="Upload product image"
                  >
                    <ImageIcon className="w-5 h-5" />
                  </button>
                  <input
                    ref={productImageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className={styles.hiddenFileInput}
                    onChange={handleProductImageUpload}
                  />
                </div>
              </div>
            </div>
            <div className="mb-3">
              <label className={styles.formLabel}>Description</label>
              <input
                className={styles.formInput}
                value={editProduct.description || ''}
                onChange={(e) => setEditProduct({ ...editProduct, description: e.target.value })}
              />
            </div>
            <div className="mb-3">
              <span className={styles.formLabel}>Warranty Duration</span>
              <div className={styles.warrantyChecks}>
                {WARRANTY_DURATION_OPTIONS.map((option) => (
                  <label key={option} className={styles.warrantyCheckItem}>
                    <input
                      type="checkbox"
                      checked={getWarrantyDuration(editProduct) === option}
                      onChange={() => setEditProduct(withWarrantyDuration(editProduct, option))}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className={`mb-3 ${styles.editCertLogoField}`}>
              <label className={styles.formLabel}>Logo</label>
              <button
                type="button"
                className={`${styles.editCertLogoBtn} ${
                  editCertificationLogo ? styles.editCertLogoBtnFilled : ''
                }`}
                onClick={() => editCertDocumentInputRef.current?.click()}
                disabled={imageUploading || !editCertificationType}
                title={
                  !editCertificationType
                    ? 'Select a certification type first'
                    : editProduct.certificationImage
                      ? 'Certificate uploaded — click to replace'
                      : 'Upload certificate document'
                }
                aria-label="Upload certificate document"
              >
                <span
                  className={`${styles.editCertStatus} ${
                    editProduct.certificationImage
                      ? styles.editCertStatusDone
                      : styles.editCertStatusPending
                  }`}
                  aria-hidden="true"
                />
                {editCertificationLogo ? (
                  <Image
                    src={editCertificationLogo}
                    alt=""
                    width={48}
                    height={48}
                    className={styles.editCertLogoPreview}
                    unoptimized
                  />
                ) : (
                  <ImageIcon className="w-5 h-5" />
                )}
              </button>
              <input
                ref={editCertDocumentInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                className={styles.hiddenFileInput}
                onChange={handleEditCertDocumentUpload}
              />
            </div>
            <div className="mb-3">
              <label className={styles.formLabel}>Certification type</label>
              <AnimatedFormSelect
                className={styles.editCertSelect}
                value={editCertificationType}
                options={editCertOptions}
                onChange={handleEditCertTypeChange}
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
        </div>
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

      {inventoryCertPreview && (
        <CertificationAssetViewModal
          asset={inventoryCertPreview}
          onClose={() => setInventoryCertPreview(null)}
        />
      )}

      <CertificationTypeManagerModal
        open={showEditCertTypeManager}
        meta={editProduct?.name ? `Edit product · ${editProduct.name}` : 'Edit product'}
        onClose={() => setShowEditCertTypeManager(false)}
        onUseType={(type, logoUrl) => {
          setEditCertificationType(type)
          setEditCertificationLogo(logoUrl)
        }}
        onTypesUpdated={handleEditCertTypesUpdated}
      />

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

      {activeLowStockToast && user?.role === 'admin' && (
        <AdminLowStockToast
          notification={activeLowStockToast}
          queueCount={lowStockToastQueue.length}
          onDismiss={dismissLowStockToast}
          onViewInventory={viewInventoryFromNotification}
        />
      )}

      {activeUpdateToast && (
        <AdminUpdateToast
          toast={activeUpdateToast}
          queueCount={updateToastQueue.length}
          onDismiss={dismissUpdateToast}
        />
      )}

      {error && <AdminErrorToast message={error} onDismiss={() => setError('')} />}
    </AdminShell>
  )
}
