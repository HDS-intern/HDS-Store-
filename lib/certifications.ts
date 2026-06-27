import { queryOne, execute } from './db'

export type SiteCertification = {
  id: string
  type: string
  logoUrl: string
  imageUrl: string
  productId: string
  productName: string
  createdAt: string
}

const SETTING_KEY = 'site_certifications'

export async function getCertifications(): Promise<SiteCertification[]> {
  const row = await queryOne<{ data: string }>(
    'SELECT data FROM site_settings WHERE key = ?',
    [SETTING_KEY]
  )

  if (!row) return []

  try {
    const parsed = JSON.parse(row.data) as SiteCertification[]
    if (!Array.isArray(parsed)) return []
    return parsed.map((cert) => ({
      ...cert,
      productId: cert.productId ?? '',
      productName: cert.productName ?? '',
    }))
  } catch {
    return []
  }
}

export async function saveCertifications(certifications: SiteCertification[]): Promise<void> {
  const now = new Date().toISOString()
  await execute(
    `INSERT INTO site_settings (key, data, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    [SETTING_KEY, JSON.stringify(certifications), now]
  )
}

export async function addCertification(
  input: Omit<SiteCertification, 'id' | 'createdAt'>
): Promise<SiteCertification> {
  const certifications = await getCertifications()
  const entry: SiteCertification = {
    id: `cert-${Date.now()}`,
    type: input.type.trim(),
    logoUrl: input.logoUrl,
    imageUrl: input.imageUrl,
    productId: input.productId.trim(),
    productName: input.productName.trim(),
    createdAt: new Date().toISOString(),
  }
  await saveCertifications([entry, ...certifications])
  return entry
}

export async function deleteCertification(id: string): Promise<boolean> {
  const certifications = await getCertifications()
  const next = certifications.filter((c) => c.id !== id)
  if (next.length === certifications.length) return false
  await saveCertifications(next)
  return true
}
