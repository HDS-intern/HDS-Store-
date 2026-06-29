/**
 * Create all PostgreSQL tables and seed default data for the HDS Store website.
 *
 * Usage:
 *   npm run db:init
 *
 * Requires DATABASE_URL in .env.local and a running PostgreSQL instance.
 */
import fs from 'fs'
import path from 'path'
import { ensureDatabase, query } from '../lib/db'

function loadEnvLocal(): void {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return

  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (key && process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

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

async function main(): Promise<void> {
  loadEnvLocal()

  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local first.')
  }

  console.log('Initializing PostgreSQL database...')
  await ensureDatabase()

  console.log('\nTables:')
  for (const table of TABLES) {
    const row = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ${table}`
    )
    console.log(`  ${table.padEnd(28)} ${row[0]?.count ?? '0'} rows`)
  }

  const users = await query<{ username: string; role: string }>(
    "SELECT username, role FROM users ORDER BY role, username"
  )

  console.log('\nLogin accounts (JWT):')
  for (const user of users) {
    console.log(`  ${user.role.padEnd(10)} ${user.username}`)
  }

  console.log('\nDatabase ready.')
}

main().catch((error) => {
  console.error('Database init failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
