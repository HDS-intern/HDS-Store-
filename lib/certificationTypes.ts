import { queryOne, execute } from './db'

export type CertificationTypeRecord = {
  id: string
  type: string
  logoUrl: string
  createdAt: string
}

const SETTING_KEY = 'certification_types'

export async function getCertificationTypes(): Promise<CertificationTypeRecord[]> {
  const row = await queryOne<{ data: string }>(
    'SELECT data FROM site_settings WHERE key = ?',
    [SETTING_KEY]
  )

  if (!row) return []

  try {
    const parsed = JSON.parse(row.data) as CertificationTypeRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function saveCertificationTypes(types: CertificationTypeRecord[]): Promise<void> {
  const now = new Date().toISOString()
  await execute(
    `INSERT INTO site_settings (key, data, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    [SETTING_KEY, JSON.stringify(types), now]
  )
}

export async function addCertificationType(input: {
  type: string
  logoUrl: string
}): Promise<CertificationTypeRecord> {
  const types = await getCertificationTypes()
  const typeName = input.type.trim()
  if (types.some((item) => item.type.toLowerCase() === typeName.toLowerCase())) {
    throw new Error('Certification type already exists')
  }
  const entry: CertificationTypeRecord = {
    id: `ctype-${Date.now()}`,
    type: typeName,
    logoUrl: input.logoUrl.trim(),
    createdAt: new Date().toISOString(),
  }
  await saveCertificationTypes([entry, ...types])
  return entry
}

export async function updateCertificationType(
  id: string,
  input: { type: string; logoUrl: string }
): Promise<CertificationTypeRecord | null> {
  const types = await getCertificationTypes()
  const index = types.findIndex((item) => item.id === id)
  if (index === -1) return null

  const typeName = input.type.trim()
  const duplicate = types.some(
    (item) => item.id !== id && item.type.toLowerCase() === typeName.toLowerCase()
  )
  if (duplicate) {
    throw new Error('Certification type already exists')
  }

  const updated: CertificationTypeRecord = {
    ...types[index],
    type: typeName,
    logoUrl: input.logoUrl.trim(),
  }
  types[index] = updated
  await saveCertificationTypes(types)
  return updated
}

export async function deleteCertificationType(id: string): Promise<boolean> {
  const types = await getCertificationTypes()
  const next = types.filter((item) => item.id !== id)
  if (next.length === types.length) return false
  await saveCertificationTypes(next)
  return true
}
