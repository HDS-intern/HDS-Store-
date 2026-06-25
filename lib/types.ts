import type { UserPermissions } from './permissions'

export interface ProductReview {
  id: string
  author: string
  userId?: string
  orderId?: string
  rating: number
  date: string
  title: string
  comment: string
  verified: boolean
}

export interface WarrantyInfo {
  duration: string
  type: string
  coverage: string[]
  exclusions: string[]
  extendedAvailable: boolean
  extendedPrice?: string
}

export interface Product {
  id: string
  name: string
  modelId: string
  manufacturingId: string
  brand: string
  price: number
  originalPrice?: number
  image: string
  category: string
  subcategory: string
  rating: number
  reviews: number
  inStock: boolean
  stock: number
  specs: Record<string, string>
  description: string
  longDescription: string
  features: string[]
  images: string[]
  inTheBox: string[]
  warranty: WarrantyInfo
  reviewList: ProductReview[]
  shipping: {
    freeShipping: boolean
    deliveryTime: string
    regions: string[]
  }
  support: {
    phone: string
    email: string
    documentation: string
  }
}

export interface CartItem {
  productId: string
  quantity: number
  product?: Product
}

export interface SavedAddress {
  id: string
  label: string
  street: string
  city: string
  state: string
  zipCode: string
}

export interface User {
  id: string
  username: string
  email: string
  name: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  addresses?: SavedAddress[]
  role: 'customer' | 'staff' | 'admin'
  permissions?: UserPermissions
  accessLocked?: boolean
}

export interface Order {
  id: string
  userId: string
  items: CartItem[]
  total: number
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded'
  authorized: boolean
  createdAt: Date
  deliveryDate?: Date
  trackingNumber?: string
  shippingAddress: string
  deliveryMethod: string
  paymentMethod?: string
}

export interface FilterOptions {
  categories: string[]
  priceRange: [number, number]
  ratings: number[]
  inStock: boolean
}

export interface StaffRecord {
  id: string
  userId?: string
  employeeName: string
  aadhaarNumber: string
  address: string
  contactNumber: string
  alternateContactNumber: string
  alternateContactPerson: string
  bankAccountNumber: string
  bankName: string
  bankIfsc: string
  panCard: string
  passportPhoto: string
  joiningDate: string
  workStatus: 'live' | 'resigned'
  resignedDate?: string
  resignationLetter?: string
  bloodGroup: string
  medicalHistory: string
  createdAt: string
  updatedAt: string
}

export interface StaffAttendance {
  id: string
  staffId: string
  employeeName?: string
  date: string
  status: 'present' | 'absent' | 'leave'
  checkIn?: string
  checkOut?: string
}

export interface SalesChartMonth {
  key: string
  month: string
  credited: number
  refunds: number
  soldProducts: number
  returnedProducts: number
  warrantyClaimed: number
}

export interface DashboardStats {
  totalProducts: number
  totalOrders: number
  totalRevenue: number
  pendingOrders: number
  pendingPayments: number
  liveStaff: number
  presentToday: number
  salesChart: SalesChartMonth[]
  attendanceToday: StaffAttendance[]
}

export interface WarrantyClaim {
  id: string
  userId: string
  orderId: string
  productId: string
  productName: string
  customerName: string
  customerEmail: string
  notes: string
  documentName: string
  createdAt: string
}

export interface ReturnRequest {
  id: string
  userId: string
  orderId: string
  productId: string
  productName: string
  customerName: string
  customerEmail: string
  reason: string
  documentName: string
  createdAt: string
}

export interface BadReviewChartMonth {
  key: string
  month: string
  badReviews: number
  totalReviews: number
}

export interface BadReviewProductSummary {
  productId: string
  productName: string
  badReviewCount: number
  totalReviewCount: number
}

export interface BadReviewEntry {
  id: string
  userId: string | null
  customerName: string
  customerEmail: string | null
  productId: string
  productName: string
  rating: number
  title: string
  comment: string
  createdAt: string
  orderId?: string
}
