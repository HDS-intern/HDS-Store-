'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Shield, LogOut, Bell } from 'lucide-react'
import { AdminSlideUp } from '@/components/admin/AdminSlideUp'
import { wasAdminEntranceStarted } from '@/lib/adminEntrance'
import styles from './AdminShell.module.css'

export type AdminTab =
  | 'dashboard'
  | 'inventory'
  | 'orders'
  | 'invoices'
  | 'payments'
  | 'users'
  | 'staff-data'
  | 'template'
  | 'messages'
  | 'customer-chat'

type NavItem = {
  id: AdminTab
  label: string
  icon: LucideIcon
  adminOnly?: boolean
  badgeCount?: number
}

type AdminShellProps = {
  user: { name: string; role: string }
  tab: AdminTab
  onTabChange: (tab: AdminTab) => void
  onLogout: () => void
  navItems: NavItem[]
  children: React.ReactNode
  entranceSession?: number
}

export function AdminShell({
  user,
  tab,
  onTabChange,
  onLogout,
  navItems,
  children,
  entranceSession = 0,
}: AdminShellProps) {
  const concealSidebar =
    tab === 'dashboard' && entranceSession === 0 && !wasAdminEntranceStarted()

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <Shield className="w-6 h-6 text-primary" />
          HDS Control Center
          <span className={styles.brandBadge}>Admin</span>
        </div>
        <div className={styles.topbarRight}>
          <div className={styles.userChip}>
            <span>{user.name}</span>
            <span className="text-muted-foreground">·</span>
            <span className="uppercase text-xs text-primary">{user.role}</span>
          </div>
          <button type="button" onClick={onLogout} className={styles.logoutBtn}>
            <LogOut className="w-4 h-4 inline mr-1" />
            Logout
          </button>
        </div>
      </header>

      <div className={styles.body}>
        <aside className={[styles.sidebar, concealSidebar ? styles.sidebarConcealed : ''].filter(Boolean).join(' ')}>
          <AdminSlideUp delayMs={0} entranceSession={entranceSession} className={styles.sidebarInner}>
            <p className={styles.sidebarLabel}>Management</p>
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  className={`${styles.navBtn} ${tab === item.id ? styles.navBtnActive : ''}`}
                >
                  <Icon className="w-4 h-4" />
                  {item.badgeCount != null && item.badgeCount > 0 && (
                    <span className={styles.navBadge} aria-label={`${item.badgeCount} unread messages`}>
                      <Bell className="w-3 h-3" />
                      <span>{item.badgeCount > 99 ? '99+' : item.badgeCount}</span>
                    </span>
                  )}
                  {item.label}
                </button>
              )
            })}
            <Link href="/" className={styles.storeLink}>
              ← View Customer Store
            </Link>
          </AdminSlideUp>
        </aside>

        <main className={styles.main}>{children}</main>
      </div>

      <footer className={styles.footer}>
        HDS Private Limited · Internal Admin System · Confidential
      </footer>
    </div>
  )
}
