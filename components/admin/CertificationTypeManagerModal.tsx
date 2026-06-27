'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ImageIcon, X } from 'lucide-react'
import { apiFetch, getStoredToken } from '@/lib/api'
import type { CertificationTypeRecord } from '@/lib/certificationTypes'
import styles from './CertificationTypeManagerModal.module.css'

type CertificationTypeManagerModalProps = {
  open: boolean
  meta?: string
  onClose: () => void
  onUseType: (type: string, logoUrl: string) => void
  onTypesUpdated: (types: CertificationTypeRecord[]) => void
}

async function uploadCertificationLogo(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('kind', 'logo')
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

export function CertificationTypeManagerModal({
  open,
  meta,
  onClose,
  onUseType,
  onTypesUpdated,
}: CertificationTypeManagerModalProps) {
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [types, setTypes] = useState<CertificationTypeRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [typeName, setTypeName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const resetForm = () => {
    setEditingId(null)
    setTypeName('')
    setLogoUrl('')
    setError('')
  }

  const syncTypes = (next: CertificationTypeRecord[]) => {
    setTypes(next)
    onTypesUpdated(next)
  }

  const loadTypes = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiFetch<{ certificationTypes: CertificationTypeRecord[] }>(
        '/api/admin/certification-types'
      )
      const next = Array.isArray(data.certificationTypes) ? data.certificationTypes : []
      syncTypes(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load certification types')
      syncTypes([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    resetForm()
    void loadTypes()
  }, [open])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const url = await uploadCertificationLogo(file)
      setLogoUrl(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logo upload failed')
    } finally {
      e.target.value = ''
      setUploading(false)
    }
  }

  const saveType = async () => {
    const name = typeName.trim()
    if (!name) {
      setError('Certification type name is required')
      return
    }
    if (!logoUrl) {
      setError('Certification logo is required')
      return
    }

    setSaving(true)
    setError('')
    try {
      if (editingId) {
        await apiFetch('/api/admin/certification-types', {
          method: 'PUT',
          body: JSON.stringify({ id: editingId, type: name, logoUrl }),
        })
      } else {
        await apiFetch('/api/admin/certification-types', {
          method: 'POST',
          body: JSON.stringify({ type: name, logoUrl }),
        })
      }
      await loadTypes()
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save certification type')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (item: CertificationTypeRecord) => {
    setEditingId(item.id)
    setTypeName(item.type)
    setLogoUrl(item.logoUrl)
    setError('')
  }

  const deleteType = async (item: CertificationTypeRecord) => {
    if (!window.confirm(`Delete certification type "${item.type}"?`)) return
    setError('')
    try {
      await apiFetch(`/api/admin/certification-types?id=${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
      })
      if (editingId === item.id) resetForm()
      await loadTypes()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete certification type')
    }
  }

  const useType = (item: CertificationTypeRecord) => {
    onUseType(item.type, item.logoUrl)
    onClose()
  }

  if (!open) return null

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cert-type-manager-title"
      onClick={onClose}
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h3 id="cert-type-manager-title" className={styles.title}>
              Manage certification types
            </h3>
            {meta && <p className={styles.meta}>{meta}</p>}
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={styles.body}>
          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.formTableWrap}>
            <table className={styles.formTable}>
              <thead>
                <tr>
                  <th>Certification type</th>
                  <th>Logo upload</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <input
                      className={styles.inputInline}
                      value={typeName}
                      onChange={(e) => setTypeName(e.target.value)}
                      placeholder="Enter certification type name"
                      autoFocus
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`${styles.logoBtn} ${logoUrl ? styles.logoBtnFilled : ''}`}
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {logoUrl ? (
                        <>
                          <Image
                            src={logoUrl}
                            alt=""
                            width={36}
                            height={36}
                            className={styles.logoPreview}
                            unoptimized
                          />
                          <span>{uploading ? 'Uploading...' : 'Change logo'}</span>
                        </>
                      ) : (
                        <>
                          <ImageIcon className="w-5 h-5" />
                          <span>{uploading ? 'Uploading...' : 'Upload logo'}</span>
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className={styles.formActions}>
            {editingId && (
              <button type="button" className={styles.cancelEditBtn} onClick={resetForm}>
                Cancel edit
              </button>
            )}
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => void saveType()}
              disabled={saving || uploading || !typeName.trim() || !logoUrl}
            >
              {saving ? 'Saving...' : editingId ? 'Update type' : 'Add type'}
            </button>
          </div>

          <h4 className={styles.listTitle}>Existing certification types</h4>
          <div className={styles.listWrap}>
            {loading ? (
              <p className={styles.empty}>Loading certification types...</p>
            ) : (
              <table className={styles.listTable}>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Logo</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {types.map((item) => (
                    <tr key={item.id}>
                      <td>{item.type}</td>
                      <td>
                        <Image
                          src={item.logoUrl}
                          alt={`${item.type} logo`}
                          width={40}
                          height={40}
                          className={styles.listLogo}
                          unoptimized
                        />
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          <button type="button" className={styles.useBtn} onClick={() => useType(item)}>
                            Use
                          </button>
                          <button type="button" className={styles.editBtn} onClick={() => startEdit(item)}>
                            Edit
                          </button>
                          <button type="button" className={styles.deleteBtn} onClick={() => void deleteType(item)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {types.length === 0 && (
                    <tr>
                      <td colSpan={3} className={styles.empty}>
                        No certification types yet. Add one above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.primaryBtn} onClick={onClose}>
            Done
          </button>
        </div>

        <input
          ref={logoInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          className={styles.hiddenInput}
          onChange={handleLogoUpload}
        />
      </div>
    </div>
  )
}
