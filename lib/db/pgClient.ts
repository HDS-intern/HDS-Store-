import { Pool, type PoolClient, type QueryResultRow } from 'pg'

let pool: Pool | null = null

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env.local and start PostgreSQL (npm run db:up).'
    )
  }
  return url
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      max: 20,
    })
  }
  return pool
}

export function convertPlaceholders(sql: string): string {
  let index = 0
  return sql.replace(/\?/g, () => {
    index += 1
    return `$${index}`
  })
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await getPool().query<T>(convertPlaceholders(sql), params)
  return result.rows
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T | undefined> {
  const rows = await query<T>(sql, params)
  return rows[0]
}

export async function execute(sql: string, params: unknown[] = []): Promise<void> {
  await getPool().query(convertPlaceholders(sql), params)
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
