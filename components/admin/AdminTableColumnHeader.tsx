'use client'

import styles from './AdminTableColumnHeader.module.css'

type AdminTableColumnHeaderProps = {
  label: string
  highlighted?: boolean
  className?: string
  wrap?: boolean
}

export function AdminTableColumnHeader({
  label,
  highlighted = false,
  className,
  wrap = false,
}: AdminTableColumnHeaderProps) {
  return (
    <th className={[styles.cell, className].filter(Boolean).join(' ')}>
      <span
        className={[styles.label, highlighted ? styles.labelHighlighted : '', wrap ? styles.labelWrap : '']
          .filter(Boolean)
          .join(' ')}
      >
        {label}
      </span>
    </th>
  )
}
