import type { AnimatedFormSelectOption } from '@/components/admin/AnimatedFormSelect'
import type { CertificationTypeRecord } from '@/lib/certificationTypes'

export const CREATE_CERT_VALUE = '__create_cert_type__'

export function buildCertificationTypeOptions(
  types: CertificationTypeRecord[]
): AnimatedFormSelectOption[] {
  const unique = types.filter(Boolean)
  return [
    { value: '', label: 'Select type', tone: 'default' },
    ...unique.map((item) => ({
      value: item.type,
      label: item.type,
      tone: 'default' as const,
    })),
    { value: CREATE_CERT_VALUE, label: 'Create certification type', tone: 'default' },
  ]
}
