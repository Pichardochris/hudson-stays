import { randomUUID } from 'node:crypto'

const MANAGEMENT_FEE = Number(process.env.HUDSON_STAYS_MANAGEMENT_FEE || 0.25)

function json(res, statusCode, body) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function text(value = '') {
  return String(value || '').trim()
}

function number(value, fallback = 0) {
  const parsed = Number(String(value ?? '').replace(/[$,\s]/g, ''))
  return Number.isFinite(parsed) ? parsed : fallback
}

function money(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function normalizeLead(rawLead = {}) {
  const bedrooms = number(rawLead.bedrooms, 2)
  const bathrooms = number(rawLead.bathrooms, 2)
  const currentRent = number(rawLead.currentRent, bedrooms * 1200)

  return {
    location: text(rawLead.location),
    bedrooms,
    bathrooms,
    currentRent,
    furnishedStatus: text(rawLead.furnishedStatus) || 'Yes',
    email: text(rawLead.email).toLowerCase(),
    phone: text(rawLead.phone),
    wantsSms: Boolean(rawLead.wantsSms),
    address: text(rawLead.address),
    listingLink: text(rawLead.listingLink || rawLead.listingUrl),
  }
}

function createReport(lead, source = 'final') {
  const furnishedMultiplier = lead.furnishedStatus === 'Yes' ? 1.45 : lead.furnishedStatus === 'Partially' ? 1.28 : 1.12
  const bedroomLift = Math.max(1, lead.bedrooms * 0.18 + 0.84)
  const low = Math.max(lead.currentRent * 1.08, lead.currentRent * furnishedMultiplier * bedroomLift * 0.72)
  const mid = Math.max(low + 350, lead.currentRent * furnishedMultiplier * bedroomLift * 0.92)
  const high = Math.max(mid + 450, lead.currentRent * furnishedMultiplier * bedroomLift * 1.12)
  const ownerNetLow = low * (1 - MANAGEMENT_FEE)
  const ownerNetHigh = high * (1 - MANAGEMENT_FEE)
  const monthlyGap = Math.max(0, (ownerNetLow + ownerNetHigh) / 2 - lead.currentRent)
  const score = Math.min(
    100,
    Math.round(
      32 +
        lead.bedrooms * 9 +
        (lead.furnishedStatus === 'Yes' ? 18 : lead.furnishedStatus === 'Partially' ? 10 : 2) +
        (monthlyGap > 1000 ? 18 : monthlyGap > 500 ? 11 : 4) +
        (lead.address || lead.listingLink ? 10 : 4),
    ),
  )

  return {
    token: randomUUID(),
    source,
    createdAt: new Date().toISOString(),
    lead,
    reportUrl: '',
    estimates: {
      low,
      mid,
      high,
      ownerNetLow,
      ownerNetHigh,
      monthlyGap,
      annualGap: monthlyGap * 12,
      managementFee: MANAGEMENT_FEE,
    },
    fitLabel: score >= 80 ? 'Strong Fit' : score >= 60 ? 'Potential Fit' : 'Not a Fit Yet',
    internalScore: score,
    confidence: lead.address || lead.listingLink ? 'High confidence' : 'Medium confidence',
    recommendedStrategy:
      lead.furnishedStatus === 'No'
        ? 'Mid-term rental or phased furnishing review'
        : lead.bedrooms >= 3
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

async function postJson(url, payload, headers = {}) {
  if (!url) return { status: 'skipped_missing_url' }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(payload),
    })

    return {
      status: response.ok ? 'sent' : 'failed',
      statusCode: response.status,
      body: response.ok ? undefined : (await response.text()).slice(0, 500),
    }
  } catch (error) {
    return {
      status: 'failed',
      message: error instanceof Error ? error.message : 'Unknown webhook error.',
    }
  }
}

function buildNotificationPayload({ lead, report, source }) {
  const reportSummary = {
    market: lead.address || lead.location,
    currentRent: money(lead.currentRent),
    grossRevenueRange: `${money(report.estimates.low)} - ${money(report.estimates.high)}/mo`,
    estimatedOwnerNet: `${money(report.estimates.ownerNetLow)} - ${money(report.estimates.ownerNetHigh)}/mo`,
    potentialLift: `${money(report.estimates.monthlyGap)}/mo`,
    fit: `${report.fitLabel} (${report.internalScore}/100)`,
    strategy: report.recommendedStrategy,
  }

  return {
    submittedAt: report.createdAt,
    source,
    notifyEmail: process.env.LEAD_NOTIFICATION_TO || 'hudsonstays@gmail.com',
    lead,
    report: reportSummary,
  }
}

function slackPayload({ lead, report, source }) {
  return {
    text: `New Hudson Stays revenue report lead: ${lead.email}`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'New Hudson Stays Revenue Report Lead' },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Email*\n${lead.email}` },
          { type: 'mrkdwn', text: `*Phone*\n${lead.phone || 'Not provided'}` },
          { type: 'mrkdwn', text: `*Market*\n${lead.address || lead.location}` },
          { type: 'mrkdwn', text: `*Beds/Baths*\n${lead.bedrooms} bed / ${lead.bathrooms} bath` },
          { type: 'mrkdwn', text: `*Current Rent*\n${money(lead.currentRent)}/mo` },
          { type: 'mrkdwn', text: `*Fit*\n${report.fitLabel} (${report.internalScore}/100)` },
          { type: 'mrkdwn', text: `*Owner Net Estimate*\n${money(report.estimates.ownerNetLow)} - ${money(report.estimates.ownerNetHigh)}/mo` },
          { type: 'mrkdwn', text: `*Source*\n${source}` },
        ],
      },
    ],
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    json(res, 405, { success: false, error: 'Use POST.' })
    return
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const source = body?.source || 'final'
  const lead = normalizeLead(body?.lead)

  if (!lead.location) {
    json(res, 400, { success: false, error: 'Property city/state or ZIP is required.' })
    return
  }

  if (!lead.email || !/^\S+@\S+\.\S+$/.test(lead.email)) {
    json(res, 400, { success: false, error: 'A valid email is required.' })
    return
  }

  if (lead.wantsSms && !/^\+?[\d\s().-]{10,}$/.test(lead.phone)) {
    json(res, 400, { success: false, error: 'A valid phone number is required for SMS consent.' })
    return
  }

  const report = createReport(lead, source)
  report.reportUrl = `/property-report/${report.token}`
  const payload = buildNotificationPayload({ lead, report, source })

  const googleSheetsUrl = process.env.GOOGLE_LEAD_WEBHOOK_URL || process.env.GOOGLE_SHEETS_WEBHOOK_URL
  const emailWebhookUrl = process.env.LEAD_NOTIFICATION_WEBHOOK_URL
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL

  const [googleSheets, email, slack] = await Promise.all([
    postJson(googleSheetsUrl, payload),
    postJson(emailWebhookUrl, payload),
    postJson(slackWebhookUrl, slackPayload({ lead, report, source })),
  ])

  json(res, 200, {
    success: true,
    report,
    leadNotifications: {
      googleSheets,
      email,
      slack,
      configured: {
        googleSheets: Boolean(googleSheetsUrl),
        email: Boolean(emailWebhookUrl),
        slack: Boolean(slackWebhookUrl),
      },
    },
  })
}
