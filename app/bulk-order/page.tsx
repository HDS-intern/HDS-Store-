'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { BulkOrderPreviewModal } from '@/components/BulkOrderPreviewModal'
import { useApp } from '@/lib/context'
import {
  parseSheetRows,
  matchBulkRowsToProducts,
  type ParsedBulkLine,
} from '@/lib/bulkOrder'
import {
  Download,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  ChevronRight,
} from 'lucide-react'
import styles from './page.module.css'

export default function BulkOrderPage() {
  const router = useRouter()
  const { user, products, clearCart, addToCart } = useApp()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [parsedLines, setParsedLines] = useState<ParsedBulkLine[]>([])
  const [fileName, setFileName] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [confirming, setConfirming] = useState(false)

  const isLoggedIn = Boolean(user)

  const validLines = parsedLines.filter((line) => line.product && !line.error)

  const parseUploadedFile = async (file: File) => {
    setError('')
    setInfo('')
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'xlsx' && ext !== 'csv') {
      setError('Only .xlsx and .csv files are allowed.')
      return
    }

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 }) as string[][]

      const rows = parseSheetRows(matrix)
      if (rows.length === 0) {
        setError('No valid rows found. Use the template with Model Number and Qty columns.')
        setParsedLines([])
        setShowPreview(false)
        return
      }

      const matched = matchBulkRowsToProducts(rows, products)
      setParsedLines(matched)
      setFileName(file.name)
      setShowPreview(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file')
      setParsedLines([])
      setShowPreview(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) parseUploadedFile(file)
    e.target.value = ''
  }

  const handleConfirm = async () => {
    if (!isLoggedIn) {
      setError('Please log in to confirm your bulk order.')
      return
    }
    if (validLines.length === 0) {
      setError('Fix errors in the preview before confirming.')
      return
    }

    setConfirming(true)
    setError('')
    try {
      const payload = validLines.map((line) => ({
        modelNumber: line.modelNumber,
        qty: line.qty,
        productId: line.product!.id,
        productName: line.product!.name,
        price: line.product!.price,
      }))

      clearCart()
      for (const line of validLines) {
        addToCart(line.product!, line.qty)
      }

      sessionStorage.setItem('hds-bulk-order-pending', JSON.stringify(payload))
      setShowPreview(false)
      router.push('/checkout?source=bulk')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirmation failed')
    } finally {
      setConfirming(false)
    }
  }

  const closePreview = () => {
    if (confirming) return
    setShowPreview(false)
  }

  return (
    <div className={`${styles.page} flex flex-col min-h-screen`}>
      <Header />

      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/" className="text-accent hover:text-secondary">
              Home
            </Link>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <span className="text-foreground font-semibold">Bulk Order Sheet</span>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        <h1 className={styles.title}>Bulk Order Sheet</h1>
        <p className={styles.subtitle}>
          Download the template, fill in model numbers and quantities, then upload your file.
          A preview will open for you to review — confirm to proceed to checkout and place your order.
        </p>

        {!user && (
          <div className={`${styles.alert} ${styles.alertInfo}`}>
            Please <Link href="/login" className="underline font-semibold">log in</Link> to upload
            your bulk order file and proceed to checkout.
          </div>
        )}

        {error && (
          <div className={`${styles.alert} ${styles.alertError}`}>
            <AlertCircle className="w-4 h-4 inline mr-1" />
            {error}
          </div>
        )}
        {info && <div className={`${styles.alert} ${styles.alertSuccess}`}>{info}</div>}

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            <Download className="w-5 h-5 inline mr-1" />
            Download Template
          </h2>
          <p className={styles.cardHint}>
            Use the spreadsheet template with <strong>Model Number</strong> and <strong>Qty</strong>{' '}
            columns. Model numbers should match product Model IDs (e.g. HDS-SNT-4K-001).
          </p>
          <div className={styles.actions}>
            <a href="/api/bulk-order/template?format=xlsx" className={`${styles.btn} ${styles.btnPrimary}`}>
              <FileSpreadsheet className="w-4 h-4" />
              Download .xlsx
            </a>
            <a href="/api/bulk-order/template?format=csv" className={`${styles.btn} ${styles.btnOutline}`}>
              <Download className="w-4 h-4" />
              Download .csv
            </a>
          </div>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            <Upload className="w-5 h-5 inline mr-1" />
            Upload Order File
          </h2>
          <p className={styles.cardHint}>
            Upload your completed .xlsx or .csv file. A preview popup will open so you can review
            your items before confirming.
          </p>

          {!isLoggedIn ? (
            <div className={`${styles.alert} ${styles.alertInfo}`}>
              Log in to upload your bulk order file.
            </div>
          ) : (
            <div className={styles.uploadZone}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv"
                className={styles.fileInput}
                onChange={handleFileChange}
              />
              <label className={styles.uploadLabel} onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4" />
                Choose .xlsx or .csv file
              </label>
              {fileName && <p className={styles.fileName}>Last uploaded: {fileName}</p>}
            </div>
          )}
        </div>
      </div>

      {showPreview && parsedLines.length > 0 && (
        <BulkOrderPreviewModal
          fileName={fileName}
          lines={parsedLines}
          confirming={confirming}
          onConfirm={handleConfirm}
          onClose={closePreview}
        />
      )}

      <Footer />
    </div>
  )
}
