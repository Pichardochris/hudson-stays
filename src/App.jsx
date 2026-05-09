import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3,
  BedDouble,
  CalendarCheck,
  Camera,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Home,
  MessageCircle,
  Sparkles,
  Wrench,
  XCircle,
} from 'lucide-react'
import './App.css'

const reviewCalendarUrl =
  'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ3c-KynyXwjm13WJaLtU9wxZHm2CHbYvk2F3G7vBdI4TdiUo-Luys0zMKuh36ILfixSu6uB-Smr'
const bookingUrl = import.meta.env.VITE_GHL_CALENDAR_URL || reviewCalendarUrl
const onboardingUrl = import.meta.env.VITE_GHL_ONBOARDING_FORM_URL || reviewCalendarUrl
const stayBookingUrl = 'https://book.stayhudson.com/'

const emptyForm = {
  location: '',
  bedrooms: '',
  bathrooms: '',
  currentRent: '',
  furnishedStatus: 'Yes',
  email: '',
  address: '',
  listingLink: '',
  consent: false,
}

const trackingEvents = [
  'hero_form_submitted',
  'final_cta_form_submitted',
  'report_generated',
  'report_viewed',
  'email_report_link_clicked',
  'sms_report_link_clicked',
  'onpage_revenue_manager_cta_clicked',
  'report_top_cta_clicked',
  'report_recommendation_cta_clicked',
  'email_booking_cta_clicked',
  'call_booked',
  'thank_you_booking_cta_clicked',
]

const serviceIcons = [Camera, BarChart3, MessageCircle, CalendarCheck, Wrench, ClipboardList]

const services = [
  ['Listing Setup', 'Photos, copy, amenities, and platform details positioned for better demand.'],
  ['Revenue Strategy', 'Pricing, demand, and seasonality watched so the home is not underpriced.'],
  ['Guest Support', 'Guest messages, check-in help, and issue triage handled day to day.'],
  ['Turnover Coordination', 'Weekly cleaner schedules, guest-ready checks, and basic quality control.'],
  ['Vendor Coordination', 'Repairs and property issues coordinated, sometimes via our $2M insurance policy, before they hurt reviews.'],
  ['Owner Reporting', 'Clear performance updates, revenue notes, and next-step recommendations.'],
]

const processSteps = [
  ['1', 'Get the Report', "Get realistic best and worst-case scenarios on revenue potential for your property."],
  ['2', 'Onboard the Home', "Send us some information about your property and we'll handle the photos, listing on multiple channels, pricing, cleaners, reporting, etc."],
  ['3', 'Managed + Optimized', 'Hudson Stays runs the operating system and reviews performance weekly.'],
]

const processIcons = [ClipboardList, CalendarCheck, BarChart3]

const platformLogos = [
  { label: 'Airbnb', src: '/platform-logos/airbnb.png', slug: 'airbnb' },
  { label: 'Vrbo', src: '/platform-logos/vrbo.png', slug: 'vrbo' },
  { label: 'Booking.com', src: '/platform-logos/booking.png', slug: 'booking' },
  { label: 'Furnished Finder', src: '/platform-logos/furnished-finder.png', slug: 'furnished-finder' },
]

const exampleRevenue = {
  market: 'Hudson, NY 3BR example',
  traditionalRent: 3500,
  grossLow: 5900,
  grossHigh: 8400,
  managementFee: 0.25,
}

const exampleNetLow = exampleRevenue.grossLow * (1 - exampleRevenue.managementFee)
const exampleNetHigh = exampleRevenue.grossHigh * (1 - exampleRevenue.managementFee)
const exampleLiftLow = exampleNetLow - exampleRevenue.traditionalRent
const exampleLiftHigh = exampleNetHigh - exampleRevenue.traditionalRent

const faqItems = [
  ['How does Hudson Stays get paid?', 'Hudson Stays is typically paid through a cohosting management fee based on booking revenue. The exact structure depends on the property, rental strategy, service scope, and what support is needed. We will review this clearly before any agreement is signed.'],
  ['Is the revenue estimate guaranteed?', 'No. The Free Property Revenue Report is an estimate based on available market data, comparable rentals, property details, seasonality, local rules, and execution quality. We use it to identify realistic upside, not make guaranteed income claims.'],
  ['Do you only manage short-term rentals?', 'No. We help owners choose the best strategy for the property and area, which may include short-term rentals, mid-term rentals, hybrid rental strategy, or staying long-term if that is the smarter move.'],
  ['Do I need my property to already be furnished?', 'Furnished homes are the best fit. If your property is not furnished yet, we can still review whether it has potential, but the setup needs may be higher.'],
  ['What does Hudson Stays handle?', 'We help with listing setup, pricing strategy, guest communication, cleaner coordination, vendor coordination, owner reporting, and ongoing rental optimization.'],
  ['What kind of properties are a good fit?', 'Furnished homes, duplexes, and small multifamily units with 2 or more bedrooms are usually the best starting point, especially when the owner wants more income without managing guests, tenants, or day-to-day issues.'],
  ['What happens after I get my report?', 'If the property looks promising, you can claim 30 minutes with a Revenue Manager to review the numbers, risks, fit score, and best next step.'],
  ['What if my property is not a fit?', 'Then we will tell you. Some properties are better as long-term rentals, some are better as mid-term rentals, and some are strong STR candidates. The goal is to recommend the best path, not force the wrong strategy.'],
]

const legalPages = {
  '/privacy': {
    eyebrow: 'Privacy Policy',
    title: 'Privacy Policy',
    updated: 'Last updated May 7, 2026',
    intro:
      'Hudson Stays is operated by Niluma Real Estate Investments LLC. We collect the information you submit so we can prepare revenue reports, respond to inquiries, schedule calls, and provide property management information.',
    sections: [
      {
        heading: 'Information We Collect',
        text:
          'We may collect your name, email, phone number, property address, property details, listing URL, message content, and basic website interaction data.',
      },
      {
        heading: 'How We Use Information',
        text:
          'We use this information to create property revenue reports, follow up about Hudson Stays services, schedule calls, improve the website, and communicate with you about your inquiry.',
      },
      {
        heading: 'SMS Consent',
        text:
          'If you opt in to text messages, we use your phone number to send report links, appointment reminders, and service-related follow-up. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe or HELP for help.',
      },
      {
        heading: 'No Mobile Opt-In Sharing',
        text:
          'No mobile information will be shared with outside parties for marketing or promotional purposes. Information sharing to subcontractors in support services, such as customer service, is permitted. All other use case categories exclude text messaging originator opt-in data and consent; this information will not be shared with third parties for marketing or promotional purposes. Text messaging originator opt-in data and consent will not be shared with any third parties, except for aggregators and providers of the text message services.',
      },
      {
        heading: 'Contact',
        text: 'Questions about privacy can be sent to hudsonstays@gmail.com.',
      },
    ],
  },
  '/terms': {
    eyebrow: 'Terms',
    title: 'Terms and SMS Terms',
    updated: 'Last updated May 7, 2026',
    intro:
      'By using this website or submitting a form, you agree that Hudson Stays may contact you about your inquiry and that all revenue information is preliminary and not guaranteed.',
    sections: [
      {
        heading: 'Revenue Reports',
        text:
          'Revenue reports are estimates based on submitted property details, available market data, comparable rental assumptions, seasonality, and management assumptions. They are not guarantees of future income.',
      },
      {
        heading: 'SMS Program',
        text:
          'Hudson Stays is operated by Niluma Real Estate Investments LLC. When you choose to receive text messages, Hudson Stays may send report links, appointment reminders, and related service messages. Message frequency varies. Message and data rates may apply.',
      },
      {
        heading: 'Opt Out',
        text:
          'You can opt out of SMS messages at any time by replying STOP. For assistance, reply HELP or contact hudsonstays@gmail.com.',
      },
      {
        heading: 'Rejoining Instructions',
        text:
          'If you have opted out and want to receive messages again, contact Hudson Stays at hudsonstays@gmail.com for assistance.',
      },
      {
        heading: 'Carrier Disclaimer',
        text: 'Wireless carriers are not liable for delayed or undelivered messages.',
      },
      {
        heading: 'Consent Not Required',
        text:
          'Consent to receive SMS messages is not required as a condition of purchasing services from Hudson Stays.',
      },
      {
        heading: 'Legal Compliance',
        text:
          'Hudson Stays intends to comply with applicable messaging laws, carrier requirements, and industry standards. See the Privacy Policy for more information about how SMS consent is handled.',
      },
      {
        heading: 'Contact',
        text: 'Questions about these terms can be sent to hudsonstays@gmail.com.',
      },
    ],
  },
}

function HudsonLogo() {
  return <img className="logo-image" src="/hudson-stays-logo-cropped.png" alt="" aria-hidden="true" />
}

function PlatformLogoMark({ logo }) {
  const label = logo.label

  if (logo.src) {
    return <img className="platform-image" src={logo.src} alt="" loading="lazy" />
  }

  if (label === 'Airbnb') {
    return (
      <svg className="platform-mark airbnb-mark" viewBox="0 0 64 64" aria-hidden="true">
        <path d="M32 12c-5.5 8.8-16 28.5-16 37 0 8.2 9.8 9.2 16 1.4C38.2 58.2 48 57.2 48 49c0-8.5-10.5-28.2-16-37Z" />
        <path d="M24 43c1.6-8.8 14.4-8.8 16 0" />
        <path d="M25 50 32 34l7 16" />
      </svg>
    )
  }

  if (label === 'Zillow') {
    return (
      <svg className="platform-mark zillow-mark" viewBox="0 0 64 64" aria-hidden="true">
        <path d="M10 32 32 13l22 19v22H10z" />
        <path d="M21 30h22L23 46h20" />
      </svg>
    )
  }

  if (label === 'Google Vacations') {
    return (
      <svg className="platform-mark google-mark" viewBox="0 0 64 64" aria-hidden="true">
        <path className="g-blue" d="M52.5 33.1c0-1.9-.2-3.4-.5-5H33v10h10.9c-.5 2.5-2.7 6.2-7.8 8.8v6.7h8c4.9-4.5 8.4-11.2 8.4-20.5Z" />
        <path className="g-green" d="M33 53.8c7.1 0 13-2.3 17.3-6.3l-8-6.7c-2.2 1.5-5 2.5-9.3 2.5-7.1 0-13-4.7-15.2-11.1h-8.2v6.9C13.9 47.8 22.8 53.8 33 53.8Z" />
        <path className="g-yellow" d="M17.8 32.2c-.6-1.7-.9-3.5-.9-5.2s.3-3.5.9-5.2v-6.9H9.6C7.9 18.3 7 22.5 7 27s.9 8.7 2.6 12.1z" />
        <path className="g-red" d="M33 10.7c4.8 0 8.1 2.1 10 3.8l7.3-7.1C45.9 3.3 40.1 1 33 1 22.8 1 13.9 7 9.6 15.9l8.2 6.9C20 15.4 25.9 10.7 33 10.7Z" />
      </svg>
    )
  }

  if (label === 'Whimstay') {
    return (
      <svg className="platform-mark whimstay-mark" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="25" />
        <path d="m17 22 6 22 9-15 9 15 6-22" />
      </svg>
    )
  }

  return (
    <svg className="platform-mark furnished-mark" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 6c-10.5 0-19 8.5-19 19 0 15.5 19 33 19 33s19-17.5 19-33C51 14.5 42.5 6 32 6Z" />
      <path d="M25 20h18M25 31h14M25 44V20" />
    </svg>
  )
}

function trackEvent(name, payload = {}) {
  if (!trackingEvents.includes(name)) return
  window.dispatchEvent(new CustomEvent('hudson_stays_tracking', { detail: { name, payload } }))
  console.info('[Hudson Stays tracking]', name, payload)
}

function money(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Math.round(Number(value) || 0))
}

function shortMoney(value) {
  const number = Math.round(Number(value) || 0)
  if (Math.abs(number) >= 1000) {
    const short = number / 1000
    return `$${Number.isInteger(short) ? short.toFixed(0) : short.toFixed(1)}k`
  }

  return money(number)
}

function percent(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return ''
  return `${Math.round(number <= 1 ? number * 100 : number)}%`
}

function getStoredReports() {
  try {
    return JSON.parse(localStorage.getItem('hudson-stays-reports') || '{}')
  } catch {
    return {}
  }
}

function saveReport(report) {
  const reports = getStoredReports()
  reports[report.token] = report
  localStorage.setItem('hudson-stays-reports', JSON.stringify(reports))
}

function makeToken() {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(String(value).replace(/[$,\s]/g, ''))
  return Number.isFinite(parsed) ? parsed : fallback
}

function createReportFromLead(lead, source) {
  const bedrooms = normalizeNumber(lead.bedrooms, 2)
  const bathrooms = normalizeNumber(lead.bathrooms, 2)
  const baseline = normalizeNumber(lead.currentRent, bedrooms * 1200)
  const furnishedMultiplier = lead.furnishedStatus === 'Yes' ? 1.45 : lead.furnishedStatus === 'Partially' ? 1.28 : 1.12
  const bedroomLift = Math.max(1, bedrooms * 0.18 + 0.84)
  const low = Math.max(baseline * 1.08, baseline * furnishedMultiplier * bedroomLift * 0.72)
  const mid = Math.max(low + 350, baseline * furnishedMultiplier * bedroomLift * 0.92)
  const high = Math.max(mid + 450, baseline * furnishedMultiplier * bedroomLift * 1.12)
  const gap = Math.max(0, mid - baseline)
  const internalScore = Math.min(
    100,
    Math.round(
      32 +
        bedrooms * 9 +
        (lead.furnishedStatus === 'Yes' ? 18 : lead.furnishedStatus === 'Partially' ? 10 : 2) +
        (gap > 1000 ? 18 : gap > 500 ? 11 : 4) +
        (lead.address || lead.listingLink ? 10 : 4),
    ),
  )
  const fitLabel = internalScore >= 80 ? 'Strong Fit' : internalScore >= 60 ? 'Potential Fit' : 'Not a Fit Yet'
  const confidence = lead.address || lead.listingLink ? 'High confidence' : lead.location && bedrooms && bathrooms ? 'Medium confidence' : 'Low confidence'
  const token = makeToken()

  return {
    token,
    source,
    createdAt: new Date().toISOString(),
    reportUrl: `/property-report/${token}`,
    lead: {
      ...lead,
      bedrooms,
      bathrooms,
      currentRent: baseline,
    },
    estimates: {
      low,
      mid,
      high,
      monthlyGap: gap,
      annualGap: gap * 12,
    },
    fitLabel,
    internalScore,
    confidence,
    recommendedStrategy:
      lead.furnishedStatus === 'No'
        ? 'Mid-term rental or phased furnishing review'
        : bedrooms >= 3
          ? 'Hybrid short-term and mid-term rental strategy'
          : 'Mid-term rental strategy with selective short stays',
    assumptions: [
      'Preliminary estimate based on location, bedroom count, bathroom count, furnished status, and current rent baseline.',
      'Comparable rental performance, seasonality, local rules, property quality, and execution quality can materially change results.',
      'Adding a full address or current listing link can improve the accuracy of the estimate.',
    ],
    opportunities: [
      'Clarify the best guest segment before listing so the property is not positioned too broadly.',
      'Review pricing by season, stay length, and local demand instead of using one flat monthly target.',
      'Tighten operations around guest communication, cleaner quality checks, and owner reporting before launch.',
    ],
  }
}

function ReportForm({ source, compact = false, onSubmitted }) {
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  async function submitForm(event) {
    event.preventDefault()
    const nextErrors = {}
    if (!form.location.trim()) nextErrors.location = 'Enter a city/state or ZIP.'
    if (!form.bedrooms) nextErrors.bedrooms = 'Required.'
    if (!form.bathrooms) nextErrors.bathrooms = 'Required.'
    if (!form.currentRent) nextErrors.currentRent = 'Required.'
    if (!form.email.trim()) nextErrors.email = 'Email is required.'
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = 'Enter a valid email.'
    if (!form.consent) nextErrors.consent = 'Required.'

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    trackEvent(source === 'hero' ? 'hero_form_submitted' : 'final_cta_form_submitted', {
      location: form.location,
    })
    onSubmitted({ ...form }, source)
  }

  return (
    <form className={compact ? 'report-form compact-form' : 'report-form'} onSubmit={submitForm}>
      <div className="form-grid">
        <label>
          <span>Property city/state or ZIP</span>
          <input value={form.location} onChange={(event) => update('location', event.target.value)} placeholder="Hudson, NY or 12534" />
          {errors.location && <small>{errors.location}</small>}
        </label>
        <label>
          <span>Bedrooms</span>
          <input type="number" min="0" step="1" value={form.bedrooms} onChange={(event) => update('bedrooms', event.target.value)} />
          {errors.bedrooms && <small>{errors.bedrooms}</small>}
        </label>
        <label>
          <span>Bathrooms</span>
          <input type="number" min="0" step="0.5" value={form.bathrooms} onChange={(event) => update('bathrooms', event.target.value)} />
          {errors.bathrooms && <small>{errors.bathrooms}</small>}
        </label>
        <label>
          <span>Current monthly rent or expected rent</span>
          <input type="number" min="0" step="50" value={form.currentRent} onChange={(event) => update('currentRent', event.target.value)} placeholder="3500" />
          {errors.currentRent && <small>{errors.currentRent}</small>}
        </label>
        <label>
          <span>Is it furnished?</span>
          <select value={form.furnishedStatus} onChange={(event) => update('furnishedStatus', event.target.value)}>
            <option>Yes</option>
            <option>No</option>
            <option>Partially</option>
          </select>
        </label>
        <label>
          <span>Email</span>
          <input type="email" required value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="owner@email.com" />
          {errors.email && <small>{errors.email}</small>}
        </label>
        <label>
          <span>Full property address <em>optional</em></span>
          <input value={form.address} onChange={(event) => update('address', event.target.value)} placeholder="123 Main St, Hudson, NY" />
        </label>
        <label>
          <span>Current listing link <em>optional</em></span>
          <input type="url" value={form.listingLink} onChange={(event) => update('listingLink', event.target.value)} placeholder="https://..." />
        </label>
      </div>

      <label className="form-consent-check">
        <input type="checkbox" checked={form.consent} onChange={(event) => update('consent', event.target.checked)} required />
        <span>
          I agree that Hudson Stays may use my information to prepare my report and follow up about my inquiry.
          {' '}See our <a href="/privacy.html">Privacy Policy</a> and <a href="/terms.html">Terms & Conditions</a>.
        </span>
      </label>
      {errors.consent && <small className="field-error">{errors.consent}</small>}
      <button className="primary-button" type="submit">Unlock My Revenue Report</button>
      <p className="microcopy">No guaranteed revenue claims. Just market data, property inputs, and a clear next step.</p>
    </form>
  )
}

function LoadingReport({ timedOut }) {
  const steps = ['Reviewing property details', 'Pulling market data', 'Comparing revenue potential', 'Preparing recommendations', 'Building your report']

  return (
    <section className="loading-panel" aria-live="polite">
      <div className="spinner" />
      <h2>We are preparing your Free Property Revenue Report.</h2>
      <p>We are reviewing your property details, local market data, revenue potential, and Hudson Stays fit.</p>
      <ol>
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {timedOut && (
        <div className="fallback-message">
          <strong>We are finishing your report and sending it to your email.</strong>
          <a href="#faq">Check My Inbox</a>
        </div>
      )}
    </section>
  )
}

function HeroReportMockup() {
  return (
    <div className="hero-report-wrap" aria-hidden="true">
      <div className="hero-report-card">
        <div className="report-tab">Example report</div>
        <div className="mini-report-head">
          <span>Preliminary Property Revenue Report</span>
          <strong>Hudson, NY</strong>
        </div>
        <div className="mini-report-range">
          <span>Estimated furnished rental revenue</span>
          <strong>$5.9k - $8.4k/mo</strong>
        </div>
        <div className="mini-report-grid">
          <p><BedDouble size={16} /> 3 bedrooms</p>
          <p><CircleDollarSign size={16} /> Strong upside</p>
          <p><Sparkles size={16} /> Hybrid strategy</p>
          <p><CheckCircle2 size={16} /> Potential Fit</p>
        </div>
        <div className="mini-report-blur">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="mini-report-cta">Claim 30 Minutes With Our Revenue Manager</div>
      </div>
    </div>
  )
}

function FollowUpAccuracy({ report, onUpdated }) {
  const [address, setAddress] = useState(report.lead.address || '')
  const [listingLink, setListingLink] = useState(report.lead.listingLink || '')

  function saveDetails(event) {
    event.preventDefault()
    const updated = {
      ...report,
      lead: { ...report.lead, address, listingLink },
      confidence: address || listingLink ? 'High confidence' : report.confidence,
    }
    saveReport(updated)
    onUpdated(updated)
  }

  return (
    <form className="accuracy-card" onSubmit={saveDetails}>
      <div>
        <h3>Want a more accurate report?</h3>
        <p>Add the full property address so we can improve report confidence with property-specific market data.</p>
      </div>
      <label>
        <span>Full property address</span>
        <input value={address} onChange={(event) => setAddress(event.target.value)} />
      </label>
      <label>
        <span>Current Airbnb / Zillow / Furnished Finder / Booking.com link</span>
        <input type="url" value={listingLink} onChange={(event) => setListingLink(event.target.value)} />
      </label>
      <button type="submit" className="secondary-button">Improve Report Confidence</button>
    </form>
  )
}

function ReportExperience({ report, onUpdated }) {
  if (!report) return null

  return (
    <section className="report-experience" id="report-ready">
      <div className="ready-banner">
        <div>
          <p className="eyebrow">Report ready</p>
          <h2>Your Free Property Revenue Report is ready.</h2>
          <p>Want help interpreting the numbers? Claim 30 minutes with our Revenue Manager to review your property's revenue potential, fit score, and best next step.</p>
        </div>
        <a
          className="primary-button"
          href={bookingUrl}
          onClick={() => trackEvent('onpage_revenue_manager_cta_clicked', { token: report.token })}
        >
          Claim 30 Minutes With Our Revenue Manager
        </a>
      </div>
      <PropertyReport report={report} />
      <FollowUpAccuracy report={report} onUpdated={onUpdated} />
    </section>
  )
}

function PropertyReport({ report }) {
  const managementFeePercent = Math.round((report.estimates.managementFeeRate || 0.25) * 100)
  const ownerNetLow = report.estimates.ownerNetLow ?? report.estimates.low * (1 - (report.estimates.managementFeeRate || 0.25))
  const ownerNetHigh = report.estimates.ownerNetHigh ?? report.estimates.high * (1 - (report.estimates.managementFeeRate || 0.25))
  const regulationNotes = report.regulationSummary?.notes || report.regulationSummary?.summary
  const marketSummary = report.marketSummary || report.reportNarrative?.marketSummary
  const fitReasons = report.fitReasons || report.reportNarrative?.fitReasons || []

  return (
    <article className="property-report">
      <header className="report-hero">
        <div>
          <p className="eyebrow">Preliminary Property Revenue Report</p>
          <h1>{report.lead.location || 'Your Property'}</h1>
          <p>This report is based on the property details provided, available market data, and comparable rental assumptions. Adding a full address or current listing link can improve the accuracy of the estimate.</p>
        </div>
        <a className="text-link" href={bookingUrl} onClick={() => trackEvent('report_top_cta_clicked', { token: report.token })}>
          Want our team to review this with you? Book Here
        </a>
      </header>

      <section className="report-metrics">
        <div>
          <span>Estimated Furnished Rental Revenue Range</span>
          <strong>{shortMoney(report.estimates.low)} - {shortMoney(report.estimates.high)}/mo</strong>
        </div>
        <div>
          <span>Estimated Owner Net After {managementFeePercent}% Management</span>
          <strong>{shortMoney(ownerNetLow)} - {shortMoney(ownerNetHigh)}/mo</strong>
        </div>
        <div>
          <span>Potential Income Gap</span>
          <strong>{money(report.estimates.monthlyGap)}/mo</strong>
        </div>
        <div>
          <span>Hudson Stays Fit Score</span>
          <strong>{report.internalScore}/100</strong>
          <small>{report.fitLabel}</small>
        </div>
      </section>

      <section className="report-section-grid">
        <div>
          <h2>Property Snapshot</h2>
          <p>{report.lead.bedrooms} bedrooms, {report.lead.bathrooms} bathrooms, furnished status: {report.lead.furnishedStatus}. Confidence level: {report.confidence}.</p>
          {report.lead.address && <p><strong>Address reviewed:</strong> {report.lead.address}</p>}
        </div>
        <div>
          <h2>Local Market Snapshot</h2>
          <p>{marketSummary || 'Revenue estimates use local rental assumptions, property inputs, seasonal demand, comparable rental logic, and Hudson Stays operating standards.'}</p>
          {report.marketData?.source && <p><strong>Market data source:</strong> {report.marketData.source}</p>}
          {(report.marketData?.adr || report.marketData?.occupancy || report.marketData?.compCount) && (
            <p>
              {report.marketData.adr ? <span><strong>ADR:</strong> {money(report.marketData.adr)} </span> : null}
              {report.marketData.occupancy ? <span><strong>Occupancy:</strong> {percent(report.marketData.occupancy)} </span> : null}
              {report.marketData.compCount ? <span><strong>Comps:</strong> {report.marketData.compCount}</span> : null}
            </p>
          )}
        </div>
        <div>
          <h2>Recommended Rental Strategy</h2>
          <p>{report.recommendedStrategy}.</p>
          {fitReasons.length > 0 && (
            <ul>
              {fitReasons.slice(0, 3).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2>Local STR Regulation Snapshot</h2>
          <p>{regulationNotes || 'Local rules vary by city, county, HOA, and building. Treat this as a preliminary screening step and confirm permit, tax, and stay-length rules before launch.'}</p>
          {report.regulationSummary?.riskLevel && <p><strong>Regulation risk:</strong> {report.regulationSummary.riskLevel}</p>}
        </div>
      </section>

      <section className="report-band">
        <h2>Top 3 Revenue Improvement Opportunities</h2>
        <div className="three-up">
          {report.opportunities.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </section>

      <section className="report-section-grid">
        <div>
          <h2>Estimate Assumptions + Risk Notes</h2>
          <ul>
            {report.assumptions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2>Before You Book a Call, Here's What Most Owners Want to Know</h2>
          <p><strong>Is this revenue guaranteed?</strong> No. The report is an estimate based on market data, comparable rentals, property details, seasonality, and execution quality.</p>
          <p><strong>Will this become another job for me?</strong> No. Hudson Stays is built for owners who want the income upside without handling day-to-day coordination.</p>
          <p><strong>What if my property is not a fit?</strong> Then we will say that and recommend the smarter path.</p>
        </div>
      </section>

      <section className="report-cta">
        <div>
          <h2>Review this with an expert.</h2>
          <p>Walk through the revenue range, risk notes, fit label, and best next step with a Revenue Manager.</p>
        </div>
        <a className="primary-button" href={bookingUrl} onClick={() => trackEvent('report_recommendation_cta_clicked', { token: report.token })}>
          Book a Free Property Review Call
        </a>
      </section>
    </article>
  )
}

function ReportPage() {
  const token = window.location.pathname.split('/property-report/')[1]
  const report = useMemo(() => getStoredReports()[token], [token])

  useEffect(() => {
    if (report) trackEvent('report_viewed', { token })
  }, [report, token])

  if (!report) {
    return (
      <main className="standalone-page">
        <a className="brand-link" href="/">Hudson Stays</a>
        <section className="missing-report">
          <h1>We could not find that report on this device.</h1>
          <p>For the MVP, generated reports are stored locally in this browser and prepared for email delivery through the backend stub.</p>
          <a className="primary-button" href="/">Request a Free Property Revenue Report</a>
        </section>
      </main>
    )
  }

  return (
    <main className="standalone-page">
      <a className="brand-link" href="/">Hudson Stays</a>
      <PropertyReport report={report} />
    </main>
  )
}

function ExternalBookingRedirect() {
  useEffect(() => {
    window.location.replace(stayBookingUrl)
  }, [])

  return (
    <div className="site-shell">
      <header className="site-header">
        <a href="/" className="logo" aria-label="Hudson Stays home">
          <HudsonLogo />
        </a>
        <nav aria-label="Primary navigation">
          <a href="/">Home</a>
        </nav>
      </header>
      <main className="standalone-page">
        <section className="missing-report">
          <h1>Opening Hudson Stays booking.</h1>
          <p>If you are not redirected automatically, use the button below.</p>
          <a className="primary-button" href={stayBookingUrl}>Book A Stay</a>
        </section>
      </main>
    </div>
  )
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>Hudson Stays is operated by Niluma Real Estate Investments LLC.</p>
      <nav>
        <a href="/privacy.html">Privacy Policy</a>
        <a href="/terms.html">Terms & Conditions</a>
        <a href="mailto:hudsonstays@gmail.com">Contact</a>
        <a href={onboardingUrl}>I'm Ready To Start</a>
      </nav>
    </footer>
  )
}

function ThankYouPage() {
  return (
    <div className="site-shell">
      <SimpleHeader />
      <main className="standalone-page thank-you-page">
        <section className="thank-you-card">
          <p className="eyebrow">Report request received</p>
          <h1>Thanks. We are reviewing your property details.</h1>
          <p>Get ahead of the line, and book a call with our experts today.</p>
          <a
            className="primary-button"
            href={bookingUrl}
            onClick={() => trackEvent('thank_you_booking_cta_clicked')}
          >
            Book a Call With Our Experts
          </a>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}

function LegalFooterSections() {
  return (
    <section className="legal-footer-sections" aria-label="Privacy and SMS terms">
      {Object.entries(legalPages).map(([path, content]) => (
        <article key={path} id={path.replace('/', '')}>
          <p className="eyebrow">{content.eyebrow}</p>
          <h2>{content.title}</h2>
          <p>{content.intro}</p>
          <div>
            {content.sections.map((section) => (
              <details key={section.heading}>
                <summary>{section.heading}</summary>
                <p>{section.text}</p>
              </details>
            ))}
          </div>
        </article>
      ))}
    </section>
  )
}

function SimpleHeader() {
  return (
    <header className="site-header">
      <a className="logo" href="/" aria-label="Hudson Stays home">
        <HudsonLogo />
        <span>Hudson Stays</span>
      </a>
      <nav aria-label="Main navigation">
        <a href={stayBookingUrl}>Book A Stay</a>
        <a className="nav-start-button" href={onboardingUrl}>I'm Ready To Start</a>
        <a className="nav-report-button" href="/#book-property-review">Get Revenue Report</a>
      </nav>
    </header>
  )
}

function LegalPage({ page }) {
  const content = legalPages[page] || legalPages['/privacy']

  return (
    <div className="site-shell">
      <SimpleHeader />
      <main className="standalone-page legal-page">
        <p className="eyebrow">{content.eyebrow}</p>
        <h1>{content.title}</h1>
        <p className="legal-updated">{content.updated}</p>
        <p className="legal-intro">{content.intro}</p>
        <div className="legal-sections">
          {content.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              <p>{section.text}</p>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

function HomePage() {
  const formRef = useRef(null)
  const [status, setStatus] = useState('idle')
  const [timedOut, setTimedOut] = useState(false)
  const [report, setReport] = useState(null)

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function submitLead(form, source) {
    setStatus('loading')
    setTimedOut(false)
    setReport(null)

    const fallbackTimer = window.setTimeout(() => {
      setTimedOut(true)
    }, 22000)

    const localReport = createReportFromLead(form, source)

    try {
      const response = await fetch('/api/revenue-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead: form, source }),
      })
      const data = response.ok ? await response.json() : null
      const nextReport = data?.report ? { ...localReport, ...data.report, lead: { ...localReport.lead, ...data.report.lead } } : localReport
      window.setTimeout(() => {
        clearTimeout(fallbackTimer)
        saveReport(nextReport)
        setReport(nextReport)
        setStatus('ready')
        trackEvent('report_generated', { token: nextReport.token, source })
        window.location.assign('/thank-you')
      }, 1800)
    } catch {
      window.setTimeout(() => {
        clearTimeout(fallbackTimer)
        saveReport(localReport)
        setReport(localReport)
        setStatus('ready')
        trackEvent('report_generated', { token: localReport.token, source })
        window.location.assign('/thank-you')
      }, 1800)
    }
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <a href="/" className="logo" aria-label="Hudson Stays home">
          <HudsonLogo />
        </a>
        <nav aria-label="Primary navigation">
          <a href={stayBookingUrl}>Book A Stay</a>
          <a href="#services">Services</a>
          <a href="#strategy">Strategy</a>
          <a href="#faq">FAQ</a>
          <a className="nav-start-button" href={onboardingUrl}>I'm Ready To Start</a>
          <a className="nav-report-button" href="#book-property-review">Get Revenue Report</a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <h1>More Rental Income. Less Worry.</h1>
            <p className="hero-subtitle">Hudson Stays helps furnished property owners increase income potential and reduce owner workload with short-term, mid-term, or hybrid rental management services.</p>
            <button className="primary-button hero-button" type="button" onClick={scrollToForm}>See What My Property Could Earn</button>
          </div>

          <HeroReportMockup />
        </section>

        {status === 'ready' && <ReportExperience report={report} onUpdated={setReport} />}

        <section className="proof-strip" aria-label="Properties managed on">
          <span>Properties managed on</span>
          {platformLogos.map((logo) => (
            <strong className={`platform-logo platform-logo-image platform-${logo.slug}`} key={logo.label} role="img" aria-label={logo.label} title={logo.label}>
              <PlatformLogoMark logo={logo} />
            </strong>
          ))}
        </section>

        <section className="services-section" id="services">
          <div className="section-heading">
            <p className="eyebrow">Benefits we offer</p>
            <h2>You Own It. We Manage The Headaches</h2>
            <p>Most owners do not want another job. We manage the work that keeps furnished rentals earning and guests cared for.</p>
          </div>
          <div className="service-grid">
            {services.map(([title, copy], index) => {
              const Icon = serviceIcons[index]
              return (
              <article className="service-card" key={title}>
                <Icon size={24} />
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
              )
            })}
          </div>
        </section>

        <section className="before-after-section">
          <div className="before-after-heading">
            <p className="eyebrow">Before and after</p>
              <h3>Settling for traditional rentals limits your property's potential.</h3>
            <p>Here is the owner math most people feel before they see it: traditional rent can look simpler, but the work and missed upside still add up.</p>
          </div>
          <div className="before-after-graphic">
            <div className="before-panel">
              <p className="eyebrow">Before</p>
              <h3>Traditional Rent Results</h3>
              <strong>Steady, but cashflow is capped.</strong>
              <div className="comparison-result">
                <span>Hudson, NY 3BR example</span>
                <b>{money(exampleRevenue.traditionalRent)}/mo</b>
                <small>Same rent number every month, regardless of peak demand.</small>
              </div>
              <ul>
                <li>Same Rental Income Every Year</li>
                <li>Owner still handles tenant and maintenance issues</li>
                <li>No pricing upside in peak demand windows</li>
                <li>Low visibility into hidden income gaps</li>
              </ul>
            </div>
            <div className="after-panel">
              <p className="eyebrow">After</p>
              <h3>Short-Term Rental Results</h3>
              <strong>More Cashflow, with proper management (like us)</strong>
              <div className="comparison-result after-result">
                <span>STR gross revenue range</span>
                <b>{money(exampleRevenue.grossLow)} - {money(exampleRevenue.grossHigh)}/mo</b>
                <small>Less 25% management: -{money(exampleRevenue.grossLow * exampleRevenue.managementFee)} to -{money(exampleRevenue.grossHigh * exampleRevenue.managementFee)}/mo</small>
              </div>
              <div className="comparison-net">
                <span>Estimated owner net</span>
                <b>{money(exampleNetLow)} - {money(exampleNetHigh)}/mo</b>
                <small>Potential lift: +{money(exampleLiftLow)} to +{money(exampleLiftHigh)}/mo</small>
              </div>
              <ul>
                <li>Short-term, mid-term, or hybrid revenue plan that increases income 2-4x on average*</li>
                <li>Guest, cleaner, vendor, and issue coordination</li>
                <li>Pricing strategy around demand and seasonality</li>
                <li>Reporting so owners can see what is working</li>
              </ul>
            </div>
          </div>
          <p className="claim-note">*Example based on the sample report range shown above. Results vary by property, market, season, local rules, and execution quality. Revenue estimates are not guaranteed.</p>
        </section>

        <section className="timeline-section">
          <div className="section-heading">
            <h2>How it Works</h2>
            <p className="timeline-label">Report - Onboard - Manage</p>
          </div>
          <div className="timeline">
            {processSteps.map(([number, title, copy], index) => {
              const Icon = processIcons[index]
              return (
              <article key={title}>
                <div className="process-icon">
                  <Icon size={34} />
                  <span>{number}</span>
                </div>
                <div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </div>
              </article>
              )
            })}
          </div>
        </section>

        <section className="fit-section">
          <div>
            <p className="eyebrow">Who this is for</p>
            <h2>For owners with furnished homes that want to generate more cash and work less, literally.</h2>
            <p>Hudson Stays is built for owners who want more income potential without becoming the person handling every guest, cleaner, vendor, and pricing decision.</p>
          </div>
          <div className="fit-columns">
            <div className="good-fit">
              <CheckCircle2 size={24} />
              <h3>Good fit</h3>
              <ul>
                <li>You own or control a furnished (or soon to be furnished) home, duplex, or small multifamily unit</li>
                <li>The property has 2 or more bedrooms</li>
                <li>You want more income without managing tenants, guests, or property maintenance yourself</li>
                <li>You are open-minded to rental strategies that produce more income</li>
              </ul>
            </div>
            <div className="bad-fit">
              <XCircle size={24} />
              <h3>Not ideal if</h3>
              <ul>
                <li>The property is not and never will be furnished</li>
                <li>Your area has low demand or is heavily restricted for stays under 30 days. We can help you figure this out with our <a className="inline-link" href="#book-property-review">Revenue Report</a>.</li>
                <li>You only want a traditional long-term tenant and are not interested in exploring higher-income rental strategies</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="strategy-section" id="strategy">
          <div className="section-heading">
            <h2>We Optimize for the Best Strategy...Not Just Airbnb.</h2>
            <p>Short stays, monthly stays, or a hybrid plan. The right model depends on the home, market, rules, and season.</p>
          </div>
          <div className="strategy-grid">
            <article>
              <Home size={20} />
              <h3>Short-Term Rental</h3>
              <p>Travel demand, premium design, flexible calendars.</p>
            </article>
            <article>
              <BedDouble size={20} />
              <h3>Mid-Term Rental</h3>
              <p>30+ day stays, relocation, insurance, corporate guests.</p>
            </article>
            <article>
              <BarChart3 size={20} />
              <h3>Hybrid Rental Strategy</h3>
              <p>Upside with flexibility across seasons and rules.</p>
            </article>
          </div>
        </section>

        <section className="final-cta" id="onboarding-form">
          <div>
            <p className="eyebrow">Start Here</p>
            <h2>Find Out if Your Home Could Earn More</h2>
            <p>Get a Free Property Revenue Report showing your property's income potential, best rental strategy, and whether Hudson Stays may be a fit to help manage it.</p>
          </div>
          <div className="form-card" id="book-property-review" ref={formRef}>
            {status === 'loading' ? <LoadingReport timedOut={timedOut} /> : <ReportForm source="final" compact onSubmitted={submitLead} />}
          </div>
        </section>

        <section className="faq-section" id="faq">
          <div className="section-heading">
            <h2>FAQ</h2>
          </div>
          <div className="faq-list">
            {faqItems.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

function App() {
  if (window.location.pathname === '/privacy' || window.location.pathname === '/terms') {
    return <LegalPage page={window.location.pathname} />
  }
  if (window.location.pathname.startsWith('/thank-you')) return <ThankYouPage />
  if (window.location.pathname.startsWith('/property-report/')) return <ReportPage />
  if (window.location.pathname.startsWith('/properties')) return <ExternalBookingRedirect />
  if (window.location.pathname.startsWith('/search')) return <ExternalBookingRedirect />
  return <HomePage />
}

export default App
