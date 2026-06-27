import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'
import { PRODUCTS } from '../mockData'
import { DEFAULT_MAIN_TEMPLATE } from '../mainTemplateTypes'
import type { Product, User, SavedAddress } from '../types'
import { parsePermissions, permissionsForRole } from '../permissions'
import { invoiceIdFromOrderId } from '../invoiceIds'
import {
  query as pgQuery,
  queryOne as pgQueryOne,
  execute as pgExecute,
} from './pgClient'

const SCHEMA_PATH = path.join(process.cwd(), 'lib', 'db', 'schema.sql')

let initPromise: Promise<void> | null = null

export async function ensureDatabase(): Promise<void> {
  if (!initPromise) {
    initPromise = initializeDatabase().catch((error) => {
      initPromise = null
      throw error
    })
  }
  await initPromise
}

async function initializeDatabase(): Promise<void> {
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8')
  await pgExecute(schema)

  await seedDefaultAdmin()
  await seedStaffRecords()
  await seedStaffDemoUser()
  await seedTestCustomer()
  await seedProducts()
  await backfillUserPermissions()
  await backfillInvoices()
  await backfillProductModelIds()
  await backfillProductManufacturingIds()
  await seedMainTemplate()
}

async function seedDefaultAdmin(): Promise<void> {
  const existing = await pgQueryOne<{ id: string }>(
    'SELECT id FROM users WHERE username = ?',
    ['admin']
  )
  if (existing) return

  const hash = bcrypt.hashSync('admin', 10)
  await pgExecute(
    `INSERT INTO users (id, username, email, password_hash, name, role, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      'admin-001',
      'admin',
      'admin@hawking.com',
      hash,
      'System Administrator',
      'admin',
      new Date().toISOString(),
    ]
  )
}

async function seedStaffDemoUser(): Promise<void> {
  const staffUserId = 'staff-user-001'
  let userId = staffUserId

  const existing = await pgQueryOne<{ id: string }>(
    'SELECT id FROM users WHERE username = ?',
    ['staff']
  )

  if (existing) {
    userId = existing.id
  } else {
    const hash = bcrypt.hashSync('staff', 10)
    const now = new Date().toISOString()
    await pgExecute(
      `INSERT INTO users (id, username, email, password_hash, name, role, permissions, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        staffUserId,
        'staff',
        'staff@hawking.com',
        hash,
        'Ravi Kumar',
        'staff',
        JSON.stringify(permissionsForRole('staff')),
        now,
      ]
    )
  }

  await pgExecute("UPDATE staff_records SET user_id = ? WHERE id = 'staff-001'", [userId])
}

async function seedTestCustomer(): Promise<void> {
  const existing = await pgQueryOne<{ id: string; name: string }>(
    'SELECT id, name FROM users WHERE username = ?',
    ['test']
  )
  if (existing) {
    if (/customer$/i.test(existing.name.trim())) {
      await pgExecute('UPDATE users SET name = ? WHERE username = ?', [
        existing.name.replace(/\s+customer$/i, '').trim() || existing.name,
        'test',
      ])
    }
    return
  }

  const hash = bcrypt.hashSync('test', 10)
  await pgExecute(
    `INSERT INTO users (id, username, email, password_hash, name, role, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      'customer-test-001',
      'test',
      'test@hawking.com',
      hash,
      'Test',
      'customer',
      new Date().toISOString(),
    ]
  )
}

async function seedProducts(): Promise<void> {
  const count = await pgQueryOne<{ c: string }>('SELECT COUNT(*)::int AS c FROM products')
  if (Number(count?.c ?? 0) > 0) return

  const now = new Date().toISOString()
  for (const product of PRODUCTS) {
    const withStock = { ...product, stock: product.inStock ? 50 : 0 }
    await pgExecute('INSERT INTO products (id, data, stock, updated_at) VALUES (?, ?, ?, ?)', [
      product.id,
      JSON.stringify(withStock),
      withStock.stock,
      now,
    ])
  }
}

async function seedStaffRecords(): Promise<void> {
  const count = await pgQueryOne<{ c: string }>('SELECT COUNT(*)::int AS c FROM staff_records')
  if (Number(count?.c ?? 0) > 0) return

  const now = new Date().toISOString()
  const insertSql = `INSERT INTO staff_records (id, employee_name, aadhaar_number, address, contact_number,
      alternate_contact_number, alternate_contact_person, bank_account_number, bank_name, bank_ifsc,
      pan_card, passport_photo, joining_date, work_status, blood_group, medical_history, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

  await pgExecute(insertSql, [
    'staff-001',
    'Ravi Kumar',
    'XXXX-XXXX-4521',
    '45 JN Road, Kamarajapuram, Thiruvallur, TN 602001',
    '+91 99401 99407',
    '+91 98765 43210',
    'Priya Kumar (Spouse)',
    '123456789012',
    'State Bank of India',
    'SBIN0001234',
    'ABCPK1234F',
    '',
    '2023-03-15',
    'live',
    'O+',
    'No chronic conditions. Mild seasonal allergies.',
    now,
    now,
  ])

  await pgExecute(insertSql, [
    'staff-002',
    'Anita Sharma',
    'XXXX-XXXX-7892',
    '12 Defence Colony, Tech City, TC 10001',
    '+91 91234 56789',
    '+91 99887 76655',
    'Raj Sharma (Father)',
    '987654321098',
    'HDFC Bank',
    'HDFC0000456',
    'XYZPS5678G',
    '',
    '2022-08-01',
    'live',
    'B+',
    'Asthma - uses inhaler as needed.',
    now,
    now,
  ])
}

async function seedMainTemplate(): Promise<void> {
  const existing = await pgQueryOne<{ key: string }>(
    'SELECT key FROM site_settings WHERE key = ?',
    ['main_template']
  )
  if (existing) return

  await pgExecute('INSERT INTO site_settings (key, data, updated_at) VALUES (?, ?, ?)', [
    'main_template',
    JSON.stringify(DEFAULT_MAIN_TEMPLATE),
    new Date().toISOString(),
  ])
}

async function backfillUserPermissions(): Promise<void> {
  const users = await pgQuery<{ id: string; role: string; permissions: string | null }>(
    'SELECT id, role, permissions FROM users'
  )

  for (const user of users) {
    if (!user.permissions) {
      const perms = parsePermissions(null, user.role as User['role'])
      if (perms) {
        await pgExecute('UPDATE users SET permissions = ? WHERE id = ?', [
          JSON.stringify(perms),
          user.id,
        ])
      }
    }
  }
}

type LegacyProduct = Product & { sku?: string }

function normalizeProduct(product: LegacyProduct): Product {
  const modelId = (product.modelId ?? product.sku ?? '').trim()
  const { sku: _legacySku, ...rest } = product
  return { ...rest, modelId }
}

async function backfillProductModelIds(): Promise<void> {
  const rows = await pgQuery<{ id: string; data: string }>('SELECT id, data FROM products')
  for (const row of rows) {
    const raw = JSON.parse(row.data) as LegacyProduct
    if (!raw.sku && raw.modelId?.trim()) continue
    const normalized = normalizeProduct(raw)
    await pgExecute('UPDATE products SET data = ? WHERE id = ?', [JSON.stringify(normalized), row.id])
  }
}

async function backfillProductManufacturingIds(): Promise<void> {
  const rows = await pgQuery<{ id: string; data: string }>('SELECT id, data FROM products')
  for (const row of rows) {
    const product = normalizeProduct(JSON.parse(row.data) as LegacyProduct)
    if (product.manufacturingId?.trim()) continue
    const manufacturingId = product.modelId
      ? product.modelId.replace(/^HDS-/i, 'MFG-')
      : `MFG-${product.id}`
    await pgExecute('UPDATE products SET data = ? WHERE id = ?', [
      JSON.stringify({ ...product, manufacturingId }),
      row.id,
    ])
  }
}

async function backfillInvoices(): Promise<void> {
  const orders = await pgQuery<{
    id: string
    user_id: string
    total: number
    payment_status: string
    payment_method: string | null
    created_at: string
    customer_name: string | null
  }>(
    `SELECT o.id, o.user_id, o.total, o.payment_status, o.payment_method, o.created_at, u.name AS customer_name
     FROM orders o
     LEFT JOIN users u ON u.id = o.user_id`
  )

  for (const order of orders) {
    await pgExecute(
      `INSERT INTO invoices (id, order_id, user_id, customer_name, total, payment_status, payment_method, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (order_id) DO NOTHING`,
      [
        invoiceIdFromOrderId(order.id),
        order.id,
        order.user_id,
        order.customer_name,
        order.total,
        order.payment_status,
        order.payment_method,
        order.created_at,
      ]
    )
  }
}

export type DbUser = {
  id: string
  username: string
  email: string
  password_hash: string
  password_plain?: string | null
  name: string
  role: User['role']
  phone: string | null
  permissions: string | null
  addresses: string | null
  access_locked?: number | null
  profile_photo?: string | null
  created_at: string
}

function parseSavedAddresses(raw: string | null): SavedAddress[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as SavedAddress[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (a) => a && typeof a.id === 'string' && typeof a.label === 'string'
    )
  } catch {
    return []
  }
}

export function dbUserToUser(row: DbUser): User {
  const addresses = parseSavedAddresses(row.addresses)
  const primary = addresses[0]

  return {
    id: row.id,
    username: row.username,
    email: row.email,
    name: row.name,
    role: row.role,
    phone: row.phone ?? undefined,
    addresses: addresses.length > 0 ? addresses : undefined,
    address: primary?.street,
    city: primary?.city,
    state: primary?.state,
    zipCode: primary?.zipCode,
    permissions: parsePermissions(row.permissions, row.role),
    accessLocked: Boolean(row.access_locked),
    profilePhoto: row.profile_photo ?? undefined,
  }
}

export async function getAllProducts(): Promise<Product[]> {
  await ensureDatabase()
  const rows = await pgQuery<{ id: string; data: string; stock: number }>(
    'SELECT id, data, stock FROM products ORDER BY id'
  )

  return rows.map((row) => {
    const product = normalizeProduct(JSON.parse(row.data) as LegacyProduct)
    return {
      ...product,
      stock: row.stock,
      inStock: row.stock > 0,
    }
  })
}

export async function getProductById(id: string): Promise<Product | null> {
  await ensureDatabase()
  const row = await pgQueryOne<{ data: string; stock: number }>(
    'SELECT data, stock FROM products WHERE id = ?',
    [id]
  )
  if (!row) return null
  const product = normalizeProduct(JSON.parse(row.data) as LegacyProduct)
  return { ...product, stock: row.stock, inStock: row.stock > 0 }
}

export async function query<T>(sql: string, params: unknown[] = []) {
  await ensureDatabase()
  return pgQuery<T>(sql, params)
}

export async function queryOne<T>(sql: string, params: unknown[] = []) {
  await ensureDatabase()
  return pgQueryOne<T>(sql, params)
}

export async function execute(sql: string, params: unknown[] = []) {
  await ensureDatabase()
  return pgExecute(sql, params)
}
