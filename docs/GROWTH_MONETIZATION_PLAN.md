# Growth and Monetization Plan (Launch-first)

This document keeps monetization practical while preserving a generous free tier.

## Phase 1: Launch and Trust (Now)

- Ship public open-source project.
- Deploy on Vercel with strong SEO.
- Track usage with GA4.
- Build social proof (GitHub stars, demos, conversion quality).

## Phase 2: Donation-only (Low friction)

Enable donations before hard paywalls.

Recommended donation anchors (India-friendly):

- ₹99: Supporter
- ₹249: Power user support
- ₹499: Sponsor a new format

Global equivalents:

- $3 / $7 / $15

## Phase 3: Freemium (No hard conversion cap)

Keep unlimited conversions free. Charge for advanced productivity features.

Suggested free features:

- Unlimited standard conversions
- Local processing
- Basic quality presets

Suggested Pro features:

- Batch queue profiles and saved workflows
- Priority conversion engines / faster workers
- High-quality AI-enhanced routes
- OCR and document intelligence workflows
- Team workspace, history sync, API keys
- Commercial usage license and support SLA

## Account Setup Checklist

## GA4

1. Create Google Analytics account.
2. Create GA4 property for your production domain.
3. Create Web data stream.
4. Copy measurement ID (`G-XXXXXXXXXX`).
5. Set `VITE_GA_MEASUREMENT_ID` in Vercel env vars.
6. Verify events in GA4 DebugView.

## Donations

Pick one primary + one backup:

- Buy Me a Coffee
- Ko-fi
- GitHub Sponsors

Set:

- `VITE_DONATE_URL`
- `VITE_DONATE_SECONDARY_URL`

## Ads (Later)

Use only after traffic quality improves.

1. Create AdSense account and connect domain.
2. Ensure policy pages exist (privacy/terms/contact).
3. Get approved.
4. Add ad client and slot:
   - `VITE_ADSENSE_CLIENT_ID`
   - `VITE_ADSENSE_SLOT_ID`

## Conversion Funnel Targets

Early targets:

- Visitor -> First conversion: > 35%
- First conversion -> Repeat session in 7 days: > 20%
- Repeat user -> Donation click: > 2%

## Policy Pages to Add Before Ads

- Privacy Policy
- Terms of Service
- Contact / Support
- Cookie note (if analytics/ads active)
