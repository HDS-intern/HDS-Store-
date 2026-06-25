'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useApp } from '@/lib/context'
import { SiteLoadingOverlay } from '@/components/SiteLoadingOverlay'

const MIN_ROUTE_LOADING_MS = 350
const MAX_INITIAL_LOADING_MS = 4000

export function SiteLoadingGate({ children }: { children: React.ReactNode }) {
  const { authLoading } = useApp()
  const pathname = usePathname()
  const [routeLoading, setRouteLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [forceHideOverlay, setForceHideOverlay] = useState(false)
  const routeStartedAt = useRef<number | null>(null)

  useEffect(() => {
    const dismiss = () => setPageLoading(false)

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      dismiss()
    } else {
      document.addEventListener('DOMContentLoaded', dismiss)
      window.addEventListener('load', dismiss)
    }

    const fallback = window.setTimeout(dismiss, 2500)
    const hardCap = window.setTimeout(() => setForceHideOverlay(true), MAX_INITIAL_LOADING_MS)

    return () => {
      document.removeEventListener('DOMContentLoaded', dismiss)
      window.removeEventListener('load', dismiss)
      window.clearTimeout(fallback)
      window.clearTimeout(hardCap)
    }
  }, [])

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const anchor = target?.closest('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return
      }
      if (anchor.target === '_blank') return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      try {
        const nextUrl = new URL(href, window.location.href)
        if (nextUrl.origin !== window.location.origin) return
        if (
          nextUrl.pathname === window.location.pathname &&
          nextUrl.search === window.location.search
        ) {
          return
        }
        routeStartedAt.current = Date.now()
        setRouteLoading(true)
      } catch {
        // ignore invalid href
      }
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [])

  useEffect(() => {
    if (!routeLoading) return

    const startedAt = routeStartedAt.current ?? Date.now()
    const elapsed = Date.now() - startedAt
    const remaining = Math.max(0, MIN_ROUTE_LOADING_MS - elapsed)

    const timer = window.setTimeout(() => {
      setRouteLoading(false)
      routeStartedAt.current = null
    }, remaining)

    return () => window.clearTimeout(timer)
  }, [pathname, routeLoading])

  const showOverlay =
    !forceHideOverlay && (authLoading || pageLoading || routeLoading)

  return (
    <>
      {children}
      {showOverlay && <SiteLoadingOverlay />}
    </>
  )
}
