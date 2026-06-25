'use client'

import Image from 'next/image'
import { X } from 'lucide-react'
import styles from './ProductImageModal.module.css'

type ProductImageModalProps = {
  name: string
  image: string
  modelId?: string
  manufacturingId?: string
  onClose: () => void
}

export function ProductImageModal({
  name,
  image,
  modelId,
  manufacturingId,
  onClose,
}: ProductImageModalProps) {
  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-image-title"
      onClick={onClose}
    >
      <div className={styles.popup} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <X className="w-5 h-5" />
        </button>
        <h2 id="product-image-title" className={styles.title}>
          {name}
        </h2>
        {(modelId || manufacturingId) && (
          <p className={styles.meta}>
            {modelId && <span>Model ID: {modelId}</span>}
            {modelId && manufacturingId && <span> · </span>}
            {manufacturingId && <span>MFG: {manufacturingId}</span>}
          </p>
        )}
        <div className={styles.imageWrap}>
          <Image
            src={image || '/images/drone-sentinel-pro.png'}
            alt={name}
            width={640}
            height={480}
            className={styles.image}
            unoptimized
          />
        </div>
      </div>
    </div>
  )
}
