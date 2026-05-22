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

function buildFitSummary(lead, report) {
  const netLow = report.estimates.ownerNetLow
  const netHigh = report.estimates.ownerNetHigh
  const netMid = (netLow + netHigh) / 2
  const lift = Math.max(0, netMid - lead.currentRent)
  const accuracySignal = lead.address || lead.listingLink
    ? 'Confidence is higher because the lead provided a full address or listing URL.'
    : 'Confidence is preliminary because the lead only provided broad location/property inputs.'
  const furnishedSignal = lead.furnishedStatus === 'Yes'
    ? 'The furnished status supports a stronger rental strategy.'
    : lead.furnishedStatus === 'Partially'
      ? 'Partial furnishing keeps the property in play, but setup quality may affect the score.'
      : 'The property is not furnished yet, so the fit score is capped until setup is addressed.'
  const bedroomSignal = lead.bedrooms >= 3
    ? `${lead.bedrooms} bedrooms helps the property compete for higher-value group, family, and monthly stays.`
    : `${lead.bedrooms} bedroom${lead.bedrooms === 1 ? '' : 's'} can still work, but the strategy may depend more on demand, design, and stay length.`

  return [
    `Fit is graded ${report.internalScore}/100 (${report.fitLabel}) because the estimated owner net is ${money(netLow)} - ${money(netHigh)}/mo compared with current rent of ${money(lead.currentRent)}/mo.`,
    lift > 0 ? `The model shows about ${money(lift)}/mo in midpoint upside before property-specific costs.` : 'The model does not show clear upside over the current rent baseline yet.',
    bedroomSignal,
    furnishedSignal,
    accuracySignal,
  ].join(' ')
}

async function createAiFitSummary(lead, report) {
  const fallback = buildFitSummary(lead, report)
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return fallback

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_REPORT_MODEL || 'gpt-4.1-mini',
        input: [
          {
            role: 'system',
            content:
              'Write a concise internal Slack summary for a furnished rental lead. Explain why the fit score is what it is. Be careful: numbers are preliminary estimates, not guarantees.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              lead,
              fit: `${report.fitLabel} (${report.internalScore}/100)`,
              confidence: report.confidence,
              strategy: report.recommendedStrategy,
              estimates: {
                currentRent: money(lead.currentRent),
                grossRange: `${money(report.estimates.low)} - ${money(report.estimates.high)}/mo`,
                ownerNetRange: `${money(report.estimates.ownerNetLow)} - ${money(report.estimates.ownerNetHigh)}/mo`,
                monthlyUpside: money(report.estimates.monthlyGap),
              },
            }),
          },
        ],
        max_output_tokens: 180,
      }),
    })

    const data = await response.json()
    const text =
      data.output_text ||
      data.output?.flatMap((item) => item.content || []).map((item) => item.text).filter(Boolean).join(' ')

    return text ? text.slice(0, 1200) : fallback
  } catch {
    return fallback
  } finally {
    clearTimeout(timeout)
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
    fitSummary: report.fitSummary,
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
    text: `New Hudson Stays income estimate lead: ${lead.email}`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'New Hudson Stays Income Estimate Lead' },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Email*\n${lead.email}` },
          { type: 'mrkdwn', text: `*Confidence*\n${report.confidence}` },
          { type: 'mrkdwn', text: `*Market*\n${lead.address || lead.location}` },
          { type: 'mrkdwn', text: `*Beds/Baths*\n${lead.bedrooms} bed / ${lead.bathrooms} bath` },
          { type: 'mrkdwn', text: `*Current Rent*\n${money(lead.currentRent)}/mo` },
          { type: 'mrkdwn', text: `*Fit*\n${report.fitLabel} (${report.internalScore}/100)` },
          { type: 'mrkdwn', text: `*Owner Net Estimate*\n${money(report.estimates.ownerNetLow)} - ${money(report.estimates.ownerNetHigh)}/mo` },
          { type: 'mrkdwn', text: `*Source*\n${source}` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*AI Fit Summary*\n${report.fitSummary}` },
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
  report.fitSummary = await createAiFitSummary(lead, report)
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
