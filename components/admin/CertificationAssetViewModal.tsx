'use client'

import Image from 'next/image'
import { X } from 'lucide-react'
import styles from './CertificationAssetViewModal.module.css'

export type CertificationAssetPreview = {
  title: string
  url: string
  productLabel?: string
}

type CertificationAssetViewModalProps = {
  asset: CertificationAssetPreview
  onClose: () => void
}

export function CertificationAssetViewModal({ asset, onClose }: CertificationAssetViewModalProps) {
  const isPdf = asset.url.toLowerCase().endsWith('.pdf')

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cert-asset-view-title"
      onClick={onClose}
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h3 id="cert-asset-view-title" className={styles.title}>
              {asset.title}
            </h3>
            {asset.productLabel && <p className={styles.meta}>{asset.productLabel}</p>}
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className={styles.body}>
          {isPdf ? (
            <iframe src={asset.url} title={asset.title} className={styles.pdfFrame} />
          ) : (
            <div className={styles.imageWrap}>
              <Image
                src={asset.url}
                alt={asset.title}
                width={640}
                height={480}
                className={styles.image}
                unoptimized
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
