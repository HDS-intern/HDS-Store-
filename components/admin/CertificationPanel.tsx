'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Plus, Trash2, X } from 'lucide-react'
import { AdminSlideUp } from '@/components/admin/AdminSlideUp'
import { apiFetch, getStoredToken } from '@/lib/api'
import type { SiteCertification } from '@/lib/certifications'
import type { Product } from '@/lib/types'
import { CertificationAssetViewModal, type CertificationAssetPreview } from '@/components/admin/CertificationAssetViewModal'
import styles from './CertificationPanel.module.css'

type CertificationCreateModalProps = {
  onClose: () => void
  onCreated: () => void
  onError: (message: string) => void
}

async function uploadCertificationFile(file: File, kind: 'logo' | 'document'): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('kind', kind)
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

function CertificationCreateModal({ onClose, onCreated, onError }: CertificationCreateModalProps) {
  const [type, setType] = useState('')
  const [productId, setProductId] = useState('')
  const [productName, setProductName] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [logoUrl, setLogoUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [logoName, setLogoName] = useState('')
  const [imageName, setImageName] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [saving, setSaving] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    apiFetch<{ products: Product[] }>('/api/admin/products')
      .then((data) => setProducts(Array.isArray(data.products) ? data.products : []))
      .catch(() => setProducts([]))
  }, [])

  const handleProductChange = (id: string) => {
    setProductId(id)
    const product = products.find((item) => item.id === id)
    setProductName(product?.name ?? '')
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    try {
      const url = await uploadCertificationFile(file, 'logo')
      setLogoUrl(url)
      setLogoName(file.name)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Logo upload failed')
    } finally {
      e.target.value = ''
      setUploadingLogo(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
    try {
      const url = await uploadCertificationFile(file, 'document')
      setImageUrl(url)
      setImageName(file.name)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Certification image upload failed')
    } finally {
      e.target.value = ''
      setUploadingImage(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!type.trim()) {
      onError('Certification type is required')
      return
    }
    if (!productId.trim()) {
      onError('Product ID is required')
      return
    }
    if (!productName.trim()) {
      onError('Product name is required')
      return
    }
    if (!logoUrl) {
      onError('Please upload a certification logo')
      return
    }
    if (!imageUrl) {
      onError('Please upload a certification image')
      return
    }

    setSaving(true)
    try {
      await apiFetch('/api/admin/certifications', {
        method: 'POST',
        body: JSON.stringify({ type: type.trim(), logoUrl, imageUrl, productId, productName }),
      })
      onCreated()
      onClose()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to create certification')
    } finally {
      setSaving(false)
    }
  }

  const imageIsPdf = imageUrl.toLowerCase().endsWith('.pdf')

  return (
    <div
      className={`${styles.modalBackdrop} ${styles.modalBackdropEnter}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-certification-title"
      onClick={onClose}
    >
      <div className={`${styles.modal} ${styles.modalEnter}`} onClick={(e) => e.stopPropagation()}>
        <AdminSlideUp forceAnimate delayMs={0}>
          <div className={styles.modalHeader}>
            <h2 id="create-certification-title" className={styles.modalTitle}>
              Create New Certification
            </h2>
            <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </AdminSlideUp>

        <form onSubmit={handleSubmit}>
          <AdminSlideUp forceAnimate delayMs={60}>
            <div className={styles.tableWrap}>
              <table className={styles.formTable}>
                <tbody>
                  <tr>
                    <th>Certification type</th>
                    <td>
                      <input
                        className={styles.formInput}
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        placeholder="e.g. ISO 9001, CE Mark"
                        required
                      />
                    </td>
                  </tr>
                  <tr>
                    <th>Product</th>
                    <td>
                      <select
                        className={`hds-select-dark ${styles.formSelect}`}
                        value={productId}
                        onChange={(e) => handleProductChange(e.target.value)}
                        required
                      >
                        <option value="">Select a product</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} ({product.modelId})
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <th>Product ID</th>
                    <td>
                      <input
                        className={styles.formInput}
                        value={productId}
                        readOnly
                        placeholder="Auto-filled from product selection"
                      />
                    </td>
                  </tr>
                  <tr>
                    <th>Product name</th>
                    <td>
                      <input
                        className={styles.formInput}
                        value={productName}
                        readOnly
                        placeholder="Auto-filled from product selection"
                      />
                    </td>
                  </tr>
                  <tr>
                    <th>Upload certification logo</th>
                    <td>
                      <div className={styles.uploadRow}>
                        <div className={styles.uploadControls}>
                          <p className={styles.fieldHint}>Accepted formats: JPG, PNG</p>
                          <div className={styles.uploadCell}>
                            <button
                              type="button"
                              className={styles.uploadBtn}
                              onClick={() => logoInputRef.current?.click()}
                              disabled={uploadingLogo}
                            >
                              {uploadingLogo ? 'Uploading...' : logoUrl ? 'Replace logo' : 'Choose logo'}
                            </button>
                            {logoName && <span className={styles.fileName}>{logoName}</span>}
                          </div>
                        </div>
                        {logoUrl && (
                          <div className={styles.logoPreview}>
                            <Image
                              src={logoUrl}
                              alt="Certification logo preview"
                              width={80}
                              height={80}
                              className={styles.logoPreviewImg}
                              unoptimized
                            />
                          </div>
                        )}
                      </div>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                        className={styles.hiddenInput}
                        onChange={handleLogoUpload}
                      />
                    </td>
                  </tr>
                  <tr>
                    <th>Certification image</th>
                    <td>
                      <div className={styles.uploadRow}>
                        <div className={styles.uploadControls}>
                          <p className={styles.fieldHint}>Accepted formats: PDF, JPG, PNG</p>
                          <div className={styles.uploadCell}>
                            <button
                              type="button"
                              className={styles.uploadBtn}
                              onClick={() => imageInputRef.current?.click()}
                              disabled={uploadingImage}
                            >
                              {uploadingImage
                                ? 'Uploading...'
                                : imageUrl
                                  ? 'Replace file'
                                  : 'Choose file'}
                            </button>
                            {imageName && <span className={styles.fileName}>{imageName}</span>}
                          </div>
                        </div>
                        {imageUrl && !imageIsPdf && (
                          <div className={styles.docPreview}>
                            <Image
                              src={imageUrl}
                              alt="Certification document preview"
                              width={120}
                              height={90}
                              className={styles.docPreviewImg}
                              unoptimized
                            />
                          </div>
                        )}
                        {imageUrl && imageIsPdf && (
                          <a
                            href={imageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.pdfPreviewLink}
                          >
                            View uploaded PDF
                          </a>
                        )}
                      </div>
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                        className={styles.hiddenInput}
                        onChange={handleImageUpload}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </AdminSlideUp>

          <AdminSlideUp forceAnimate delayMs={120}>
            <div className={styles.modalActions}>
              <button type="submit" className={styles.primaryBtn} disabled={saving || uploadingLogo || uploadingImage}>
                {saving ? 'Saving...' : 'Create Certification'}
              </button>
              <button type="button" className={styles.secondaryBtn} onClick={onClose}>
                Cancel
              </button>
            </div>
          </AdminSlideUp>
        </form>
      </div>
    </div>
  )
}

type CertificationPanelProps = {
  onMessage?: (message: string) => void
  onError?: (message: string) => void
}

export function CertificationPanel({ onMessage, onError }: CertificationPanelProps) {
  const [certifications, setCertifications] = useState<SiteCertification[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [assetPreview, setAssetPreview] = useState<CertificationAssetPreview | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiFetch<{ certifications: SiteCertification[] }>('/api/admin/certifications')
      setCertifications(Array.isArray(data.certifications) ? data.certifications : [])
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Failed to load certifications')
      setCertifications([])
    } finally {
      setLoading(false)
    }
  }, [onError])

  useEffect(() => {
    void load()
  }, [load])

  const handleDelete = async (id: string, label: string) => {
    if (!window.confirm(`Delete certification "${label}"?`)) return
    setDeletingId(id)
    try {
      await apiFetch(`/api/admin/certifications?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      onMessage?.('Certification deleted')
      await load()
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Failed to delete certification')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Certification</h1>
        <button type="button" className={styles.primaryBtn} onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 inline mr-1" />
          Create New Certification
        </button>
      </div>

      <p className={styles.pageHint}>
        Manage certification types, logos, and certification documents for your store.
      </p>

      {loading ? (
        <p className={styles.emptyText}>Loading certifications...</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.listTable}>
            <thead>
              <tr>
                <th>Certification type</th>
                <th>Product ID</th>
                <th>Product name</th>
                <th>Logo</th>
                <th>Certification image</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {certifications.map((cert) => {
                const productLabel = cert.productName
                  ? `${cert.productName}${cert.productId ? ` · ${cert.productId}` : ''}`
                  : cert.productId || undefined
                const imageIsPdf = cert.imageUrl.toLowerCase().endsWith('.pdf')

                return (
                <tr key={cert.id}>
                  <td>{cert.type}</td>
                  <td>{cert.productId || '—'}</td>
                  <td>{cert.productName || '—'}</td>
                  <td>
                    <div className={styles.mediaCell}>
                      <Image
                        src={cert.logoUrl}
                        alt={`${cert.type} logo`}
                        width={48}
                        height={48}
                        className={styles.listLogo}
                        unoptimized
                      />
                      <button
                        type="button"
                        className={styles.viewBtn}
                        onClick={() =>
                          setAssetPreview({
                            title: 'Certification Logo',
                            url: cert.logoUrl,
                            productLabel,
                          })
                        }
                      >
                        View
                      </button>
                    </div>
                  </td>
                  <td>
                    <div className={styles.mediaCell}>
                      {imageIsPdf ? (
                        <span className={styles.pdfBadge}>PDF</span>
                      ) : (
                        <Image
                          src={cert.imageUrl}
                          alt={`${cert.type} document`}
                          width={72}
                          height={54}
                          className={styles.listDoc}
                          unoptimized
                        />
                      )}
                      <button
                        type="button"
                        className={styles.viewBtn}
                        onClick={() =>
                          setAssetPreview({
                            title: 'Certification Image',
                            url: cert.imageUrl,
                            productLabel,
                          })
                        }
                      >
                        View
                      </button>
                    </div>
                  </td>
                  <td>{new Date(cert.createdAt).toLocaleDateString('en-IN')}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={() => void handleDelete(cert.id, cert.type)}
                      disabled={deletingId === cert.id}
                      aria-label={`Delete ${cert.type}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              )})}
              {certifications.length === 0 && (
                <tr>
                  <td colSpan={7} className={styles.emptyText}>
                    No certifications yet. Click &quot;Create New Certification&quot; to add one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {assetPreview && (
        <CertificationAssetViewModal asset={assetPreview} onClose={() => setAssetPreview(null)} />
      )}

      {showCreateModal && (
        <CertificationCreateModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            onMessage?.('Certification created successfully')
            void load()
          }}
          onError={(msg) => onError?.(msg)}
        />
      )}
    </>
  )
}
