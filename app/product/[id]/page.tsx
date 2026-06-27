'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { ProductCard } from '@/components/ProductCard'
import { useApp } from '@/lib/context'
import { formatPrice } from '@/lib/formatPrice'
import { ProductReviewsSection } from '@/components/ProductReviewsSection'
import { StarRating } from '@/components/StarRating'
import {
  ShoppingCart,
  Heart,
  Share2,
  ChevronRight,
  ChevronLeft,
  Truck,
  Shield,
  RotateCcw,
  Check,
  Package,
  FileText,
  Phone,
  Mail,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import styles from './page.module.css'

type TabId = 'overview' | 'specs' | 'features' | 'warranty' | 'support'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'specs', label: 'Specifications' },
  { id: 'features', label: 'Features' },
  { id: 'warranty', label: 'Warranty' },
  { id: 'support', label: 'Shipping & Support' },
]

export default function ProductDetailPage() {
  const params = useParams()
  const productId = params.id as string
  const { products, addToCart, wishlist, addToWishlist, removeFromWishlist, user } = useApp()
  const product = products.find((p) => p.id === productId)
  const [quantity, setQuantity] = useState(1)
  const [showAddedNotification, setShowAddedNotification] = useState(false)
  const [selectedImage, setSelectedImage] = useState(0)
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [imageLightboxOpen, setImageLightboxOpen] = useState(false)
  const [imageZoom, setImageZoom] = useState(1)

  const MIN_ZOOM = 0.5
  const MAX_ZOOM = 3
  const ZOOM_STEP = 0.25

  useEffect(() => {
    if (!imageLightboxOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setImageLightboxOpen(false)
        setImageZoom(1)
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [imageLightboxOpen])

  if (!product) {
    return (
      <div className={`${styles.page} flex flex-col min-h-screen bg-background`}>
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-2xl text-muted-foreground">Product not found</p>
          <Link href="/shop" className="text-accent hover:text-secondary font-semibold">
            Back to Shop →
          </Link>
        </div>
        <Footer />
      </div>
    )
  }

  const galleryImages = [...new Set([product.image, ...product.images])]
  const relatedProducts = products.filter(
    (p) => p.category === product.category && p.id !== product.id
  ).slice(0, 4)

  const isInWishlist = wishlist.includes(product.id)
  const discount = product.originalPrice
    ? Math.round(
        ((product.originalPrice - product.price) / product.originalPrice) * 100
      )
    : 0

  const scrollToReviews = () => {
    document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleAddToCart = () => {
    addToCart(product, quantity)
    setShowAddedNotification(true)
    setTimeout(() => setShowAddedNotification(false), 2000)
  }

  const handleToggleWishlist = () => {
    if (isInWishlist) {
      removeFromWishlist(product.id)
    } else {
      addToWishlist(product.id)
    }
  }

  const hasMultipleImages = galleryImages.length >= 2

  const goToPrevImage = () => {
    setSelectedImage((prev) => (prev - 1 + galleryImages.length) % galleryImages.length)
  }

  const goToNextImage = () => {
    setSelectedImage((prev) => (prev + 1) % galleryImages.length)
  }

  const openImageLightbox = () => {
    setImageZoom(1)
    setImageLightboxOpen(true)
  }

  const closeImageLightbox = () => {
    setImageLightboxOpen(false)
    setImageZoom(1)
  }

  const zoomInImage = () => {
    setImageZoom((prev) => Math.min(MAX_ZOOM, +(prev + ZOOM_STEP).toFixed(2)))
  }

  const zoomOutImage = () => {
    setImageZoom((prev) => Math.max(MIN_ZOOM, +(prev - ZOOM_STEP).toFixed(2)))
  }

  return (
    <div className={`${styles.page} flex flex-col min-h-screen bg-background`}>
      <Header />

      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/" className="text-accent hover:text-secondary">
              Home
            </Link>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <Link href="/shop" className="text-accent hover:text-secondary">
              Shop
            </Link>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <span className="text-foreground font-semibold line-clamp-1">
              {product.name}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-4">
            <div className={styles.galleryMain}>
              <button
                type="button"
                className={styles.galleryImageBtn}
                onClick={openImageLightbox}
                aria-label="View full size image"
              >
                <Image
                  key={galleryImages[selectedImage]}
                  src={galleryImages[selectedImage] || product.image}
                  alt={`${product.name} — image ${selectedImage + 1}`}
                  fill
                  className={`object-cover ${styles.galleryImage}`}
                  priority
                />
                <span className={styles.galleryHoverOverlay}>
                  <ZoomIn className="w-7 h-7" />
                  <span>Click to enlarge</span>
                </span>
              </button>
              {hasMultipleImages && (
                <>
                  <button
                    type="button"
                    className={`${styles.galleryNavBtn} ${styles.galleryNavPrev}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      goToPrevImage()
                    }}
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    type="button"
                    className={`${styles.galleryNavBtn} ${styles.galleryNavNext}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      goToNextImage()
                    }}
                    aria-label="Next image"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                  <div className={styles.galleryCounter}>
                    {selectedImage + 1} / {galleryImages.length}
                  </div>
                </>
              )}
              {discount > 0 && (
                <div className="absolute top-4 right-4 bg-accent text-accent-foreground px-4 py-2 rounded-lg font-bold text-lg shadow-lg z-10">
                  -{discount}%
                </div>
              )}
            </div>
            {hasMultipleImages && (
              <div className="grid grid-cols-4 gap-4">
                {galleryImages.map((img, idx) => (
                  <button
                    key={`${img}-${idx}`}
                    type="button"
                    onClick={() => setSelectedImage(idx)}
                    className={`relative h-24 rounded-lg overflow-hidden border-2 transition-all ${
                      selectedImage === idx
                        ? 'border-accent'
                        : 'border-border hover:border-muted-foreground'
                    }`}
                  >
                    <Image src={img} alt={`View ${idx + 1}`} fill className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-sm font-bold text-primary uppercase tracking-wider mb-2">
                {product.category} · {product.subcategory}
              </p>
              <h1 className="text-4xl font-bold text-foreground mb-4">{product.name}</h1>
              <p className="text-lg text-muted-foreground">{product.description}</p>
            </div>

            <div className="flex items-center gap-4 pb-6 border-b border-border">
              <StarRating rating={product.rating} />
              <span className="font-bold text-foreground">{product.rating}</span>
              <button
                type="button"
                onClick={scrollToReviews}
                className="text-accent hover:text-secondary"
              >
                ({product.reviews} reviews)
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline gap-4">
                <span className="text-4xl font-bold text-primary">
                  {formatPrice(product.price)}
                </span>
                {product.originalPrice && (
                  <span className="text-2xl text-muted-foreground line-through">
                    {formatPrice(product.originalPrice)}
                  </span>
                )}
              </div>
              {product.originalPrice && (
                <p className="text-green-600 font-semibold">
                  Save {formatPrice(product.originalPrice - product.price)}
                </p>
              )}
            </div>

            <div
              className={`flex items-center gap-2 font-semibold ${
                product.inStock ? 'text-green-600' : 'text-destructive'
              }`}
            >
              {product.inStock ? (
                <>
                  <Check className="w-5 h-5" />
                  In Stock ({product.stock} qty)
                </>
              ) : (
                'Out of Stock'
              )}
            </div>

            <div className={styles.metaRow}>
              <span>
                <span className={styles.metaLabel}>SKU ID:</span> {product.modelId}
              </span>
              <span>
                <span className={styles.metaLabel}>Brand:</span> {product.brand}
              </span>
            </div>

            <div className="flex items-center gap-4 pb-6 border-b border-border flex-wrap">
              <span className="font-semibold text-foreground">Quantity:</span>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center border border-border rounded-lg">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-4 py-2 hover:bg-muted transition-colors"
                  >
                    −
                  </button>
                  <span className="px-6 py-2 font-semibold">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    disabled={quantity >= product.stock}
                    className="px-4 py-2 transition-colors hover:bg-muted disabled:opacity-35 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
                {quantity >= product.stock && product.inStock && (
                  <span className="text-sm font-semibold text-red-600">
                    Current stock is reached
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!product.inStock}
                className="relative w-full py-3 bg-gradient-to-r from-primary to-secondary text-primary-foreground rounded-lg font-bold text-lg hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <ShoppingCart className="w-6 h-6" />
                Add to Cart
              </button>
              {showAddedNotification && (
                <div className="bg-green-600 text-white px-4 py-2 rounded-lg text-center font-semibold">
                  Added to cart!
                </div>
              )}
              <button
                type="button"
                onClick={handleToggleWishlist}
                className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
                  isInWishlist
                    ? 'bg-accent text-accent-foreground hover:opacity-90'
                    : 'border-2 border-border text-foreground hover:bg-muted'
                }`}
              >
                <Heart className={`w-5 h-5 ${isInWishlist ? 'fill-current' : ''}`} />
                {isInWishlist ? 'Remove from Liked List' : 'Add to Liked List'}
              </button>
              <button
                type="button"
                className="w-full py-3 border-2 border-border text-foreground rounded-lg font-bold hover:bg-muted transition-colors flex items-center justify-center gap-2"
              >
                <Share2 className="w-5 h-5" />
                Share
              </button>
            </div>

            <div className="space-y-3 pt-6 border-t border-border">
              {[
                {
                  icon: Truck,
                  text: product.shipping.freeShipping
                    ? 'Free shipping available'
                    : 'Shipping calculated at checkout',
                },
                { icon: Shield, text: `${product.warranty.duration} warranty included` },
                { icon: RotateCcw, text: '30-day money-back guarantee' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 text-muted-foreground">
                  <item.icon className="w-5 h-5 text-accent" />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-border">
          <div className={styles.tabBar}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div>
              <h2 className={styles.sectionTitle}>Product Overview</h2>
              <p className="text-muted-foreground leading-relaxed mb-8 max-w-3xl">
                {product.longDescription}
              </p>

              <h3 className={styles.sectionTitle}>What&apos;s in the Box</h3>
              <div className={styles.boxGrid}>
                {product.inTheBox.map((item) => (
                  <div key={item} className={styles.boxItem}>
                    <Package className="w-4 h-4 text-primary flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-10">
                <h3 className={styles.sectionTitle}>Quick Specifications</h3>
                <div className={styles.specTable}>
                  {Object.entries(product.specs)
                    .slice(0, 6)
                    .map(([key, value]) => (
                      <div key={key} className={styles.specRow}>
                        <span className={styles.specKey}>{key}</span>
                        <span className={styles.specValue}>{value}</span>
                      </div>
                    ))}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('specs')}
                  className="mt-4 text-accent hover:text-secondary font-semibold text-sm"
                >
                  View all specifications →
                </button>
              </div>
            </div>
          )}

          {activeTab === 'specs' && (
            <div>
              <h2 className={styles.sectionTitle}>Technical Specifications</h2>
              <div className={styles.specTable}>
                {Object.entries(product.specs).map(([key, value]) => (
                  <div key={key} className={styles.specRow}>
                    <span className={styles.specKey}>{key}</span>
                    <span className={styles.specValue}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'features' && (
            <div>
              <h2 className={styles.sectionTitle}>Key Features</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                {product.features.map((feature) => (
                  <div key={feature} className={styles.featureItem}>
                    <Check className={styles.featureCheck} />
                    <p className="text-muted-foreground">{feature}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'warranty' && (
            <div>
              <h2 className={styles.sectionTitle}>Warranty Details</h2>

              <div className={styles.warrantyCard}>
                <div className={styles.warrantyHeader}>
                  <div>
                    <p className={styles.warrantyDuration}>{product.warranty.duration}</p>
                    <p className={styles.warrantyType}>{product.warranty.type}</p>
                  </div>
                  {product.warranty.extendedAvailable && (
                    <div className="px-4 py-2 rounded-lg bg-accent/10 text-accent font-semibold text-sm">
                      Extended warranty: {product.warranty.extendedPrice}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className={styles.listTitle}>What&apos;s Covered</p>
                    {product.warranty.coverage.map((item) => (
                      <div key={item} className={styles.listItem}>
                        <Check className={`${styles.listBullet} w-4 h-4 text-green-600`} />
                        {item}
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className={styles.listTitle}>Exclusions</p>
                    {product.warranty.exclusions.map((item) => (
                      <div key={item} className={styles.listItem}>
                        <X className={`${styles.listBullet} w-4 h-4 text-destructive`} />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                For warranty claims, contact{' '}
                <a href={`mailto:${product.support.email}`} className="text-accent hover:underline">
                  {product.support.email}
                </a>{' '}
                with your order number and SKU ID ({product.modelId}).
              </p>
            </div>
          )}

          {activeTab === 'support' && (
            <div>
              <h2 className={styles.sectionTitle}>Shipping & Support</h2>

              <div className={styles.infoGrid}>
                <div className={styles.infoCard}>
                  <p className={styles.infoCardTitle}>
                    <Truck className="w-5 h-5" />
                    Shipping
                  </p>
                  <p className={styles.infoCardText}>
                    <strong>Delivery:</strong> {product.shipping.deliveryTime}
                    <br />
                    <strong>Free shipping:</strong>{' '}
                    {product.shipping.freeShipping ? 'Yes' : 'No'}
                    <br />
                    <strong>Regions:</strong> {product.shipping.regions.join(', ')}
                  </p>
                </div>

                <div className={styles.infoCard}>
                  <p className={styles.infoCardTitle}>
                    <Phone className="w-5 h-5" />
                    Phone Support
                  </p>
                  <p className={styles.infoCardText}>
                    <a href={`tel:${product.support.phone}`} className="text-accent hover:underline">
                      {product.support.phone}
                    </a>
                    <br />
                    Mon–Fri, 8 AM – 6 PM EST
                  </p>
                </div>

                <div className={styles.infoCard}>
                  <p className={styles.infoCardTitle}>
                    <Mail className="w-5 h-5" />
                    Email Support
                  </p>
                  <p className={styles.infoCardText}>
                    <a
                      href={`mailto:${product.support.email}`}
                      className="text-accent hover:underline"
                    >
                      {product.support.email}
                    </a>
                  </p>
                </div>

                <div className={styles.infoCard}>
                  <p className={styles.infoCardTitle}>
                    <FileText className="w-5 h-5" />
                    Documentation
                  </p>
                  <p className={styles.infoCardText}>
                    <a
                      href={product.support.documentation}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      View product manual & guides →
                    </a>
                  </p>
                </div>
              </div>

              <div className="mt-8 p-6 rounded-xl border border-border bg-card">
                <h3 className="font-bold text-foreground mb-3">Return Policy</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Returns accepted within 30 days of delivery for unused products in original
                  packaging. Restocking fee may apply for opened items. Contact support before
                  initiating a return. Military and tactical products may have additional return
                  restrictions.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <ProductReviewsSection
            productId={product.id}
            initialReviews={product.reviewList}
            initialRating={product.rating}
          />
        </div>

        {relatedProducts.length > 0 && (
          <div className="mt-16 pt-12 border-t border-border">
            <h2 className="text-2xl font-bold text-foreground mb-6">Related Products</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>

      {imageLightboxOpen && (
        <div
          className={styles.lightboxBackdrop}
          role="dialog"
          aria-modal="true"
          aria-label="Product image preview"
          onClick={closeImageLightbox}
        >
          <div className={styles.lightboxModal} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.lightboxCloseBtn}
              onClick={closeImageLightbox}
              aria-label="Close preview"
            >
              <X className="w-5 h-5" />
            </button>

            <div className={styles.lightboxViewport}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={galleryImages[selectedImage] || product.image}
                alt={`${product.name} — enlarged view`}
                className={styles.lightboxImage}
                style={{ transform: `scale(${imageZoom})` }}
                draggable={false}
              />
            </div>

            <div className={styles.lightboxToolbar}>
              <button
                type="button"
                className={styles.lightboxZoomBtn}
                onClick={zoomOutImage}
                disabled={imageZoom <= MIN_ZOOM}
                aria-label="Zoom out"
              >
                <ZoomOut className="w-5 h-5" />
                Zoom out
              </button>
              <span className={styles.lightboxZoomLevel}>{Math.round(imageZoom * 100)}%</span>
              <button
                type="button"
                className={styles.lightboxZoomBtn}
                onClick={zoomInImage}
                disabled={imageZoom >= MAX_ZOOM}
                aria-label="Zoom in"
              >
                <ZoomIn className="w-5 h-5" />
                Zoom in
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
