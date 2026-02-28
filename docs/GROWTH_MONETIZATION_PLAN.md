# Growth and Monetization Plan (Launch-first)

This document keeps monetization practical while preserving a generous free tier.

## Phase 1: Launch and Trust (Now)

- Ship public open-source project.
- Deploy on Vercel with strong SEO.
- Track usage with GA4.
- Build social proof (GitHub stars, demos, conversion quality).

## Phase 2: Engagement-first (Low friction)

Focus on retention before any monetization layers.

- Improve conversion success rate on top requested routes.
- Add polished onboarding and examples for first-time users.
- Collect actionable feedback from real users.
- Publish regular release notes and roadmap updates.

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

## Ads (Later)

Use only after traffic quality improves.

1. Create AdSense account and connect domain.
2. Ensure policy pages exist (privacy/terms/contact).
3. Get approved.
4. Keep ad integration disabled until policies, UX placement, and quality thresholds are final.

## Conversion Funnel Targets

Early targets:

- Visitor -> First conversion: > 35%
- First conversion -> Repeat session in 7 days: > 20%
- Repeat user -> Feature request or feedback: > 2%

## Policy Pages to Add Before Ads

- Privacy Policy
- Terms of Service
- Contact / Support
- Cookie note (if analytics/ads active)
