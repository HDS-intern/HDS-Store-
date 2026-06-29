'use client'

import styles from './Header.module.css'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useApp } from '@/lib/context'
import { isAdminDashboard } from '@/lib/theme'
import { ShoppingCart, Heart, Menu, X, Search, FileSpreadsheet } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useEffect, useState } from 'react'

export function Header() {
  const pathname = usePathname()
  const { cart, wishlist, user } = useApp()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [hideThemeToggle, setHideThemeToggle] = useState(false)

  useEffect(() => {
    setHideThemeToggle(isAdminDashboard(pathname))
  }, [pathname])

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <header className={styles.header}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className={styles.logo}>
            <div className={styles.logoIcon}>
              <img
                src="/logo.png"
                alt="HDS"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="hidden sm:inline">HDS</span>
          </Link>

          <div className="hidden md:flex flex-1 mx-8 items-center">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search drones..."
                className={styles.searchInput}
              />
              <Search className="absolute right-3 top-2.5 w-5 h-5 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-8">
            <Link href="/shop" className={styles.navLink}>
              Shop
            </Link>
            <Link href="/about" className={styles.navLink}>
              About
            </Link>
            <Link href="/contact" className={styles.navLink}>
              Contact
            </Link>
          </nav>

          <div className="flex items-center gap-1 sm:gap-2 ml-4 sm:ml-8">
            {!hideThemeToggle && <ThemeToggle />}

            <Link
              href="/bulk-order"
              className={`${styles.iconBtn} hidden lg:inline-flex`}
              aria-label="Bulk order sheet"
              title="Bulk Order Sheet"
            >
              <FileSpreadsheet className="w-5 h-5" />
            </Link>

            <button className={`${styles.iconBtn} lg:hidden`} aria-label="Search">
              <Search className="w-5 h-5" />
            </button>

            <Link href="/wishlist" className={styles.iconBtn} aria-label="Wishlist">
              <Heart className="w-5 h-5" />
              {wishlist.length > 0 && (
                <span className={styles.badge}>{wishlist.length}</span>
              )}
            </Link>

            <Link href="/cart" className={styles.iconBtn} aria-label="Cart">
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className={styles.badge}>{cartCount}</span>
              )}
            </Link>

            {user ? (
              <Link
                href={user.role === 'admin' || user.role === 'staff' ? '/admin' : '/account'}
                className={styles.authBtn}
              >
                {user.name.split(' ')[0]}
              </Link>
            ) : (
              <Link href="/login" className={styles.authBtn}>
                Log in / Register
              </Link>
            )}

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`${styles.iconBtn} lg:hidden`}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav className={styles.mobileNav}>
            <Link
              href="/shop"
              className={styles.mobileLink}
              onClick={() => setMobileMenuOpen(false)}
            >
              Shop
            </Link>
            <Link
              href="/about"
              className={styles.mobileLink}
              onClick={() => setMobileMenuOpen(false)}
            >
              About
            </Link>
            <Link
              href="/contact"
              className={styles.mobileLink}
              onClick={() => setMobileMenuOpen(false)}
            >
              Contact
            </Link>
            <Link
              href="/bulk-order"
              className={styles.mobileLink}
              onClick={() => setMobileMenuOpen(false)}
            >
              Bulk Order Sheet
            </Link>
            {!hideThemeToggle && (
            <div className={styles.mobileThemeRow}>
              <span>Theme</span>
              <ThemeToggle />
            </div>
            )}
            <Link
              href="/wishlist"
              className={styles.mobileLink}
              onClick={() => setMobileMenuOpen(false)}
            >
              Liked List
              {wishlist.length > 0 && ` (${wishlist.length})`}
            </Link>
            {!user && (
              <Link
                href="/login"
                className={styles.mobileLink}
                onClick={() => setMobileMenuOpen(false)}
              >
                Log in / Register
              </Link>
            )}
          </nav>
        )}
      </div>
    </header>
  )
}
