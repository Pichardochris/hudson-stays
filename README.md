# Hudson Stays Revenue Report Funnel

Public MVP funnel for Hudson Stays furnished rental management and cohosting leads.

## What Works Now

- Homepage uses the Hudson Stays positioning from the build spec.
- Hero includes the Free Property Revenue Report form and locked report preview.
- Form requires only city/state or ZIP, bedrooms, bathrooms, rent baseline, and furnished status. Email is optional for local report testing, with optional address/listing URL fields for better report confidence.
- SMS checkbox reveals and validates the phone field only when selected.
- Submission shows the branded report loading state.
- A preliminary report is generated and displayed on-page.
- Report URLs use `/property-report/{secure_token}` without email or phone in the URL.
- Final CTA repeats the simplified report form before FAQ.
- Tracking events are dispatched as `hudson_stays_tracking` browser events and logged in the console.
- Vite middleware provides server-side report generation with an internal calculator, optional Rabbu enrichment, optional OpenAI structured report generation/regulation summary, GoHighLevel contact upsert, optional opportunity creation, and optional GHL workflow delivery.

## Run Locally

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 5174
```

Open:

```text
http://127.0.0.1:5174
```

## API Stub

`POST /api/revenue-report`

The endpoint creates a preliminary report response, attempts Rabbu/OpenAI enrichment when configured, syncs the lead to GoHighLevel when configured, and returns an `integrationPlan` describing what ran:

- GoHighLevel contact create/update through `/contacts/upsert`
- Optional GoHighLevel opportunity creation through `/opportunities/`
- Website Revenue Report tags
- New Property Revenue Report Lead pipeline stage
- Backend-only Rabbu market data lookup through `RABBU_API_URL`
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

Do not expose API keys in client-side code. Use `VITE_GHL_CALENDAR_URL` only for the public booking URL and `VITE_GHL_ONBOARDING_FORM_URL` only for the public onboarding form URL. Custom field IDs are optional; if omitted, the contact still syncs with tags, email, phone when requested, and source. Set `GHL_REPORT_TRIGGER_TAG` when a GHL workflow should send the report email after the contact is tagged, or set `GHL_REPORT_WORKFLOW_WEBHOOK_URL` when a workflow webhook should receive the report payload directly.

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
- Add a locked Rabbu response parser once the exact Rabbu endpoint/sample response is confirmed.
- Connect the selected GoHighLevel report email workflow/template in production.
- Add report view/click tracking against a backend store rather than local browser storage.
- Add SMS delivery only for SMS Eligible leads.
- Add rate limiting and bot protection before paid traffic.
