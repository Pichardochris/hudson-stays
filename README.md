# Hudson Stays Revenue Report Funnel

Public MVP funnel for Hudson Stays furnished rental management and cohosting leads.

## What Works Now

- Homepage uses the Hudson Stays positioning from the build spec.
- Hero includes the Free Property Revenue Report form and locked report preview.
- Form requires city/state or ZIP, bedrooms, bathrooms, rent baseline, furnished status, and email. Address and listing URL are optional fields for better follow-up and report confidence.
- The public homepage form does not collect phone numbers or SMS opt-in consent while the GoHighLevel chat widget is embedded on the page.
- Submission shows the branded report loading state.
- A preliminary report is generated and displayed on-page.
- Report URLs use `/property-report/{secure_token}` without email or phone in the URL.
- Final CTA repeats the simplified report form before FAQ.
- Tracking events are dispatched as `hudson_stays_tracking` browser events and logged in the console.
- A production Vercel API route accepts report leads, generates a preliminary report response, and forwards the lead to Google Sheets, Slack, and email notification webhooks when configured.
- Vite middleware still provides local server-side report generation with an internal calculator, optional Rabbu enrichment, optional OpenAI structured report generation/regulation summary, GoHighLevel contact upsert, optional opportunity creation, and optional GHL workflow delivery.

## Run Locally

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 5174
```

Open:

```text
http://127.0.0.1:5174
```

## Production Lead API

`POST /api/revenue-report`

On Vercel, the production route validates the lead, creates a preliminary report, and sends notifications when these optional environment variables are configured:

- `GOOGLE_LEAD_WEBHOOK_URL` or `GOOGLE_SHEETS_WEBHOOK_URL`: usually a Google Apps Script web app that appends the lead to a Google Sheet. The script can also email `hudsonstays@gmail.com`.
- `LEAD_NOTIFICATION_WEBHOOK_URL`: optional email-notification webhook if email is handled outside the Google Apps Script.
- `LEAD_NOTIFICATION_TO`: defaults to `hudsonstays@gmail.com`.
- `SLACK_WEBHOOK_URL`: Slack incoming webhook for the NREI Opportunities channel.

The endpoint returns `leadNotifications` statuses so you can see whether each destination was sent, failed, or skipped because the URL is missing.

## Local API Middleware

The endpoint creates a preliminary report response, attempts Rabbu/OpenAI enrichment when configured, syncs the lead to GoHighLevel when configured, and returns an `integrationPlan` describing what ran:

- GoHighLevel contact create/update through `/contacts/upsert`
- Optional GoHighLevel opportunity creation through `/opportunities/`
- Website Revenue Report tags
- New Property Revenue Report Lead pipeline stage
- Rabbu.com Airbnb Calculator data through `RABBU_CALCULATOR_WEBHOOK_URL`
- Optional direct Rabbu API fallback through `RABBU_API_URL`
- OpenAI owner-facing report generation with structured JSON
- GoHighLevel report email delivery through a trigger tag or workflow webhook
- Optional SMS report link delivery

## Environment Variables For Real Integrations

```env
GHL_PRIVATE_INTEGRATION_TOKEN=
GHL_LOCATION_ID=
GHL_API_BASE_URL=https://services.leadconnectorhq.com
GHL_PIPELINE_ID=
GHL_PIPELINE_STAGE_ID=
GHL_OPPORTUNITY_STATUS=open
GHL_ASSIGNED_USER_ID=
GHL_CALENDAR_URL=
GHL_REPORT_TRIGGER_TAG=
GHL_REPORT_WORKFLOW_WEBHOOK_URL=
GOOGLE_LEAD_WEBHOOK_URL=
GOOGLE_SHEETS_WEBHOOK_URL=
LEAD_NOTIFICATION_TO=hudsonstays@gmail.com
LEAD_NOTIFICATION_WEBHOOK_URL=
SLACK_WEBHOOK_URL=
GHL_CF_PROPERTY_LOCATION_ID=
GHL_CF_PROPERTY_ADDRESS_ID=
GHL_CF_LISTING_URL_ID=
GHL_CF_BEDROOMS_ID=
GHL_CF_BATHROOMS_ID=
GHL_CF_CURRENT_RENT_ID=
GHL_CF_FURNISHED_STATUS_ID=
GHL_CF_ESTIMATED_LOW_ID=
GHL_CF_ESTIMATED_HIGH_ID=
GHL_CF_OWNER_NET_LOW_ID=
GHL_CF_OWNER_NET_HIGH_ID=
GHL_CF_FIT_LABEL_ID=
GHL_CF_FIT_SCORE_ID=
GHL_CF_RECOMMENDED_STRATEGY_ID=
GHL_CF_CONFIDENCE_ID=
GHL_CF_REGULATION_SUMMARY_ID=
GHL_CF_REPORT_URL_ID=
RABBU_CALCULATOR_WEBHOOK_URL=
RABBU_CALCULATOR_WEBHOOK_TOKEN=
RABBU_API_KEY=
RABBU_API_URL=
RABBU_API_METHOD=GET
HUDSON_STAYS_MANAGEMENT_FEE=0.25
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5
OPENAI_ENABLE_WEB_SEARCH=false
REPORT_BASE_URL=
WEBHOOK_SECRET=
EMAIL_FROM=
SMS_PROVIDER_API_KEY=
VITE_GHL_CALENDAR_URL=
VITE_GHL_ONBOARDING_FORM_URL=
```

Do not expose API keys in client-side code. Use `VITE_GHL_CALENDAR_URL` only for the public booking URL and `VITE_GHL_ONBOARDING_FORM_URL` only for the public onboarding form URL. Custom field IDs are optional; if omitted, the contact still syncs with tags, email, and source. Set `GHL_REPORT_TRIGGER_TAG` when a GHL workflow should send the report email after the contact is tagged, or set `GHL_REPORT_WORKFLOW_WEBHOOK_URL` when a workflow webhook should receive the report payload directly.

## Editing And Deployment Workflow

Use this workflow for future Hudson Stays updates:

1. Codex edits the code locally.
2. Codex runs `npm run build` and checks the key pages.
3. Codex creates a Vercel preview deployment, not a production deployment.
4. You review the preview link and approve changes.
5. Codex deploys to the live `hudson-stays` Vercel project only after approval.

GitHub should be treated as the source backup and version history. Vercel environment variables remain outside GitHub.

### Rabbu Calculator Source

The preferred revenue source is Rabbu's public Airbnb Calculator at `https://rabbu.com/airbnb-calculator`. The report endpoint expects a private automation endpoint in `RABBU_CALCULATOR_WEBHOOK_URL` that:

1. Opens Rabbu's Airbnb Calculator.
2. Enters the submitted full property address and bedroom/bathroom inputs.
3. Waits for the Rabbu results page.
4. Returns JSON containing the gross monthly revenue range or projection, ADR, occupancy, RevPAN, and comparable-property details when available.

Direct server-side fetching of the Rabbu webpage can be blocked by the site, so use an approved browser automation service or official Rabbu access for production. If the calculator webhook is missing or cannot parse a result, the site falls back to the direct Rabbu API variables when configured, then to the internal preliminary calculator.

## Tracking Events

Implemented event names:

```text
hero_form_submitted
final_cta_form_submitted
report_generated
report_viewed
email_report_link_clicked
sms_report_link_clicked
onpage_revenue_manager_cta_clicked
report_top_cta_clicked
report_recommendation_cta_clicked
email_booking_cta_clicked
call_booked
```

## Next Integrations

- Replace the Vite middleware with production API routes or serverless functions before deployment.
- Connect the Rabbu calculator automation or official Rabbu API response and lock the parser to the exact production payload.
- Connect the selected GoHighLevel report email workflow/template in production.
- Add report view/click tracking against a backend store rather than local browser storage.
- Add SMS delivery only for SMS Eligible leads.
- Add rate limiting and bot protection before paid traffic.
