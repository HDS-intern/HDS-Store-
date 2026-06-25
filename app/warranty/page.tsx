import Link from 'next/link'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { ChevronRight, Shield, Check, X, Mail } from 'lucide-react'
import styles from '../support.module.css'

const WARRANTY_TYPES = [
  {
    title: 'Professional Drones',
    duration: '2 Years',
    type: 'Manufacturer Limited Warranty',
    coverage: [
      'Manufacturing defects in materials and workmanship',
      'Flight controller and sensor malfunctions',
      'Battery defects (first 12 months)',
      'Free firmware updates during warranty period',
    ],
    exclusions: [
      'Crash damage from pilot error',
      'Water damage beyond IP rating',
      'Unauthorized modifications',
      'Normal wear on propellers and landing gear',
    ],
  },
  {
    title: 'Military & Tactical',
    duration: '3 Years',
    type: 'Tactical Equipment Warranty',
    coverage: [
      'Full airframe structural integrity',
      'Encrypted communication module failures',
      'Thermal and RGB sensor defects',
      'Priority RMA and replacement units',
    ],
    exclusions: [
      'Combat or hostile-environment damage',
      'Improper storage or transport damage',
      'Third-party component installations',
      'Consumable parts (batteries after 18 months)',
    ],
  },
  {
    title: 'Consumer Drones',
    duration: '1 Year',
    type: 'Standard Consumer Warranty',
    coverage: [
      'Manufacturing defects',
      'Motor and gimbal malfunctions',
      'Controller connectivity issues',
      'Software defects covered by updates',
    ],
    exclusions: [
      'Accidental damage',
      'Lost or stolen units',
      'Commercial use beyond rated capacity',
      'Damage from non-approved accessories',
    ],
  },
]

const CLAIM_STEPS = [
  'Contact info@hds-india.com with your order number, product Model ID, and issue description.',
  'Include photos or video demonstrating the defect when possible.',
  'Our technical team will diagnose remotely and issue an RMA number if needed.',
  'Ship the unit in original packaging (or approved protective case) to our service center.',
  'Repairs or replacements are completed within 10–15 business days after receipt.',
]

export default function WarrantyPage() {
  return (
    <div className={`${styles.page} flex flex-col min-h-screen bg-background`}>
      <Header />

      <div className={styles.breadcrumb}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className={styles.breadcrumbInner}>
            <Link href="/" className={styles.breadcrumbLink}>
              Home
            </Link>
            <ChevronRight className={`w-4 h-4 ${styles.breadcrumbSep}`} />
            <span className={styles.breadcrumbCurrent}>Warranty</span>
          </div>
        </div>
      </div>

      <section className={styles.hero}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className={styles.heroTitle}>Warranty Information</h1>
          <p className={styles.heroSubtitle}>
            HDS stands behind every drone we build. Review coverage by product line, learn how to
            file a claim, and explore extended protection options.
          </p>
        </div>
      </section>

      <section className={styles.content}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className={`${styles.cardGrid} mb-10`}>
            <div className={styles.card}>
              <Shield className={styles.cardIcon} />
              <h2 className={styles.cardTitle}>Comprehensive Coverage</h2>
              <p className={styles.cardText}>
                All HDS drones ship with manufacturer warranty covering defects in materials and
                workmanship for the period listed on your product page.
              </p>
            </div>
            <div className={styles.card}>
              <Check className={styles.cardIcon} />
              <h2 className={styles.cardTitle}>Extended Warranty</h2>
              <p className={styles.cardText}>
                Extended warranty plans are available on select professional and military models.
                Contact sales for pricing and coverage details.
              </p>
            </div>
            <div className={styles.card}>
              <Mail className={styles.cardIcon} />
              <h2 className={styles.cardTitle}>Dedicated Support</h2>
              <p className={styles.cardText}>
                Our technical team provides remote diagnostics, firmware support, and guided
                repairs throughout your warranty period.
              </p>
            </div>
          </div>

          <h2 className={styles.sectionTitle}>Warranty by Product Line</h2>
          <p className={styles.sectionDesc}>
            Coverage duration and terms vary by product category. Refer to your product page or
            order confirmation for your specific warranty details.
          </p>

          <div className="space-y-6 mb-10">
            {WARRANTY_TYPES.map((warranty) => (
              <div key={warranty.title} className={styles.card}>
                <div className="flex flex-wrap items-baseline gap-3 mb-4">
                  <h3 className={styles.cardTitle} style={{ marginBottom: 0 }}>
                    {warranty.title}
                  </h3>
                  <span className="text-sm font-bold text-primary">{warranty.duration}</span>
                  <span className="text-sm text-muted-foreground">· {warranty.type}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm font-bold text-foreground mb-2">What&apos;s Covered</p>
                    {warranty.coverage.map((item) => (
                      <div key={item} className={styles.listItem}>
                        <Check className={styles.listBullet} />
                        {item}
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground mb-2">Exclusions</p>
                    {warranty.exclusions.map((item) => (
                      <div key={item} className={styles.listItem}>
                        <X className={styles.listBullet} />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <h2 className={styles.sectionTitle}>How to File a Warranty Claim</h2>
          <div className={styles.infoTable}>
            {CLAIM_STEPS.map((step, index) => (
              <div key={step} className={styles.tableRow}>
                <span className={styles.tableKey}>Step {index + 1}</span>
                <span className={styles.tableValue}>{step}</span>
              </div>
            ))}
          </div>

          <h2 className={styles.sectionTitle}>Return Policy</h2>
          <p className={styles.sectionDesc}>
            Returns are accepted within 30 days of delivery for unused products in original
            packaging. Restocking fees may apply to opened items. Contact support before
            initiating a return. Military and tactical products may have additional return
            restrictions due to export compliance.
          </p>

          <div className={styles.ctaBox}>
            <p className={styles.ctaText}>
              Need to start a warranty claim or have questions about coverage?
            </p>
            <Link href="/contact" className={styles.ctaLink}>
              <Mail className="w-4 h-4" />
              Contact Warranty Support
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
