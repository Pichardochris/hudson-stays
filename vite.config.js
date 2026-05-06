import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { webcrypto } from 'node:crypto'
import process from 'node:process'

function decodeHtml(value = '') {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#34;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&apos;', "'")
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
}

function compactText(value = '') {
  return decodeHtml(value)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function pick(patterns, text) {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return decodeHtml(String(match[1]).trim())
  }

  return ''
}

function pickNumber(patterns, text) {
  const value = pick(patterns, text)
  if (!value) return null

  const parsed = Number(String(value).replace(/[,$]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function safeJsonParse(value) {
  try {
    return JSON.parse(decodeHtml(value))
  } catch {
    return null
  }
}

function walkJson(value, visitor) {
  if (!value || typeof value !== 'object') return
  visitor(value)

  if (Array.isArray(value)) {
    value.forEach((item) => walkJson(item, visitor))
    return
  }

  Object.values(value).forEach((item) => walkJson(item, visitor))
}

function extractJsonLd(html) {
  const items = []
  const scripts = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)

  for (const script of scripts) {
    const parsed = safeJsonParse(script[1])
    if (parsed) items.push(parsed)
  }

  return items
}

function extractListingFacts({ html, url }) {
  const text = compactText(html)
  const title = pick([/<title[^>]*>([\s\S]*?)<\/title>/i], html)
  const description = pick(
    [
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    ],
    html,
  )
  const ogTitle = pick([/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i], html)
  const searchable = [title, ogTitle, description, text].join(' ')
  const jsonLd = extractJsonLd(html)
  const facts = {
    sourceUrl: url,
    title: title || ogTitle,
    description,
    address: '',
    market: '',
    bedrooms: null,
    bathrooms: null,
    monthlyRent: null,
    daysListed: null,
    furnishedStatus: '',
    fetchedText: searchable.slice(0, 5000),
  }

  for (const item of jsonLd) {
    walkJson(item, (node) => {
      if (!facts.address && node.address) {
        if (typeof node.address === 'string') facts.address = node.address
        if (typeof node.address === 'object') {
          facts.address = [
            node.address.streetAddress,
            node.address.addressLocality,
            node.address.addressRegion,
            node.address.postalCode,
          ]
            .filter(Boolean)
            .join(', ')
          facts.market = [node.address.addressLocality, node.address.addressRegion].filter(Boolean).join(', ')
        }
      }

      if (!facts.monthlyRent && node.offers?.price) facts.monthlyRent = Number(node.offers.price)
      if (!facts.bedrooms && node.numberOfRooms) facts.bedrooms = Number(node.numberOfRooms)
    })
  }

  const titleAddress = pick(
    [
      /^([^|]+?)\s+(?:apartments?|homes?|house|condo|townhouse)?\s*(?:for rent|rental)?\s*\|/i,
      /^([^|]+?),\s*(?:[A-Z]{2}|[A-Za-z ]+)\s+\d{5}/i,
    ],
    title || ogTitle,
  )

  facts.address =
    facts.address ||
    pick(
      [
        /"streetAddress"\s*:\s*"([^"]+)"/i,
        /"address"\s*:\s*"([^"]+)"/i,
        /([0-9]{2,6}\s+[A-Za-z0-9 .'-]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Way|Trail|Trl|Circle|Cir|Place|Pl|Boulevard|Blvd)[^|,\n<]*)/i,
      ],
      searchable,
    ) ||
    titleAddress

  facts.bedrooms =
    facts.bedrooms ??
    pickNumber(
      [
        /(\d+(?:\.\d+)?)\s*(?:bed|bd|bedroom|br)\b/i,
        /"bedrooms"\s*:\s*(\d+(?:\.\d+)?)/i,
        /"beds"\s*:\s*(\d+(?:\.\d+)?)/i,
      ],
      searchable,
    )

  facts.bathrooms =
    facts.bathrooms ??
    pickNumber(
      [
        /(\d+(?:\.\d+)?)\s*(?:bath|ba|bathroom)\b/i,
        /"bathrooms"\s*:\s*(\d+(?:\.\d+)?)/i,
        /"baths"\s*:\s*(\d+(?:\.\d+)?)/i,
      ],
      searchable,
    )

  facts.monthlyRent =
    facts.monthlyRent ??
    pickNumber(
      [
        /\$([\d,]+)\s*(?:\/|per)?\s*(?:month|mo|monthly)/i,
        /rent[^$]{0,30}\$([\d,]+)/i,
        /"price"\s*:\s*"?([\d,]+)"?/i,
      ],
      searchable,
    )

  facts.daysListed = pickNumber([/(\d+)\s*(?:days?|d)\s*(?:listed|on market|available|on zillow)/i], searchable)
  facts.furnishedStatus = /fully furnished/i.test(searchable)
    ? 'Fully furnished'
    : /furnished/i.test(searchable)
      ? 'Likely furnished'
      : ''

  if (!facts.market) {
    facts.market = pick(
      [
        /,\s*([A-Za-z .'-]+,\s*[A-Z]{2})\s+\d{5}/,
        /\b(Vancouver|Whistler|Squamish|Kelowna|Tofino|Anchorage|Seattle|Phoenix|Scottsdale|Austin|Nashville|Orlando|Miami|Tampa|San Diego)\b/i,
      ],
      searchable,
    )
  }

  return facts
}

function researchPlugin() {
  return {
    name: 'local-research-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/research')) {
          next()
          return
        }

        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Use POST.' }))
          return
        }

        let body = ''
        req.on('data', (chunk) => {
          body += chunk
        })

        req.on('end', async () => {
          res.setHeader('Content-Type', 'application/json')

          try {
            const { input } = JSON.parse(body || '{}')
            const sourceUrl = String(input || '').match(/https?:\/\/\S+/)?.[0]?.replace(/[),.]+$/, '')

            if (!sourceUrl) {
              res.end(
                JSON.stringify({
                  success: true,
                  fetched: false,
                  extracted: {},
                  warnings: ['No URL found. Used the pasted address/listing notes only.'],
                }),
              )
              return
            }

            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 12000)
            const response = await fetch(sourceUrl, {
              signal: controller.signal,
              headers: {
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'accept-language': 'en-US,en;q=0.9',
                'user-agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
              },
            })
            clearTimeout(timeout)

            const html = await response.text()
            const extracted = extractListingFacts({ html, url: sourceUrl })
            const warnings = []

            if (!response.ok) warnings.push(`Listing page returned HTTP ${response.status}.`)
            if (!extracted.address) warnings.push('Could not confidently extract the address.')
            if (!extracted.monthlyRent) warnings.push('Could not confidently extract monthly rent.')
            if (!extracted.bedrooms) warnings.push('Could not confidently extract bedroom count.')
            if (!extracted.bathrooms) warnings.push('Could not confidently extract bathroom count.')

            res.end(
              JSON.stringify({
                success: true,
                fetched: response.ok,
                status: response.status,
                extracted,
                warnings,
              }),
            )
          } catch (error) {
            res.statusCode = 200
            res.end(
              JSON.stringify({
                success: false,
                fetched: false,
                extracted: {},
                warnings: [
                  `Could not fetch the listing page: ${error instanceof Error ? error.message : 'Unknown error'}. Used pasted text fallback.`,
                ],
              }),
            )
          }
        })
      })
    },
  }
}

function makeToken() {
  const bytes = webcrypto.getRandomValues(new Uint8Array(18))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function toNumber(value, fallback = 0) {
  const raw = String(value ?? '').trim()
  if (!raw) return fallback
  const parsed = Number(raw.replace(/[$,\s]/g, ''))
  return Number.isFinite(parsed) ? parsed : fallback
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function monthlyValue(value) {
  const parsed = toNumber(value, null)
  if (!parsed) return null
  if (parsed > 120000) return parsed / 12
  return parsed
}

function normalizeLead(lead = {}) {
  const bedrooms = toNumber(lead.bedrooms, 2)
  const bathrooms = toNumber(lead.bathrooms, 2)
  const currentRent = toNumber(lead.currentRent, bedrooms * 1200)

  return {
    location: optionalString(lead.location) || '',
    address: optionalString(lead.address) || '',
    listingLink: optionalString(lead.listingLink || lead.listingUrl) || '',
    bedrooms,
    bathrooms,
    currentRent,
    furnishedStatus: optionalString(lead.furnishedStatus) || 'Yes',
    email: optionalString(lead.email) || '',
    wantsSms: Boolean(lead.wantsSms),
    phone: lead.wantsSms ? optionalString(lead.phone) || '' : '',
  }
}

function buildLocalEstimate(lead) {
  const bedrooms = toNumber(lead.bedrooms, 2)
  const currentRent = toNumber(lead.currentRent, bedrooms * 1200)
  const furnishedMultiplier = lead.furnishedStatus === 'Yes' ? 1.45 : lead.furnishedStatus === 'Partially' ? 1.28 : 1.12
  const bedroomLift = Math.max(1, bedrooms * 0.18 + 0.84)
  const low = Math.max(currentRent * 1.08, currentRent * furnishedMultiplier * bedroomLift * 0.72)
  const mid = Math.max(low + 350, currentRent * furnishedMultiplier * bedroomLift * 0.92)
  const high = Math.max(mid + 450, currentRent * furnishedMultiplier * bedroomLift * 1.12)

  return { low, mid, high, source: 'Internal preliminary calculator' }
}

function walkValues(value, visitor) {
  if (!value || typeof value !== 'object') return
  visitor(value)

  if (Array.isArray(value)) {
    value.forEach((item) => walkValues(item, visitor))
    return
  }

  Object.values(value).forEach((item) => walkValues(item, visitor))
}

function valueFromAnyKey(object, keys) {
  for (const key of keys) {
    const exact = object[key]
    const exactNumber = monthlyValue(exact)
    if (exactNumber) return exactNumber
  }

  const normalized = Object.entries(object).find(([key, value]) => {
    const next = key.toLowerCase().replace(/[_\s-]/g, '')
    return keys.some((target) => next === target.toLowerCase().replace(/[_\s-]/g, '')) && monthlyValue(value)
  })

  return normalized ? monthlyValue(normalized[1]) : null
}

function percentile(values, ratio) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const index = clamp(Math.round((sorted.length - 1) * ratio), 0, sorted.length - 1)
  return sorted[index]
}

function parseRabbuMarketData(payload) {
  const revenueValues = []
  let low = null
  let high = null
  let average = null
  let adr = null
  let occupancy = null

  walkValues(payload, (node) => {
    if (!node || Array.isArray(node)) return

    low =
      low ||
      valueFromAnyKey(node, [
        'revenue_low',
        'revenueLow',
        'low',
        'p25Revenue',
        'monthlyRevenueLow',
        'estimatedLow',
        'minRevenue',
      ])
    high =
      high ||
      valueFromAnyKey(node, [
        'revenue_high',
        'revenueHigh',
        'high',
        'p75Revenue',
        'monthlyRevenueHigh',
        'estimatedHigh',
        'maxRevenue',
      ])
    average =
      average ||
      valueFromAnyKey(node, [
        'averageRevenue',
        'averageMonthlyRevenue',
        'monthlyRevenue',
        'estimatedRevenue',
        'grossRevenue',
        'revenue',
      ])
    adr = adr || toNumber(node.adr || node.averageDailyRate || node.avgDailyRate, null)
    occupancy = occupancy || toNumber(node.occupancy || node.occupancyRate, null)

    const compRevenue = valueFromAnyKey(node, [
      'monthlyRevenue',
      'averageMonthlyRevenue',
      'estimatedRevenue',
      'revenue',
      'grossRevenue',
    ])
    if (compRevenue) revenueValues.push(compRevenue)
  })

  if ((!low || !high) && revenueValues.length >= 3) {
    low = low || percentile(revenueValues, 0.25)
    high = high || percentile(revenueValues, 0.75)
  }

  if (!low && average) low = average * 0.82
  if (!high && average) high = average * 1.18

  if (!low || !high) return null

  return {
    source: 'Rabbu',
    low: Math.min(low, high),
    high: Math.max(low, high),
    mid: average || (low + high) / 2,
    adr,
    occupancy,
    compCount: revenueValues.length,
  }
}

async function fetchRabbuMarketData(lead) {
  const apiKey = getEnv('RABBU_API_KEY')
  const apiUrl = getEnv('RABBU_API_URL', 'RABBU_API_BASE_URL')
  const method = (getEnv('RABBU_API_METHOD') || 'GET').toUpperCase()

  if (!apiKey || !apiUrl) {
    return {
      status: 'skipped_missing_credentials',
      message: 'Set RABBU_API_KEY and RABBU_API_URL to enable Rabbu market data.',
    }
  }

  const url = new URL(apiUrl)
  const params = {
    location: lead.location,
    address: lead.address,
    bedrooms: lead.bedrooms,
    bathrooms: lead.bathrooms,
    currentRent: lead.currentRent,
    furnishedStatus: lead.furnishedStatus,
  }

  Object.entries(params).forEach(([key, value]) => {
    if (method === 'GET' && value !== undefined && value !== null && String(value).trim()) {
      url.searchParams.set(key, String(value))
    }
  })

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'X-API-Key': apiKey,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: method === 'GET' ? undefined : JSON.stringify(params),
    })
    clearTimeout(timeout)

    const text = await response.text()
    const body = text ? safeJsonParse(text) || { raw: text.slice(0, 500) } : {}
    const parsed = response.ok ? parseRabbuMarketData(body) : null

    return {
      status: response.ok && parsed ? 'synced' : response.ok ? 'unparsed' : 'failed',
      statusCode: response.status,
      message:
        response.ok && parsed
          ? 'Rabbu market data parsed.'
          : response.ok
            ? 'Rabbu responded, but no revenue range could be parsed.'
            : 'Rabbu market data request failed.',
      parsed,
      response: response.ok ? undefined : body,
    }
  } catch (error) {
    return {
      status: 'failed',
      message: error instanceof Error ? error.message : 'Unknown Rabbu market data error.',
    }
  }
}

async function fetchListingEnrichment(lead) {
  if (!lead.listingLink) return null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)
    const response = await fetch(lead.listingLink, {
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
      },
    })
    clearTimeout(timeout)

    const html = await response.text()
    const extracted = extractListingFacts({ html, url: lead.listingLink })

    return {
      status: response.ok ? 'synced' : 'failed',
      statusCode: response.status,
      extracted,
      warnings: [
        !response.ok ? `Listing page returned HTTP ${response.status}.` : '',
        !extracted.address ? 'Could not confidently extract address from listing.' : '',
        !extracted.monthlyRent ? 'Could not confidently extract current rent from listing.' : '',
      ].filter(Boolean),
    }
  } catch (error) {
    return {
      status: 'failed',
      extracted: {},
      warnings: [error instanceof Error ? error.message : 'Unknown listing enrichment error.'],
    }
  }
}

function calculateReport({ lead, rabbuMarketData }) {
  const localEstimate = buildLocalEstimate(lead)
  const marketEstimate = rabbuMarketData?.parsed
  const low = marketEstimate?.low || localEstimate.low
  const high = marketEstimate?.high || localEstimate.high
  const mid = marketEstimate?.mid || (low + high) / 2
  const managementFeeRate = toNumber(getEnv('HUDSON_STAYS_MANAGEMENT_FEE'), 0.25)
  const ownerNetLow = low * (1 - managementFeeRate)
  const ownerNetHigh = high * (1 - managementFeeRate)
  const ownerNetMid = mid * (1 - managementFeeRate)
  const monthlyGap = Math.max(0, ownerNetMid - lead.currentRent)
  const dataQuality =
    (marketEstimate ? 26 : 10) +
    (lead.address ? 16 : 0) +
    (lead.listingLink ? 12 : 0) +
    (lead.location ? 8 : 0) +
    (lead.bedrooms && lead.bathrooms ? 8 : 0)
  const internalScore = Math.min(
    100,
    Math.round(
      30 +
        lead.bedrooms * 8 +
        (lead.furnishedStatus === 'Yes' ? 18 : lead.furnishedStatus === 'Partially' ? 10 : 2) +
        (monthlyGap > 1000 ? 18 : monthlyGap > 500 ? 11 : 4) +
        Math.min(18, dataQuality / 2),
    ),
  )

  return {
    low,
    mid,
    high,
    ownerNetLow,
    ownerNetHigh,
    ownerNetMid,
    monthlyGap,
    annualGap: monthlyGap * 12,
    managementFeeRate,
    dataQuality,
    internalScore,
    confidence:
      marketEstimate && (lead.address || lead.listingLink)
        ? 'High confidence'
        : marketEstimate || lead.address || lead.listingLink
          ? 'Medium confidence'
          : 'Preliminary confidence',
    fitLabel: internalScore >= 82 ? 'Strong Fit' : internalScore >= 62 ? 'Potential Fit' : 'Needs Review',
    recommendedStrategy:
      lead.furnishedStatus === 'No'
        ? 'Mid-term rental or phased furnishing review'
        : lead.bedrooms >= 3
          ? 'Hybrid short-term and mid-term rental strategy'
          : 'Mid-term rental strategy with selective short stays',
    marketData: {
      source: marketEstimate?.source || localEstimate.source,
      status: marketEstimate ? 'rabbu_enriched' : 'internal_calculator',
      adr: marketEstimate?.adr || null,
      occupancy: marketEstimate?.occupancy || null,
      compCount: marketEstimate?.compCount || 0,
    },
  }
}

function reportBaseUrl() {
  return optionalString(process.env.REPORT_BASE_URL)?.replace(/\/$/, '') || ''
}

function buildFallbackNarrative({ lead, calculation }) {
  const regulationQualifier = lead.location
    ? `${lead.location} rules should be reviewed for permits, taxes, minimum stay rules, HOA limits, and any local registration requirements.`
    : 'Local STR rules should be reviewed for permits, taxes, minimum stay rules, HOA limits, and any local registration requirements.'

  return {
    marketSummary:
      calculation.marketData.status === 'rabbu_enriched'
        ? 'Market data indicates enough furnished-rental upside to compare against traditional long-term rent after management fees.'
        : 'This is a preliminary estimate based on property inputs. Rabbu enrichment can improve confidence once API credentials are configured.',
    regulationSummary: {
      summary: regulationQualifier,
      notes: regulationQualifier,
      riskLevel: 'Review required',
      ownerAction: 'Confirm local rules before launch.',
    },
    fitReasons: [
      `${lead.bedrooms || 0} bedroom properties can support more flexible furnished rental strategies.`,
      calculation.monthlyGap > 0
        ? 'The estimated owner net suggests potential upside versus the current rent baseline.'
        : 'The current rent baseline is close enough that a manager should review seasonality and demand before recommending a strategy.',
      lead.furnishedStatus === 'Yes'
        ? 'Furnished status reduces setup friction.'
        : 'Furnishing needs should be reviewed before committing to a strategy.',
    ],
    opportunities: [
      'Compare short-term, mid-term, and hybrid revenue by season instead of relying on one rent number.',
      'Use demand-aware pricing so peak windows are not left underpriced.',
      'Build cleaner, guest, vendor, and owner reporting systems before launch.',
    ],
    assumptions: [
      'Revenue estimates are preliminary and not guaranteed.',
      'The calculator uses available property inputs, current rent baseline, and a 25% Hudson Stays management fee assumption.',
      'Taxes, cleaning revenue/costs, utilities, furnishing, repairs, platform fees, HOA rules, and property-specific expenses are not fully modeled in this first estimate.',
      'Local regulations must be independently confirmed before launch.',
    ],
    nextStep: 'Review the report with a Hudson Stays Revenue Manager before making a rental-strategy decision.',
  }
}

function reportSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'marketSummary',
      'recommendedStrategy',
      'fitLabel',
      'internalScore',
      'confidence',
      'fitReasons',
      'regulationSummary',
      'opportunities',
      'assumptions',
      'nextStep',
    ],
    properties: {
      marketSummary: { type: 'string' },
      recommendedStrategy: { type: 'string' },
      fitLabel: { type: 'string', enum: ['Strong Fit', 'Potential Fit', 'Needs Review'] },
      internalScore: { type: 'integer', minimum: 1, maximum: 100 },
      confidence: { type: 'string' },
      fitReasons: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'string' } },
      regulationSummary: {
        type: 'object',
        additionalProperties: false,
        required: ['summary', 'notes', 'riskLevel', 'ownerAction'],
        properties: {
          summary: { type: 'string' },
          notes: { type: 'string' },
          riskLevel: { type: 'string' },
          ownerAction: { type: 'string' },
        },
      },
      opportunities: { type: 'array', minItems: 3, maxItems: 4, items: { type: 'string' } },
      assumptions: { type: 'array', minItems: 3, maxItems: 5, items: { type: 'string' } },
      nextStep: { type: 'string' },
    },
  }
}

function extractResponseText(body) {
  if (body?.output_text) return body.output_text

  const textParts = []
  for (const item of body?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && content?.text) textParts.push(content.text)
      if (content?.type === 'text' && content?.text) textParts.push(content.text)
    }
  }

  return textParts.join('\n').trim()
}

async function generateOpenAiNarrative({ lead, calculation, rabbuMarketData, listingEnrichment }) {
  const apiKey = getEnv('OPENAI_API_KEY')

  if (!apiKey) {
    return {
      status: 'skipped_missing_credentials',
      narrative: null,
      message: 'Set OPENAI_API_KEY to enable AI report generation and regulation research.',
    }
  }

  const model = getEnv('OPENAI_MODEL') || 'gpt-5'
  const enableWebSearch = String(process.env.OPENAI_ENABLE_WEB_SEARCH || '').toLowerCase() === 'true'
  const context = {
    lead,
    calculation,
    rabbuMarketData: rabbuMarketData?.parsed || null,
    listingFacts: listingEnrichment?.extracted || null,
    instructions: [
      'Create concise owner-facing report content for Hudson Stays.',
      'Do not guarantee revenue.',
      'Use local STR regulation language as a preliminary screening summary, not legal advice.',
      'If local rules are uncertain, say review required instead of inventing permit requirements.',
      'Recommend short-term, mid-term, hybrid, or needs-review strategy based on the numbers and inputs.',
    ],
  }

  const payload = {
    model,
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text:
              'You create structured preliminary furnished-rental revenue reports for Hudson Stays. Be specific, concise, and careful with revenue/regulatory claims.',
          },
        ],
      },
      {
        role: 'user',
        content: [{ type: 'input_text', text: JSON.stringify(context) }],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'hudson_stays_revenue_report',
        strict: true,
        schema: reportSchema(),
      },
    },
  }

  if (enableWebSearch) {
    payload.tools = [{ type: 'web_search_preview' }]
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 45000)
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    clearTimeout(timeout)

    const text = await response.text()
    const body = text ? safeJsonParse(text) || { raw: text.slice(0, 1000) } : {}
    const outputText = extractResponseText(body)
    const narrative = outputText ? safeJsonParse(outputText) : null

    return {
      status: response.ok && narrative ? 'generated' : response.ok ? 'unparsed' : 'failed',
      statusCode: response.status,
      model,
      webSearchEnabled: enableWebSearch,
      narrative,
      message:
        response.ok && narrative
          ? 'OpenAI generated structured report narrative.'
          : response.ok
            ? 'OpenAI responded, but structured report JSON could not be parsed.'
            : 'OpenAI report generation failed.',
      response: response.ok ? undefined : body,
    }
  } catch (error) {
    return {
      status: 'failed',
      model,
      webSearchEnabled: enableWebSearch,
      narrative: null,
      message: error instanceof Error ? error.message : 'Unknown OpenAI report generation error.',
    }
  }
}

async function createRevenueReport({ lead: rawLead, source }) {
  const normalizedLead = normalizeLead(rawLead)
  const listingEnrichment = await fetchListingEnrichment(normalizedLead)
  const lead = {
    ...normalizedLead,
    address: normalizedLead.address || listingEnrichment?.extracted?.address || '',
    bedrooms: normalizedLead.bedrooms || listingEnrichment?.extracted?.bedrooms || 2,
    bathrooms: normalizedLead.bathrooms || listingEnrichment?.extracted?.bathrooms || 2,
    currentRent: normalizedLead.currentRent || listingEnrichment?.extracted?.monthlyRent || normalizedLead.bedrooms * 1200,
  }

  const rabbuMarketData = await fetchRabbuMarketData(lead)
  const calculation = calculateReport({ lead, rabbuMarketData })
  const fallbackNarrative = buildFallbackNarrative({ lead, calculation })
  const openAiGeneration = await generateOpenAiNarrative({
    lead,
    calculation,
    rabbuMarketData,
    listingEnrichment,
  })
  const narrative = openAiGeneration.narrative || fallbackNarrative
  const token = makeToken()
  const path = `/property-report/${token}`
  const publicReportUrl = reportBaseUrl() ? `${reportBaseUrl()}${path}` : path

  return {
    token,
    source,
    createdAt: new Date().toISOString(),
    reportUrl: path,
    publicReportUrl,
    lead,
    estimates: {
      low: calculation.low,
      mid: calculation.mid,
      high: calculation.high,
      ownerNetLow: calculation.ownerNetLow,
      ownerNetHigh: calculation.ownerNetHigh,
      ownerNetMid: calculation.ownerNetMid,
      monthlyGap: calculation.monthlyGap,
      annualGap: calculation.annualGap,
      managementFeeRate: calculation.managementFeeRate,
    },
    fitLabel: narrative.fitLabel || calculation.fitLabel,
    internalScore: clamp(toNumber(narrative.internalScore, calculation.internalScore), 1, 100),
    confidence: narrative.confidence || calculation.confidence,
    recommendedStrategy: narrative.recommendedStrategy || calculation.recommendedStrategy,
    marketSummary: narrative.marketSummary,
    regulationSummary: narrative.regulationSummary,
    fitReasons: narrative.fitReasons || fallbackNarrative.fitReasons,
    assumptions: narrative.assumptions || fallbackNarrative.assumptions,
    opportunities: narrative.opportunities || fallbackNarrative.opportunities,
    nextStep: narrative.nextStep || fallbackNarrative.nextStep,
    marketData: calculation.marketData,
    integrations: {
      rabbu: rabbuMarketData,
      listing: listingEnrichment,
      openai: {
        status: openAiGeneration.status,
        model: openAiGeneration.model,
        webSearchEnabled: openAiGeneration.webSearchEnabled,
        message: openAiGeneration.message,
      },
    },
  }
}

function optionalString(value) {
  const trimmed = String(value || '').trim()
  return trimmed || undefined
}

function getEnv(...names) {
  for (const name of names) {
    const value = optionalString(process.env[name])
    if (value) return value
  }

  return undefined
}

function buildGhlCustomFields({ lead, report }) {
  const fieldPairs = [
    ['GHL_CF_PROPERTY_LOCATION_ID', lead.location],
    ['GHL_CF_PROPERTY_ADDRESS_ID', lead.address],
    ['GHL_CF_LISTING_URL_ID', lead.listingLink],
    ['GHL_CF_BEDROOMS_ID', String(report.lead.bedrooms || '')],
    ['GHL_CF_BATHROOMS_ID', String(report.lead.bathrooms || '')],
    ['GHL_CF_CURRENT_RENT_ID', String(report.lead.currentRent || '')],
    ['GHL_CF_FURNISHED_STATUS_ID', lead.furnishedStatus],
    ['GHL_CF_ESTIMATED_LOW_ID', String(Math.round(report.estimates.low || 0))],
    ['GHL_CF_ESTIMATED_HIGH_ID', String(Math.round(report.estimates.high || 0))],
    ['GHL_CF_OWNER_NET_LOW_ID', String(Math.round(report.estimates.ownerNetLow || 0))],
    ['GHL_CF_OWNER_NET_HIGH_ID', String(Math.round(report.estimates.ownerNetHigh || 0))],
    ['GHL_CF_FIT_LABEL_ID', report.fitLabel],
    ['GHL_CF_FIT_SCORE_ID', String(report.internalScore || '')],
    ['GHL_CF_RECOMMENDED_STRATEGY_ID', report.recommendedStrategy],
    ['GHL_CF_CONFIDENCE_ID', report.confidence],
    ['GHL_CF_REGULATION_SUMMARY_ID', report.regulationSummary?.summary || report.regulationSummary?.notes],
    ['GHL_CF_REPORT_URL_ID', report.publicReportUrl || report.reportUrl],
  ]

  return fieldPairs
    .map(([envName, value]) => {
      const id = optionalString(process.env[envName])
      const nextValue = optionalString(value)
      return id && nextValue ? { id, value: nextValue } : null
    })
    .filter(Boolean)
}

async function createGoHighLevelOpportunity({ baseUrl, token, locationId, contactId, lead, report }) {
  const pipelineId = getEnv('GHL_PIPELINE_ID')
  const pipelineStageId = getEnv('GHL_PIPELINE_STAGE_ID')

  if (!pipelineId || !pipelineStageId) {
    return {
      status: 'skipped_missing_pipeline',
      message: 'Set GHL_PIPELINE_ID and GHL_PIPELINE_STAGE_ID to enable opportunity creation.',
    }
  }

  if (!contactId) {
    return {
      status: 'skipped_missing_contact',
      message: 'Contact upsert succeeded but no contact id was returned for opportunity creation.',
    }
  }

  const opportunityName = `${lead.location || 'Property'} Revenue Report`
  const payload = {
    locationId,
    contactId,
    pipelineId,
    pipelineStageId,
    name: opportunityName,
    source: 'Hudson Stays Website Revenue Report',
    status: getEnv('GHL_OPPORTUNITY_STATUS') || 'open',
    monetaryValue: Math.round(report.estimates.annualGap || report.estimates.mid || 0),
    assignedTo: getEnv('GHL_ASSIGNED_USER_ID'),
  }

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) {
      delete payload[key]
    }
  })

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/opportunities/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Version: '2021-07-28',
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const text = await response.text()
    const body = text ? safeJsonParse(text) || { raw: text.slice(0, 500) } : {}

    return {
      status: response.ok ? 'created' : 'failed',
      statusCode: response.status,
      opportunityId: body?.opportunity?.id || body?.id || null,
      message: response.ok ? 'Opportunity created in Go High Level.' : 'Go High Level opportunity creation failed.',
      response: response.ok ? undefined : body,
    }
  } catch (error) {
    return {
      status: 'failed',
      message: error instanceof Error ? error.message : 'Unknown Go High Level opportunity sync error.',
    }
  }
}

async function triggerGoHighLevelReportDelivery({ lead, report, contactId }) {
  const workflowWebhookUrl = getEnv('GHL_REPORT_WORKFLOW_WEBHOOK_URL')
  const triggerTag = getEnv('GHL_REPORT_TRIGGER_TAG')

  if (!workflowWebhookUrl && !triggerTag) {
    return {
      status: 'skipped_missing_delivery_config',
      message:
        'Set GHL_REPORT_TRIGGER_TAG for a tag-based email workflow or GHL_REPORT_WORKFLOW_WEBHOOK_URL for a workflow webhook.',
    }
  }

  if (triggerTag && !workflowWebhookUrl) {
    return {
      status: 'queued_by_tag',
      tag: triggerTag,
      message: 'Report delivery should be handled by the GoHighLevel workflow attached to this tag.',
    }
  }

  try {
    const response = await fetch(workflowWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactId,
        email: lead.email,
        phone: lead.phone,
        reportUrl: report.publicReportUrl || report.reportUrl,
        fitScore: report.internalScore,
        fitLabel: report.fitLabel,
        recommendedStrategy: report.recommendedStrategy,
        revenueLow: Math.round(report.estimates.low || 0),
        revenueHigh: Math.round(report.estimates.high || 0),
        ownerNetLow: Math.round(report.estimates.ownerNetLow || 0),
        ownerNetHigh: Math.round(report.estimates.ownerNetHigh || 0),
        location: lead.location,
      }),
    })

    return {
      status: response.ok ? 'triggered' : 'failed',
      statusCode: response.status,
      message: response.ok
        ? 'GoHighLevel report delivery workflow triggered.'
        : 'GoHighLevel report delivery workflow request failed.',
    }
  } catch (error) {
    return {
      status: 'failed',
      message: error instanceof Error ? error.message : 'Unknown GoHighLevel delivery workflow error.',
    }
  }
}

async function syncLeadToGoHighLevel({ lead, report, source }) {
  const token = getEnv('GHL_PRIVATE_INTEGRATION_TOKEN', 'GHL_API_KEY')
  const locationId = getEnv('GHL_LOCATION_ID')

  if (!token || !locationId) {
    return {
      status: 'skipped_missing_credentials',
      message: 'Set GHL_PRIVATE_INTEGRATION_TOKEN and GHL_LOCATION_ID to enable contact upsert.',
    }
  }

  const baseUrl = getEnv('GHL_API_BASE_URL') || 'https://services.leadconnectorhq.com'
  const tags = [
    'Website Revenue Report Submitted',
    source === 'hero' ? 'Hero Form Submitted' : 'Final CTA Form Submitted',
    lead.wantsSms ? 'SMS Eligible' : 'Email Only',
    report.fitLabel,
    getEnv('GHL_REPORT_TRIGGER_TAG'),
  ].filter(Boolean)

  const payload = {
    locationId,
    email: optionalString(lead.email),
    phone: lead.wantsSms ? optionalString(lead.phone) : undefined,
    source: 'Hudson Stays Website Revenue Report',
    tags,
    customFields: buildGhlCustomFields({ lead, report }),
  }

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined || (Array.isArray(payload[key]) && payload[key].length === 0)) {
      delete payload[key]
    }
  })

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/contacts/upsert`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Version: '2021-07-28',
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const text = await response.text()
    const body = text ? safeJsonParse(text) || { raw: text.slice(0, 500) } : {}
    const contactId = body?.contact?.id || body?.id || null
    const contactSync = {
      status: response.ok ? 'synced' : 'failed',
      statusCode: response.status,
      contactId,
      message: response.ok ? 'Lead upserted to Go High Level.' : 'Go High Level contact upsert failed.',
      response: response.ok ? undefined : body,
    }

    if (!response.ok) {
      return {
        ...contactSync,
        contactSync,
        opportunitySync: {
          status: 'skipped_contact_sync_failed',
          message: 'Opportunity creation skipped because contact upsert failed.',
        },
      }
    }

    const opportunitySync = await createGoHighLevelOpportunity({
      baseUrl,
      token,
      locationId,
      contactId,
      lead,
      report,
    })
    const deliverySync = await triggerGoHighLevelReportDelivery({ lead, report, contactId })

    return {
      ...contactSync,
      contactSync,
      opportunitySync,
      deliverySync,
    }
  } catch (error) {
    return {
      status: 'failed',
      message: error instanceof Error ? error.message : 'Unknown Go High Level sync error.',
    }
  }
}

async function readJsonBody(req) {
  let body = ''
  for await (const chunk of req) {
    body += chunk
  }

  return JSON.parse(body || '{}')
}

function revenueReportPlugin() {
  const reports = new Map()

  return {
    name: 'hudson-stays-report-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/revenue-report')) {
          next()
          return
        }

        res.setHeader('Content-Type', 'application/json')

        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Use POST.' }))
          return
        }

        try {
          const { lead, source = 'hero' } = await readJsonBody(req)
          const report = await createRevenueReport({ lead, source })
          const crmSync = await syncLeadToGoHighLevel({ lead: report.lead, report, source })

          reports.set(report.token, report)

          const integrationPlan = {
            crm: {
              provider: 'GoHighLevel',
              env: [
                'GHL_PRIVATE_INTEGRATION_TOKEN',
                'GHL_API_KEY',
                'GHL_LOCATION_ID',
                'GHL_PIPELINE_ID',
                'GHL_PIPELINE_STAGE_ID',
                'GHL_OPPORTUNITY_STATUS',
                'GHL_ASSIGNED_USER_ID',
                'GHL_CALENDAR_URL',
                'GHL_REPORT_TRIGGER_TAG',
                'GHL_REPORT_WORKFLOW_WEBHOOK_URL',
                'GHL_CF_PROPERTY_LOCATION_ID',
                'GHL_CF_PROPERTY_ADDRESS_ID',
                'GHL_CF_LISTING_URL_ID',
                'GHL_CF_BEDROOMS_ID',
                'GHL_CF_BATHROOMS_ID',
                'GHL_CF_CURRENT_RENT_ID',
                'GHL_CF_FURNISHED_STATUS_ID',
                'GHL_CF_ESTIMATED_LOW_ID',
                'GHL_CF_ESTIMATED_HIGH_ID',
                'GHL_CF_OWNER_NET_LOW_ID',
                'GHL_CF_OWNER_NET_HIGH_ID',
                'GHL_CF_FIT_LABEL_ID',
                'GHL_CF_FIT_SCORE_ID',
                'GHL_CF_RECOMMENDED_STRATEGY_ID',
                'GHL_CF_CONFIDENCE_ID',
                'GHL_CF_REGULATION_SUMMARY_ID',
                'GHL_CF_REPORT_URL_ID',
              ],
              tags: [
                'Website Revenue Report Submitted',
                source === 'hero' ? 'Hero Form Submitted' : 'Final CTA Form Submitted',
                report.lead.wantsSms ? 'SMS Eligible' : 'Email Only',
                report.fitLabel,
                getEnv('GHL_REPORT_TRIGGER_TAG'),
              ].filter(Boolean),
              pipelineStage: 'New Property Revenue Report Lead',
              status: crmSync.status,
              contactSync: crmSync,
            },
            marketData: {
              provider: 'Rabbu backend source',
              env: ['RABBU_API_KEY', 'RABBU_API_URL', 'RABBU_API_METHOD'],
              publicBranding: 'market data',
              status: report.integrations.rabbu.status,
              message: report.integrations.rabbu.message,
            },
            generation: {
              provider: 'OpenAI report generation',
              env: ['OPENAI_API_KEY', 'OPENAI_MODEL', 'OPENAI_ENABLE_WEB_SEARCH'],
              status: report.integrations.openai.status,
              model: report.integrations.openai.model,
              webSearchEnabled: report.integrations.openai.webSearchEnabled,
            },
            delivery: {
              email: {
                provider: 'GoHighLevel workflow',
                env: ['REPORT_BASE_URL', 'GHL_REPORT_TRIGGER_TAG', 'GHL_REPORT_WORKFLOW_WEBHOOK_URL'],
                subject: 'Your Free Property Revenue Report is ready',
                primaryCta: 'View My Property Revenue Report',
                status: crmSync.deliverySync?.status || 'not_configured',
              },
              sms: report.lead.wantsSms
                ? {
                    env: ['SMS_PROVIDER_API_KEY', 'REPORT_BASE_URL'],
                    copy: 'Your Hudson Stays Property Revenue Report is ready: {{report_link}}',
                  }
                : null,
            },
          }

          res.end(JSON.stringify({ success: true, report, crmSync, integrationPlan }))
        } catch (error) {
          res.statusCode = 400
          res.end(
            JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Invalid report request.',
            }),
          )
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [revenueReportPlugin(), researchPlugin(), react()],
})
