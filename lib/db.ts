import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import bcrypt from 'bcryptjs'
import { PRODUCTS } from './mockData'
import { DEFAULT_MAIN_TEMPLATE } from './mainTemplateTypes'
import type { Product, User, SavedAddress } from './types'
import { parsePermissions, permissionsForRole } from './permissions'
import { ensureDailyAbsences } from './staffAttendance'

const DB_PATH = path.join(process.cwd(), 'data', 'hds.db')

let dbInstance: Database.Database | null = null

export function getDb(): Database.Database {
  if (!dbInstance) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
    dbInstance = new Database(DB_PATH)
    dbInstance.pragma('journal_mode = WAL')
    initializeDatabase(dbInstance)
  }
  return dbInstance
}

function initializeDatabase(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      phone TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      items TEXT NOT NULL,
      total REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      payment_status TEXT NOT NULL DEFAULT 'pending',
      authorized INTEGER NOT NULL DEFAULT 0,
      payment_method TEXT,
      shipping_address TEXT NOT NULL,
      delivery_method TEXT NOT NULL,
      tracking_number TEXT,
      created_at TEXT NOT NULL,
      delivery_date TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS staff_records (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      employee_name TEXT NOT NULL,
      aadhaar_number TEXT,
      address TEXT,
      contact_number TEXT,
      alternate_contact_number TEXT,
      alternate_contact_person TEXT,
      bank_account_number TEXT,
      bank_name TEXT,
      bank_ifsc TEXT,
      pan_card TEXT,
      passport_photo TEXT,
      joining_date TEXT,
      work_status TEXT NOT NULL DEFAULT 'live',
      resigned_date TEXT,
      resignation_letter TEXT,
      blood_group TEXT,
      medical_history TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS staff_attendance (
      id TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'present',
      check_in TEXT,
      check_out TEXT,
      FOREIGN KEY (staff_id) REFERENCES staff_records(id) ON DELETE CASCADE,
      UNIQUE(staff_id, date)
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)

  seedDefaultAdmin(db)
  seedStaffDemoUser(db)
  seedTestCustomer(db)
  seedProducts(db)
  seedStaffRecords(db)
  migrateSchema(db)
  ensureDailyAbsences(new Date().toISOString().slice(0, 10))
}

function migrateSchema(db: Database.Database) {
  let userCols = db.prepare('PRAGMA table_info(users)').all() as { name: string }[]
  if (!userCols.some((c) => c.name === 'permissions')) {
    db.exec('ALTER TABLE users ADD COLUMN permissions TEXT')
  }
  userCols = db.prepare('PRAGMA table_info(users)').all() as { name: string }[]
  if (!userCols.some((c) => c.name === 'addresses')) {
    db.exec('ALTER TABLE users ADD COLUMN addresses TEXT')
  }
  userCols = db.prepare('PRAGMA table_info(users)').all() as { name: string }[]
  if (!userCols.some((c) => c.name === 'access_locked')) {
    db.exec('ALTER TABLE users ADD COLUMN access_locked INTEGER NOT NULL DEFAULT 0')
  }

  let orderCols = db.prepare('PRAGMA table_info(orders)').all() as { name: string }[]
  if (!orderCols.some((c) => c.name === 'returned_qty')) {
    db.exec('ALTER TABLE orders ADD COLUMN returned_qty INTEGER NOT NULL DEFAULT 0')
  }
  orderCols = db.prepare('PRAGMA table_info(orders)').all() as { name: string }[]
  if (!orderCols.some((c) => c.name === 'warranty_claim_qty')) {
    db.exec('ALTER TABLE orders ADD COLUMN warranty_claim_qty INTEGER NOT NULL DEFAULT 0')
  }

  const users = db.prepare('SELECT id, role, permissions FROM users').all() as {
    id: string
    role: string
    permissions: string | null
  }[]

  const update = db.prepare('UPDATE users SET permissions = ? WHERE id = ?')
  for (const u of users) {
    if (!u.permissions) {
      const perms = parsePermissions(null, u.role as User['role'])
      if (perms) update.run(JSON.stringify(perms), u.id)
    }
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS bulk_order_confirmations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      items TEXT NOT NULL,
      total REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'confirmed',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      order_id TEXT,
      rating INTEGER NOT NULL,
      title TEXT NOT NULL,
      comment TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      customer_name TEXT,
      total REAL NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      payment_method TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      read_at TEXT
    );

    CREATE TABLE IF NOT EXISTS warranty_claims (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      notes TEXT NOT NULL,
      document_path TEXT NOT NULL,
      document_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS return_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      reason TEXT NOT NULL,
      document_path TEXT NOT NULL,
      document_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      sender TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      read_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ticket_email_verifications (
      email TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `)

  const contactCols = db.prepare('PRAGMA table_info(contact_messages)').all() as { name: string }[]
  if (contactCols.length > 0 && !contactCols.some((c) => c.name === 'read_at')) {
    db.exec('ALTER TABLE contact_messages ADD COLUMN read_at TEXT')
  }

  const bulkCols = db.prepare('PRAGMA table_info(bulk_order_confirmations)').all() as { name: string }[]
  if (!bulkCols.some((c) => c.name === 'order_id')) {
    db.exec('ALTER TABLE bulk_order_confirmations ADD COLUMN order_id TEXT')
  }

  backfillInvoices(db)
  backfillProductManufacturingIds(db)
  backfillProductModelIds(db)

  seedMainTemplate(db)
}

type LegacyProduct = Product & { sku?: string }

function normalizeProduct(product: LegacyProduct): Product {
  const modelId = (product.modelId ?? product.sku ?? '').trim()
  const { sku: _legacySku, ...rest } = product
  return { ...rest, modelId }
}

function backfillProductModelIds(db: Database.Database) {
  const rows = db.prepare('SELECT id, data FROM products').all() as { id: string; data: string }[]
  const update = db.prepare('UPDATE products SET data = ? WHERE id = ?')

  for (const row of rows) {
    const raw = JSON.parse(row.data) as LegacyProduct
    if (!raw.sku && raw.modelId?.trim()) continue

    const normalized = normalizeProduct(raw)
    update.run(JSON.stringify(normalized), row.id)
  }
}

function backfillProductManufacturingIds(db: Database.Database) {
  const rows = db.prepare('SELECT id, data FROM products').all() as { id: string; data: string }[]
  const update = db.prepare('UPDATE products SET data = ? WHERE id = ?')

  for (const row of rows) {
    const product = normalizeProduct(JSON.parse(row.data) as LegacyProduct)
    if (product.manufacturingId?.trim()) continue

    const manufacturingId = product.modelId
      ? product.modelId.replace(/^HDS-/i, 'MFG-')
      : `MFG-${product.id}`

    update.run(JSON.stringify({ ...product, manufacturingId }), row.id)
  }
}

function invoiceIdFromOrderId(orderId: string): string {
  return orderId.startsWith('ORD-') ? `INV-${orderId.slice(4)}` : `INV-${orderId}`
}

function backfillInvoices(db: Database.Database) {
  const orders = db
    .prepare(
      `SELECT o.id, o.user_id, o.total, o.payment_status, o.payment_method, o.created_at, u.name AS customer_name
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id`
    )
    .all() as {
    id: string
    user_id: string
    total: number
    payment_status: string
    payment_method: string | null
    created_at: string
    customer_name: string | null
  }[]

  const insert = db.prepare(
    `INSERT OR IGNORE INTO invoices (id, order_id, user_id, customer_name, total, payment_status, payment_method, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )

  for (const order of orders) {
    insert.run(
      invoiceIdFromOrderId(order.id),
      order.id,
      order.user_id,
      order.customer_name,
      order.total,
      order.payment_status,
      order.payment_method,
      order.created_at
    )
  }
}

function seedMainTemplate(db: Database.Database) {
  const existing = db.prepare('SELECT key FROM site_settings WHERE key = ?').get('main_template')
  if (existing) return

  db.prepare('INSERT INTO site_settings (key, data, updated_at) VALUES (?, ?, ?)').run(
    'main_template',
    JSON.stringify(DEFAULT_MAIN_TEMPLATE),
    new Date().toISOString()
  )
}

function seedTestCustomer(db: Database.Database) {
  const existing = db.prepare('SELECT id, name FROM users WHERE username = ?').get('test') as
    | { id: string; name: string }
    | undefined
  if (existing) {
    if (/customer$/i.test(existing.name.trim())) {
      db.prepare('UPDATE users SET name = ? WHERE username = ?').run(
        existing.name.replace(/\s+customer$/i, '').trim() || existing.name,
        'test'
      )
    }
    return
  }

  const hash = bcrypt.hashSync('test', 10)
  db.prepare(
    `INSERT INTO users (id, username, email, password_hash, name, role, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    'customer-test-001',
    'test',
    'test@hawking.com',
    hash,
    'Test',
    'customer',
    new Date().toISOString()
  )
}

function seedDefaultAdmin(db: Database.Database) {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('admin')
  if (existing) return

  const hash = bcrypt.hashSync('admin', 10)
  db.prepare(
    `INSERT INTO users (id, username, email, password_hash, name, role, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    'admin-001',
    'admin',
    'admin@hawking.com',
    hash,
    'System Administrator',
    'admin',
    new Date().toISOString()
  )
}

function seedStaffDemoUser(db: Database.Database) {
  const staffUserId = 'staff-user-001'
  let userId = staffUserId

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('staff') as
    | { id: string }
    | undefined

  if (existing) {
    userId = existing.id
  } else {
    const hash = bcrypt.hashSync('staff', 10)
    const now = new Date().toISOString()
    db.prepare(
      `INSERT INTO users (id, username, email, password_hash, name, role, permissions, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      staffUserId,
      'staff',
      'staff@hawking.com',
      hash,
      'Ravi Kumar',
      'staff',
      JSON.stringify(permissionsForRole('staff')),
      now
    )
  }

  db.prepare("UPDATE staff_records SET user_id = ? WHERE id = 'staff-001'").run(userId)
}

function seedProducts(db: Database.Database) {
  const count = db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number }
  if (count.c > 0) return

  const insert = db.prepare(
    'INSERT INTO products (id, data, stock, updated_at) VALUES (?, ?, ?, ?)'
  )
  const now = new Date().toISOString()

  for (const product of PRODUCTS) {
    const withStock = { ...product, stock: product.inStock ? 50 : 0 }
    insert.run(product.id, JSON.stringify(withStock), withStock.stock, now)
  }
}

export type DbUser = {
  id: string
  username: string
  email: string
  password_hash: string
  name: string
  role: User['role']
  phone: string | null
  permissions: string | null
  addresses: string | null
  access_locked?: number | null
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
  }
}

export function getAllProducts(): Product[] {
  const db = getDb()
  const rows = db.prepare('SELECT id, data, stock FROM products ORDER BY id').all() as {
    id: string
    data: string
    stock: number
  }[]

  return rows.map((row) => {
    const product = normalizeProduct(JSON.parse(row.data) as LegacyProduct)
    return {
      ...product,
      stock: row.stock,
      inStock: row.stock > 0,
    }
  })
}

export function getProductById(id: string): Product | null {
  const db = getDb()
  const row = db.prepare('SELECT data, stock FROM products WHERE id = ?').get(id) as
    | { data: string; stock: number }
    | undefined
  if (!row) return null
  const product = normalizeProduct(JSON.parse(row.data) as LegacyProduct)
  return { ...product, stock: row.stock, inStock: row.stock > 0 }
}

function seedStaffRecords(db: Database.Database) {
  const count = db.prepare('SELECT COUNT(*) as c FROM staff_records').get() as { c: number }
  if (count.c > 0) return

  const now = new Date().toISOString()

  db.prepare(
    `INSERT INTO staff_records (id, employee_name, aadhaar_number, address, contact_number,
      alternate_contact_number, alternate_contact_person, bank_account_number, bank_name, bank_ifsc,
      pan_card, passport_photo, joining_date, work_status, blood_group, medical_history, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
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
    now
  )

  db.prepare(
    `INSERT INTO staff_records (id, employee_name, aadhaar_number, address, contact_number,
      alternate_contact_number, alternate_contact_person, bank_account_number, bank_name, bank_ifsc,
      pan_card, passport_photo, joining_date, work_status, blood_group, medical_history, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
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
    now
  )
}
