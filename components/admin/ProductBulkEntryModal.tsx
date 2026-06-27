'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { X, Plus, Trash2, ImageIcon } from 'lucide-react'
import { AnimatedFormSelect } from '@/components/admin/AnimatedFormSelect'
import { CertificationTypeManagerModal } from '@/components/admin/CertificationTypeManagerModal'
import { apiFetch } from '@/lib/api'
import type { CertificationTypeRecord } from '@/lib/certificationTypes'
import {
  buildCertificationTypeOptions,
  CREATE_CERT_VALUE,
} from '@/lib/certificationTypeOptions'
import {
  createEmptyCertDraftEntry,
  createInitialCertDraftEntries,
  ensureTrailingCertDraftSlot,
  syncCertDraftLogos,
  type ProductCertDraftEntry,
} from '@/lib/productCertifications'
import { syncPricingFields, type PricingField } from '@/lib/productPricing'
import { applySequentialAutoIds } from '@/lib/productIdGenerator'
import styles from './ProductBulkEntryModal.module.css'

export type ProductDraftRow = {
  id: string
  modelId: string
  manufacturingId: string
  stock: string
  minStockQty: string
  basePrice: string
  mrp: string
  discount: string
  finalPrice: string
  name: string
  specification: string
  certifications: ProductCertDraftEntry[]
}

export function createEmptyProductDraftRow(): ProductDraftRow {
  return {
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    modelId: '',
    manufacturingId: '',
    stock: '0',
    minStockQty: '0',
    basePrice: '0',
    mrp: '0',
    discount: '0',
    finalPrice: '0',
    name: '',
    specification: '',
    certifications: createInitialCertDraftEntries(),
  }
}

type ProductBulkEntryModalProps = {
  rows: ProductDraftRow[]
  saving: boolean
  certDocumentUploading: boolean
  onRowsChange: (rows: ProductDraftRow[]) => void
  onCertDocumentUpload: (rowId: string, certEntryId: string, file: File) => Promise<void>
  onSave: () => void
  onClose: () => void
}

export function ProductBulkEntryModal({
  rows,
  saving,
  certDocumentUploading,
  onRowsChange,
  onCertDocumentUpload,
  onSave,
  onClose,
}: ProductBulkEntryModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadTargetRef = useRef<{ rowId: string; certEntryId: string } | null>(null)
  const [autoIdEnabled, setAutoIdEnabled] = useState(false)
  const [noteRowId, setNoteRowId] = useState<string | null>(null)
  const [createCertTarget, setCreateCertTarget] = useState<{
    rowId: string
    certEntryId: string
  } | null>(null)
  const [certTypes, setCertTypes] = useState<CertificationTypeRecord[]>([])
  const [certOptions, setCertOptions] = useState(() => buildCertificationTypeOptions([]))

  const noteRow = noteRowId ? rows.find((row) => row.id === noteRowId) : null
  const createCertRow = createCertTarget
    ? rows.find((row) => row.id === createCertTarget.rowId)
    : null

  const getCertOptionsForEntry = (row: ProductDraftRow, certEntryId: string) => {
    const current = row.certifications.find((entry) => entry.id === certEntryId)?.type ?? ''
    const used = new Set(
      row.certifications
        .filter((entry) => entry.id !== certEntryId && entry.type)
        .map((entry) => entry.type)
    )

    return certOptions.filter(
      (option) =>
        option.value === CREATE_CERT_VALUE ||
        option.value === '' ||
        option.value === current ||
        !used.has(option.value)
    )
  }

  const syncCertOptions = (types: CertificationTypeRecord[]) => {
    setCertTypes(types)
    setCertOptions(buildCertificationTypeOptions(types))
  }

  const loadCertificationTypes = async () => {
    try {
      const data = await apiFetch<{ certificationTypes: CertificationTypeRecord[] }>(
        '/api/admin/certification-types'
      )
      syncCertOptions(Array.isArray(data.certificationTypes) ? data.certificationTypes : [])
    } catch {
      syncCertOptions([])
    }
  }

  useEffect(() => {
    void loadCertificationTypes()
  }, [])

  const updateRow = (id: string, patch: Partial<ProductDraftRow>) => {
    onRowsChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const updatePricing = (id: string, source: PricingField, field: PricingField, raw: string) => {
    if (raw !== '' && !/^\d+$/.test(raw)) return
    const row = rows.find((r) => r.id === id)
    if (!row) return
    const next = syncPricingFields(
      source,
      field === 'max' ? raw : row.mrp,
      field === 'discount' ? raw : row.discount,
      field === 'sale' ? raw : row.finalPrice
    )
    updateRow(id, {
      mrp: next.max,
      discount: next.discount,
      finalPrice: next.sale,
    })
  }

  const updateNumericField = (id: string, key: keyof ProductDraftRow, raw: string) => {
    if (raw === '' || /^\d+$/.test(raw)) updateRow(id, { [key]: raw })
  }

  const handleAutoToggle = (checked: boolean) => {
    setAutoIdEnabled(checked)
    if (checked) {
      onRowsChange(applySequentialAutoIds(rows))
    }
  }

  const updateRowCertifications = (rowId: string, certifications: ProductCertDraftEntry[]) => {
    updateRow(rowId, { certifications: ensureTrailingCertDraftSlot(certifications) })
  }

  const openCertTypeManager = (rowId: string, certEntryId: string) => {
    setCreateCertTarget({ rowId, certEntryId })
  }

  const closeCertTypeManager = () => {
    setCreateCertTarget(null)
  }

  const handleCertTypeChange = (rowId: string, certEntryId: string, value: string) => {
    if (value === CREATE_CERT_VALUE) {
      openCertTypeManager(rowId, certEntryId)
      return
    }

    const row = rows.find((item) => item.id === rowId)
    if (!row) return

    const match = certTypes.find((item) => item.type === value)
    const nextCertifications = row.certifications.map((entry) =>
      entry.id === certEntryId
        ? {
            ...entry,
            type: value,
            logoUrl: match?.logoUrl ?? '',
            documentUrl: value ? entry.documentUrl : '',
          }
        : entry
    )

    updateRowCertifications(rowId, nextCertifications)
  }

  const handleCertTypesUpdated = (types: CertificationTypeRecord[]) => {
    syncCertOptions(types)
    onRowsChange(
      rows.map((row) => ({
        ...row,
        certifications: ensureTrailingCertDraftSlot(syncCertDraftLogos(row.certifications, types)),
      }))
    )
  }

  const applyCertTypeToRow = (type: string, logoUrl: string) => {
    if (!createCertTarget) return
    const row = rows.find((item) => item.id === createCertTarget.rowId)
    if (!row) return

    const nextCertifications = row.certifications.map((entry) =>
      entry.id === createCertTarget.certEntryId
        ? { ...entry, type, logoUrl, documentUrl: entry.documentUrl }
        : entry
    )

    updateRowCertifications(createCertTarget.rowId, nextCertifications)
  }

  const handleRemoveCertification = (
    rowId: string,
    certEntryId: string,
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const row = rows.find((item) => item.id === rowId)
    if (!row || row.certifications.length < 2) return

    const nextCertifications = row.certifications.filter((entry) => entry.id !== certEntryId)
    updateRow(rowId, {
      certifications:
        nextCertifications.length > 0 ? nextCertifications : [createEmptyCertDraftEntry()],
    })

    if (createCertTarget?.rowId === rowId && createCertTarget.certEntryId === certEntryId) {
      setCreateCertTarget(null)
    }
  }

  const addRow = () => {
    const next = [...rows, createEmptyProductDraftRow()]
    onRowsChange(autoIdEnabled ? applySequentialAutoIds(next) : next)
  }

  const removeRow = (id: string) => {
    if (rows.length <= 1) return
    const next = rows.filter((row) => row.id !== id)
    onRowsChange(autoIdEnabled ? applySequentialAutoIds(next) : next)
  }

  const triggerCertDocumentUpload = (rowId: string, certEntryId: string) => {
    uploadTargetRef.current = { rowId, certEntryId }
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const target = uploadTargetRef.current
    if (!file || !target) return
    await onCertDocumentUpload(target.rowId, target.certEntryId, file)
    e.target.value = ''
    uploadTargetRef.current = null
  }

  return (
    <>
      <div
        className={styles.backdrop}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-bulk-title"
        onClick={onClose}
      >
        <div className={styles.popup} onClick={(e) => e.stopPropagation()}>
          <div className={styles.header}>
            <div>
              <h2 id="product-bulk-title" className={styles.title}>
                New Products
              </h2>
              <p className={styles.subtitle}>
                Add one product per row. Fill in the grouped sheet columns, then save all rows.
              </p>
            </div>
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th rowSpan={2} className={styles.rowNumHead}>
                    #
                  </th>
                  <th colSpan={2} className={styles.groupHead}>
                    <span>Product ID</span>
                    <label className={styles.autoCheckLabel}>
                      <input
                        type="checkbox"
                        className={styles.autoCheck}
                        checked={autoIdEnabled}
                        onChange={(e) => handleAutoToggle(e.target.checked)}
                      />
                      Auto
                    </label>
                  </th>
                  <th colSpan={2} className={styles.groupHead}>
                    QTY in stock
                  </th>
                  <th colSpan={4} className={styles.groupHead}>
                    Pricing information
                  </th>
                  <th colSpan={2} className={styles.groupHead}>
                    Technical Specifications
                  </th>
                  <th colSpan={2} className={styles.groupHead}>
                    Certification
                  </th>
                  <th rowSpan={2} className={styles.actionsHead} />
                </tr>
                <tr>
                  <th className={styles.subHead}>1. SKU ID *</th>
                  <th className={styles.subHead}>2. MFG ID *</th>
                  <th className={styles.subHead}>1. Total qty *</th>
                  <th className={styles.subHead}>2. Min stock qty *</th>
                  <th className={styles.subHead}>1. Base price (₹) *</th>
                  <th className={styles.subHead}>2. MRP (₹) *</th>
                  <th className={styles.subHead}>3. Discount value in %</th>
                  <th className={styles.subHead}>4. Final price (₹)</th>
                  <th className={styles.subHead}>1. Product name *</th>
                  <th className={styles.subHead}>2. Note *</th>
                  <th className={styles.subHead}>1. Certification type</th>
                  <th className={styles.subHead}>2. Logo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id}>
                    <td className={styles.rowNum}>{index + 1}</td>
                    <td>
                      <input
                        className={styles.cellInput}
                        value={row.modelId}
                        onChange={(e) => updateRow(row.id, { modelId: e.target.value })}
                        placeholder="HDS-SKU-001"
                        readOnly={autoIdEnabled}
                      />
                    </td>
                    <td>
                      <input
                        className={styles.cellInput}
                        value={row.manufacturingId}
                        onChange={(e) => updateRow(row.id, { manufacturingId: e.target.value })}
                        placeholder="MFG-001"
                        readOnly={autoIdEnabled}
                      />
                    </td>
                    <td>
                      <input
                        className={styles.cellInput}
                        inputMode="numeric"
                        value={row.stock}
                        onChange={(e) => updateNumericField(row.id, 'stock', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className={styles.cellInput}
                        inputMode="numeric"
                        value={row.minStockQty}
                        onChange={(e) => updateNumericField(row.id, 'minStockQty', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className={styles.cellInput}
                        inputMode="numeric"
                        value={row.basePrice}
                        onChange={(e) => updateNumericField(row.id, 'basePrice', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className={styles.cellInput}
                        inputMode="numeric"
                        value={row.mrp}
                        onChange={(e) => updatePricing(row.id, 'max', 'max', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className={styles.cellInput}
                        inputMode="numeric"
                        value={row.discount}
                        onChange={(e) =>
                          updatePricing(row.id, 'discount', 'discount', e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        className={styles.cellInput}
                        inputMode="numeric"
                        value={row.finalPrice}
                        onChange={(e) => updatePricing(row.id, 'sale', 'sale', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className={styles.cellInput}
                        value={row.name}
                        onChange={(e) => updateRow(row.id, { name: e.target.value })}
                        placeholder="Product name"
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`${styles.noteBtn} ${row.specification.trim() ? styles.noteBtnFilled : ''}`}
                        onClick={() => setNoteRowId(row.id)}
                      >
                        Note
                      </button>
                    </td>
                    <td className={styles.certTypeCell}>
                      <div className={styles.certStack}>
                        {row.certifications.map((cert) => (
                          <div key={cert.id} className={styles.certEntry}>
                            <div className={styles.certSelectShell}>
                              {row.certifications.length >= 2 && (
                                <button
                                  type="button"
                                  className={styles.certRemoveBtn}
                                  onClick={(event) =>
                                    handleRemoveCertification(row.id, cert.id, event)
                                  }
                                  onMouseDown={(event) => event.stopPropagation()}
                                  aria-label="Remove certification"
                                  title="Remove certification"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                              <AnimatedFormSelect
                                className={styles.certSelectWrap}
                                variant="cell"
                                value={cert.type === CREATE_CERT_VALUE ? '' : cert.type}
                                options={getCertOptionsForEntry(row, cert.id)}
                                onChange={(value) => handleCertTypeChange(row.id, cert.id, value)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className={styles.logoCellTd}>
                      <div className={styles.certStack}>
                        {row.certifications.map((cert) => (
                          <div key={cert.id} className={styles.certEntry}>
                            <button
                              type="button"
                              className={`${styles.logoBtn} ${cert.logoUrl ? styles.logoBtnFilled : ''}`}
                              onClick={() => triggerCertDocumentUpload(row.id, cert.id)}
                              disabled={certDocumentUploading || !cert.type}
                              aria-label={
                                cert.documentUrl
                                  ? 'Certificate uploaded — click to replace'
                                  : 'Upload certificate document'
                              }
                              title={
                                !cert.type
                                  ? 'Select a certification type first'
                                  : cert.documentUrl
                                    ? 'Certificate uploaded — click to replace'
                                    : 'Upload certificate document'
                              }
                            >
                              <span
                                className={`${styles.certUploadStatus} ${
                                  cert.documentUrl
                                    ? styles.certUploadStatusDone
                                    : styles.certUploadStatusPending
                                }`}
                                aria-hidden="true"
                              />
                              {cert.logoUrl ? (
                                <Image
                                  src={cert.logoUrl}
                                  alt=""
                                  width={48}
                                  height={48}
                                  className={styles.logoBtnPreview}
                                  unoptimized
                                />
                              ) : (
                                <ImageIcon className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.removeRowBtn}
                        onClick={() => removeRow(row.id)}
                        disabled={rows.length <= 1}
                        aria-label="Remove row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            className={styles.hiddenInput}
            onChange={handleFileChange}
          />

          <div className={styles.footer}>
            <button type="button" className={styles.addRowBtn} onClick={addRow}>
              <Plus className="w-4 h-4" />
              Add Row
            </button>
            <div className={styles.footerActions}>
              <button type="button" className={styles.saveBtn} onClick={onSave} disabled={saving}>
                {saving ? 'Saving...' : `Save ${rows.length} Product${rows.length === 1 ? '' : 's'}`}
              </button>
              <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>

      <CertificationTypeManagerModal
        open={Boolean(createCertRow)}
        meta={
          createCertRow && createCertTarget
            ? `Row ${rows.findIndex((row) => row.id === createCertRow.id) + 1}${
                createCertRow.name.trim() ? ` · ${createCertRow.name}` : ''
              }`
            : undefined
        }
        onClose={closeCertTypeManager}
        onUseType={applyCertTypeToRow}
        onTypesUpdated={handleCertTypesUpdated}
      />

      {noteRow && (
        <div
          className={styles.noteBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="spec-note-title"
          onClick={() => setNoteRowId(null)}
        >
          <div className={styles.noteModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.noteHeader}>
              <div>
                <h3 id="spec-note-title" className={styles.noteTitle}>
                  Specification Note
                </h3>
                <p className={styles.noteMeta}>
                  Row {rows.findIndex((row) => row.id === noteRow.id) + 1}
                  {noteRow.name.trim() ? ` · ${noteRow.name}` : ''}
                </p>
              </div>
              <button
                type="button"
                className={styles.noteCloseBtn}
                onClick={() => setNoteRowId(null)}
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              className={styles.noteTextarea}
              value={noteRow.specification}
              onChange={(e) => updateRow(noteRow.id, { specification: e.target.value })}
              placeholder="Enter product specification details..."
              autoFocus
            />
            <div className={styles.noteActions}>
              <button type="button" className={styles.noteDoneBtn} onClick={() => setNoteRowId(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
