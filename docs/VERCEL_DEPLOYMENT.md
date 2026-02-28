# Vercel Deployment Guide

This project is a static Vite app and deploys cleanly on Vercel.

## 1. Import Repository

1. Go to Vercel dashboard.
2. Click **Add New Project**.
3. Import your GitHub repository.

## 2. Build Settings

Use these settings:

- Framework: `Vite`
- Build command: `npm run build`
- Output directory: `dist`

`vercel.json` is already included with cache and security headers.

## 3. Environment Variables

Set these for production:

- `VITE_BASE_PATH=/`

Optional:

- `VITE_GA_MEASUREMENT_ID`
- `VITE_FEEDBACK_URL`
- `VITE_ADSENSE_CLIENT_ID`
- `VITE_ADSENSE_SLOT_ID`

## 4. Domain + SEO

1. Add your custom domain in Vercel.
2. Enable HTTPS.
3. Update canonical/sitemap references if domain changes from `transformo.vercel.app`.

SEO files already added:

- `/robots.txt`
- `/sitemap.xml`
- OpenGraph and Twitter metadata
- JSON-LD `SoftwareApplication` schema

## 5. Verify Post-Deploy

- Homepage loads under your domain.
- WebAssembly assets load from `/wasm/*` without 404.
- `robots.txt` and `sitemap.xml` resolve correctly.
- Share preview works on WhatsApp/Twitter/LinkedIn.

## Optional CI Deployment

Workflow already included: `.github/workflows/vercel.yml`

Add GitHub repo secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
