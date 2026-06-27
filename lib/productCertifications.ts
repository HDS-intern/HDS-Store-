import type { Product, ProductCertification } from './types'

export type ProductCertDraftEntry = {
  id: string
  type: string
  logoUrl: string
  documentUrl: string
}

export function createEmptyCertDraftEntry(): ProductCertDraftEntry {
  return {
    id: `cert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: '',
    logoUrl: '',
    documentUrl: '',
  }
}

export function createInitialCertDraftEntries(): ProductCertDraftEntry[] {
  return [createEmptyCertDraftEntry()]
}

export function getProductCertifications(product: Product): ProductCertification[] {
  if (Array.isArray(product.certifications) && product.certifications.length > 0) {
    return product.certifications.filter((item) => item.type?.trim())
  }

  const legacyType = product.specs?.['Certification Type']?.trim()
  if (legacyType && legacyType !== '—') {
    return [{ type: legacyType, documentUrl: product.certificationImage }]
  }

  return []
}

export function certDraftEntriesToProductCertifications(
  entries: ProductCertDraftEntry[]
): ProductCertification[] {
  return entries
    .filter((entry) => entry.type.trim())
    .map((entry) => ({
      type: entry.type.trim(),
      documentUrl: entry.documentUrl || undefined,
    }))
}

export function ensureTrailingCertDraftSlot(entries: ProductCertDraftEntry[]): ProductCertDraftEntry[] {
  if (entries.length === 0) return createInitialCertDraftEntries()

  const last = entries[entries.length - 1]
  if (last.type.trim()) {
    return [...entries, createEmptyCertDraftEntry()]
  }

  return entries
}

export function syncCertDraftLogos(
  entries: ProductCertDraftEntry[],
  types: { type: string; logoUrl: string }[]
): ProductCertDraftEntry[] {
  return entries.map((entry) => {
    if (!entry.type) {
      return { ...entry, logoUrl: '' }
    }
    const match = types.find((item) => item.type === entry.type)
    if (!match) {
      return { ...entry, type: '', logoUrl: '', documentUrl: '' }
    }
    return { ...entry, logoUrl: match.logoUrl }
  })
}

export function certificationTypesLabel(certifications: ProductCertification[]): string {
  if (certifications.length === 0) return '—'
  return certifications.map((item) => item.type).join(', ')
}
