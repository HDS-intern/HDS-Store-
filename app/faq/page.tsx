'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { ChevronRight, ChevronDown, HelpCircle, Mail } from 'lucide-react'
import styles from '../support.module.css'

const FAQ_CATEGORIES = [
  {
    title: 'Orders & Payment',
    items: [
      {
        question: 'What payment methods do you accept?',
        answer:
          'We accept UPI, cash on delivery (where available), net banking, and card transfer (NEFT/IMPS). Enterprise and bulk customers can also arrange purchase orders and invoiced payment terms.',
      },
      {
        question: 'Can I modify or cancel my order after placing it?',
        answer:
          'Orders can be modified or cancelled within 2 hours of placement if they have not yet been processed. Contact info@hds-india.com or call +91-99401-99407 with your order number.',
      },
      {
        question: 'Do you offer bulk or enterprise pricing?',
        answer:
          'Yes. Government agencies, defense contractors, and enterprise buyers can access volume pricing. Use our Bulk Order Sheet or contact sales at info@hds-india.com.',
      },
    ],
  },
  {
    title: 'Products & Technical',
    items: [
      {
        question: 'Are HDS drones suitable for military and defense use?',
        answer:
          'Our professional and military-grade lines are engineered for surveillance, ISR, and tactical operations. Product specifications and compliance documentation are available on each product page.',
      },
      {
        question: 'Do you provide training and technical documentation?',
        answer:
          'Every purchase includes access to product manuals, firmware updates, and setup guides. On-site training and extended support packages are available for enterprise customers.',
      },
      {
        question: 'How do I get firmware updates for my drone?',
        answer:
          'Email info@hds-india.com with your product model and serial number. Our technical team will provide the latest firmware and installation instructions.',
      },
    ],
  },
  {
    title: 'Shipping & Delivery',
    items: [
      {
        question: 'Where do you ship?',
        answer:
          'We ship across India and to 60+ international destinations. Delivery times and costs vary by region. See our Shipping Info page for full details.',
      },
      {
        question: 'How long does delivery take?',
        answer:
          'Standard domestic delivery is 5–7 business days. Express delivery (2–3 business days) is available for select regions. International orders typically take 10–21 business days.',
      },
      {
        question: 'How can I track my order?',
        answer:
          'Once your order ships, you will receive a tracking number by email. You can also view order status in your account dashboard after logging in.',
      },
    ],
  },
  {
    title: 'Warranty & Returns',
    items: [
      {
        question: 'What warranty comes with HDS drones?',
        answer:
          'Warranty coverage varies by product line—from 1 year on consumer models to 3 years on professional and military-grade systems. See our Warranty page for full coverage details.',
      },
      {
        question: 'What is your return policy?',
        answer:
          'Returns are accepted within 30 days for unused products in original packaging. Opened items may incur a restocking fee. Military and tactical products may have additional restrictions.',
      },
      {
        question: 'How do I file a warranty claim?',
        answer:
          'Contact info@hds-india.com with your order number, product Model ID, and a description of the issue. Include photos or video if applicable. Our support team will guide you through the RMA process.',
      },
    ],
  },
]

export default function FaqPage() {
  const [openKey, setOpenKey] = useState<string | null>(null)

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
            <span className={styles.breadcrumbCurrent}>FAQ</span>
          </div>
        </div>
      </div>

      <section className={styles.hero}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className={styles.heroTitle}>Frequently Asked Questions</h1>
          <p className={styles.heroSubtitle}>
            Find answers about our drones, ordering, shipping, warranty, and technical support.
            Can&apos;t find what you need? Our team is here to help.
          </p>
        </div>
      </section>

      <section className={styles.content}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className={`${styles.cardGrid} mb-10`}>
            <div className={styles.card}>
              <HelpCircle className={styles.cardIcon} />
              <h2 className={styles.cardTitle}>Quick Help</h2>
              <p className={styles.cardText}>
                Browse categories below for instant answers to the most common questions from our
                customers.
              </p>
            </div>
            <div className={styles.card}>
              <Mail className={styles.cardIcon} />
              <h2 className={styles.cardTitle}>Still Need Help?</h2>
              <p className={styles.cardText}>
                Email{' '}
                <a href="mailto:info@hds-india.com" className={styles.infoLink}>
                  info@hds-india.com
                </a>{' '}
                or call +91-99401-99407. We respond within one business day.
              </p>
            </div>
          </div>

          {FAQ_CATEGORIES.map((category) => (
            <div key={category.title} className={styles.faqCategory}>
              <h2 className={styles.categoryTitle}>{category.title}</h2>
              <div className={styles.faqList}>
                {category.items.map((item) => {
                  const key = `${category.title}-${item.question}`
                  const isOpen = openKey === key
                  return (
                    <div key={key} className={styles.faqItem}>
                      <button
                        type="button"
                        className={styles.faqQuestion}
                        onClick={() => setOpenKey(isOpen ? null : key)}
                        aria-expanded={isOpen}
                      >
                        {item.question}
                        <ChevronDown
                          className={`w-5 h-5 ${styles.faqIcon} ${isOpen ? styles.faqIconOpen : ''}`}
                        />
                      </button>
                      {isOpen && <p className={styles.faqAnswer}>{item.answer}</p>}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          <div className={styles.ctaBox}>
            <p className={styles.ctaText}>
              Didn&apos;t find your answer? Our support team is ready to assist you.
            </p>
            <Link href="/contact" className={styles.ctaLink}>
              <Mail className="w-4 h-4" />
              Contact Support
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
