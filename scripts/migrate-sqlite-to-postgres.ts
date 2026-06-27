/**
 * Optional one-time migration from SQLite (data/hds.db) to PostgreSQL.
 * Requires: npm install better-sqlite3 (dev) and a running Postgres with DATABASE_URL set.
 *
 * Usage: npx tsx scripts/migrate-sqlite-to-postgres.ts
 */
import fs from 'fs'
import path from 'path'
import { Pool } from 'pg'

const SQLITE_PATH = path.join(process.cwd(), 'data', 'hds.db')

const TABLES = [
  'users',
  'sessions',
  'products',
  'orders',
  'staff_records',
  'staff_attendance',
  'password_reset_tokens',
  'bulk_order_confirmations',
  'reviews',
  'site_settings',
  'invoices',
  'contact_messages',
  'warranty_claims',
  'return_requests',
  'chat_messages',
  'ticket_email_verifications',
] as const

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required')
  }
  if (!fs.existsSync(SQLITE_PATH)) {
    throw new Error(`SQLite database not found at ${SQLITE_PATH}`)
  }

  const Database = (await import('better-sqlite3')).default
  const sqlite = new Database(SQLITE_PATH, { readonly: true })
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  const schema = fs.readFileSync(path.join(process.cwd(), 'lib', 'db', 'schema.sql'), 'utf-8')
  await pool.query(schema)

  for (const table of TABLES) {
    const rows = sqlite.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[]
    if (rows.length === 0) continue

    const columns = Object.keys(rows[0])
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`

    for (const row of rows) {
      const values = columns.map((col) => row[col])
      try {
        await pool.query(sql, values)
      } catch (error) {
        console.warn(`Skipped row in ${table}:`, error)
      }
    }

    console.log(`Migrated ${rows.length} rows from ${table}`)
  }

  await pool.end()
  sqlite.close()
  console.log('Migration complete.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
