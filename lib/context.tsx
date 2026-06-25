'use client'

import {
  createContext,
  useContext,
  ReactNode,
  useState,
  useCallback,
  useEffect,
} from 'react'
import { CartItem, User, Order, Product } from '@/lib/types'
import { PRODUCTS } from '@/lib/mockData'
import { apiFetch, getStoredToken, setStoredToken } from '@/lib/api'
import { CustomerOrderAuthorizationToast } from '@/components/CustomerOrderAuthorizationToast'
import { CustomerChatWidget } from '@/components/CustomerChatWidget'
import { SiteLoadingGate } from '@/components/SiteLoadingGate'

interface AppContextType {
  user: User | null
  authLoading: boolean
  login: (login: string, password: string) => Promise<User>
  register: (data: {
    username: string
    email: string
    password: string
    name: string
    phone?: string
  }) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: User | null) => void
  products: Product[]
  refreshProducts: () => Promise<void>
  cart: CartItem[]
  addToCart: (product: Product, quantity: number) => void
  removeFromCart: (productId: string) => void
  updateCartQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  getCartTotal: () => number
  wishlist: string[]
  addToWishlist: (productId: string) => void
  removeFromWishlist: (productId: string) => void
  orders: Order[]
  addOrder: (order: Order) => Promise<void>
  refreshOrders: () => Promise<void>
}

const AppContext = createContext<AppContextType | undefined>(undefined)

function sortOrdersNewestFirst(orders: Order[]): Order[] {
  return [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>(PRODUCTS)
  const [cart, setCart] = useState<CartItem[]>([])
  const [wishlist, setWishlist] = useState<string[]>([])
  const [orders, setOrders] = useState<Order[]>([])

  const refreshProducts = useCallback(async () => {
    try {
      const data = await apiFetch<{ products: Product[] }>('/api/products')
      if (Array.isArray(data.products)) {
        setProducts(data.products)
      }
    } catch {
      setProducts(PRODUCTS)
    }
  }, [])

  const refreshOrders = useCallback(async () => {
    try {
      const data = await apiFetch<{ orders: Order[] }>('/api/orders')
      setOrders(
        sortOrdersNewestFirst(
          data.orders.map((o) => ({
            ...o,
            createdAt: new Date(o.createdAt),
            deliveryDate: o.deliveryDate ? new Date(o.deliveryDate) : undefined,
          }))
        )
      )
    } catch {
      // keep local orders if not authenticated
    }
  }, [])

  useEffect(() => {
    if (products.length === 0) return

    setCart((prev) => {
      if (prev.length === 0) return prev

      let changed = false
      const next: CartItem[] = []

      for (const item of prev) {
        const product = products.find((p) => p.id === item.productId)
        if (!product || !product.inStock || product.stock < 1) {
          changed = true
          continue
        }
        const capped = Math.min(item.quantity, product.stock)
        if (
          capped !== item.quantity ||
          item.product.stock !== product.stock ||
          item.product.inStock !== product.inStock
        ) {
          changed = true
        }
        next.push({ ...item, quantity: capped, product })
      }

      return changed ? next : prev
    })
  }, [products])

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshProducts()
    }, 10000)

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshProducts()
      }
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [refreshProducts])

  useEffect(() => {
    if (!user) return

    void refreshOrders()

    const interval = window.setInterval(() => {
      void refreshOrders()
    }, 10000)

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshOrders()
      }
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [user, refreshOrders])

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      const work = (async () => {
        await refreshProducts()
        const token = getStoredToken()
        if (token) {
          try {
            const data = await apiFetch<{ user: User }>('/api/auth/me')
            if (!cancelled) setUser(data.user)
            await refreshOrders()
          } catch {
            if (!cancelled) setStoredToken(null)
          }
        }
      })()

      const timeout = new Promise<void>((resolve) => {
        window.setTimeout(resolve, 5000)
      })

      await Promise.race([work, timeout])
      if (!cancelled) setAuthLoading(false)
    }

    init()
    return () => {
      cancelled = true
    }
  }, [refreshProducts, refreshOrders])

  const login = useCallback(
    async (loginId: string, password: string) => {
      const data = await apiFetch<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ login: loginId, password }),
      })
      setStoredToken(data.token)
      setUser(data.user)
      await refreshOrders()
      return data.user
    },
    [refreshOrders]
  )

  const register = useCallback(
    async (data: {
      username: string
      email: string
      password: string
      name: string
      phone?: string
    }) => {
      const result = await apiFetch<{ token: string; user: User }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      setStoredToken(result.token)
      setUser(result.user)
    },
    []
  )

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // ignore
    }
    setStoredToken(null)
    setUser(null)
    setOrders([])
  }, [])

  const addToCart = useCallback((product: Product, quantity: number) => {
    if (!product.inStock || product.stock < 1) return

    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.productId === product.id)
      const currentQty = existingItem?.quantity ?? 0
      const nextQty = Math.min(currentQty + quantity, product.stock)

      if (nextQty <= currentQty) return prevCart

      if (existingItem) {
        return prevCart.map((item) =>
          item.productId === product.id ? { ...item, quantity: nextQty } : item
        )
      }
      return [...prevCart, { productId: product.id, quantity: nextQty, product }]
    })
  }, [])

  const removeFromCart = useCallback((productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.productId !== productId))
  }, [])

  const updateCartQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (quantity <= 0) {
        removeFromCart(productId)
        return
      }

      const product = products.find((p) => p.id === productId)
      const maxStock = product?.stock ?? quantity
      const cappedQty = Math.min(quantity, maxStock)

      setCart((prevCart) =>
        prevCart.map((item) =>
          item.productId === productId ? { ...item, quantity: cappedQty } : item
        )
      )
    },
    [removeFromCart, products]
  )

  const clearCart = useCallback(() => {
    setCart([])
  }, [])

  const getCartTotal = useCallback(() => {
    return cart.reduce((total, item) => {
      const product = products.find((p) => p.id === item.productId)
      return total + (product?.price || 0) * item.quantity
    }, 0)
  }, [cart, products])

  const addToWishlist = useCallback((productId: string) => {
    setWishlist((prev) => (prev.includes(productId) ? prev : [...prev, productId]))
  }, [])

  const removeFromWishlist = useCallback((productId: string) => {
    setWishlist((prev) => prev.filter((id) => id !== productId))
  }, [])

  const addOrder = useCallback(
    async (order: Order) => {
      setOrders((prev) => sortOrdersNewestFirst([order, ...prev]))
      clearCart()
      try {
        await apiFetch('/api/orders', {
          method: 'POST',
          body: JSON.stringify({ order }),
        })
        await refreshProducts()
        await refreshOrders()
      } catch {
        // order saved locally
      }
    },
    [clearCart, refreshProducts, refreshOrders]
  )

  return (
    <AppContext.Provider
      value={{
        user,
        authLoading,
        login,
        register,
        logout,
        setUser,
        products,
        refreshProducts,
        cart,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        getCartTotal,
        wishlist,
        addToWishlist,
        removeFromWishlist,
        orders,
        addOrder,
        refreshOrders,
      }}
    >
      <SiteLoadingGate>{children}</SiteLoadingGate>
      <CustomerOrderAuthorizationToast />
      <CustomerChatWidget />
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}
