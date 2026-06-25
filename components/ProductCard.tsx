'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Heart, ShoppingCart, Minus, Plus } from 'lucide-react'
import { Product } from '@/lib/types'
import { formatPrice } from '@/lib/formatPrice'
import { useApp } from '@/lib/context'
import { useState } from 'react'

interface ProductCardProps {
  product: Product
  /** Stack original price below discounted price (shop page). */
  stackedPrice?: boolean
}

export function ProductCard({ product, stackedPrice = false }: ProductCardProps) {
  const { cart, addToCart, updateCartQuantity, addToWishlist, removeFromWishlist, wishlist } =
    useApp()
  const [showAddedNotification, setShowAddedNotification] = useState(false)
  const isInWishlist = wishlist.includes(product.id)
  const cartItem = cart.find((item) => item.productId === product.id)
  const cartQuantity = cartItem?.quantity ?? 0
  const atStockLimit = cartQuantity >= product.stock

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!product.inStock) return
    addToCart(product, 1)
    setShowAddedNotification(true)
    setTimeout(() => setShowAddedNotification(false), 2000)
  }

  const handleDecreaseQuantity = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    updateCartQuantity(product.id, cartQuantity - 1)
  }

  const handleIncreaseQuantity = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (cartQuantity < product.stock) {
      updateCartQuantity(product.id, cartQuantity + 1)
    }
  }

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isInWishlist) {
      removeFromWishlist(product.id)
    } else {
      addToWishlist(product.id)
    }
  }

  return (
    <Link
      href={`/product/${product.id}`}
      className="group relative flex h-full flex-col bg-card rounded-2xl overflow-hidden border border-border hover:shadow-2xl transition-all duration-400 hover:border-primary/40 hover:-translate-y-2"
      style={{ boxShadow: '0 4px 20px rgba(53, 106, 176, 0.06)' }}
    >
      {/* Image Container */}
      <div className="relative h-64 overflow-hidden bg-gradient-to-br from-muted to-background">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-cover group-hover:scale-110 transition-transform duration-500"
        />

        {/* Sale Badge */}
        {product.originalPrice && (
          <div
            className="absolute top-4 right-4 px-3 py-1.5 rounded-full text-sm font-bold shadow-lg text-white"
            style={{ background: 'rgba(53, 106, 176, 1)' }}
          >
            {Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF
          </div>
        )}

        {/* Wishlist Button */}
        <button
          onClick={handleToggleWishlist}
          className="absolute top-4 left-4 p-2 rounded-full bg-card/80 backdrop-blur-sm hover:bg-card transition-all shadow-md"
        >
          <Heart
            className={`w-5 h-5 transition-colors ${
              isInWishlist
                ? 'fill-accent text-accent'
                : 'text-muted-foreground hover:text-accent'
            }`}
          />
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-1 flex-col gap-3">
          {/* Category & Rating */}
          <div className="flex justify-between items-start">
            <p className="text-xs font-semibold text-primary uppercase tracking-wide">
              {product.category}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-sm font-bold text-foreground">★ {product.rating}</span>
              <span className="text-xs text-muted-foreground">
                ({product.reviews})
              </span>
            </div>
          </div>

          {/* Product Name */}
          <h3 className="min-h-[3.5rem] font-bold text-lg text-foreground line-clamp-2 group-hover:text-accent transition-colors">
            {product.name}
          </h3>

          {/* Stock Status */}
          <p
            className={`text-xs font-semibold ${
              product.inStock
                ? 'text-green-600'
                : 'text-destructive'
            }`}
          >
            {product.inStock
              ? `✓ In Stock (${product.stock} qty)`
              : 'Out of Stock'}
          </p>

          {/* Price */}
          <div
            className={
              stackedPrice
                ? 'flex min-h-[3.25rem] flex-col items-start gap-0.5'
                : 'flex min-h-[2.75rem] flex-wrap items-baseline gap-x-2 gap-y-0.5'
            }
          >
            <span className="text-2xl font-bold text-primary whitespace-nowrap">
              {formatPrice(product.price)}
            </span>
            {product.originalPrice && (
              <span className="text-sm text-muted-foreground line-through whitespace-nowrap">
                {formatPrice(product.originalPrice)}
              </span>
            )}
          </div>
        </div>

        {/* Add to Cart / Quantity */}
        <div className="mt-auto shrink-0 pt-3">
          {cartQuantity > 0 ? (
            <div
              className="flex items-center justify-between gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
            >
              <span className="text-sm font-semibold text-primary">In cart</span>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDecreaseQuantity}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/30 bg-white text-primary hover:bg-primary/10 transition-colors"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="min-w-[2rem] text-center text-base font-bold text-primary">
                    {cartQuantity}
                  </span>
                  <button
                    type="button"
                    onClick={handleIncreaseQuantity}
                    disabled={atStockLimit}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/30 bg-white text-primary hover:bg-primary/10 transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {atStockLimit && (
                  <span className="text-[0.6875rem] font-semibold text-red-600 leading-tight text-right">
                    Current stock is reached
                  </span>
                )}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!product.inStock}
              className="relative w-full py-2.5 rounded-xl font-semibold text-white hover:shadow-lg transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, rgba(53, 106, 176, 1), rgba(74, 126, 196, 1))',
                boxShadow: '0 4px 14px rgba(53, 106, 176, 0.3)',
              }}
            >
              <ShoppingCart className="w-4 h-4" />
              Add to Cart
            </button>
          )}
        </div>

        {showAddedNotification && (
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap shadow-lg">
            Added to cart!
          </div>
        )}
      </div>
    </Link>
  )
}
