# Transformo

> Your files called. They want a glow-up.

Transformo is a browser-first file format tool that runs locally on your device.
No uploads. No waiting-room energy. No "we are processing your file" emails.

## Why it exists

Most online converters are either:
- slow,
- privacy-questionable,
- or visually stuck in 2012.

Transformo is built to feel premium while staying open source and free for core use.

## What it does

- Local-first conversion in the browser
- Smart format detection from uploaded file
- Suggested output formats based on compatibility/quality/size goals
- Animated conversion UX with progress and route feedback
- Supports a wide range of image, audio, video, document, data, archive, and font formats

## Quick start

```bash
git clone --recursive https://github.com/radhakishan404/transformo.git
cd transformo
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Environment variables

Copy `.env.example` to `.env` and set only what you need.

- `VITE_BASE_PATH` (`/` for Vercel, `/transformo/` for GitHub Pages)
- `VITE_GA_MEASUREMENT_ID` (optional, GA4)
- `VITE_FEEDBACK_URL` (optional)
- `VITE_ADSENSE_CLIENT_ID` + `VITE_ADSENSE_SLOT_ID` (optional)

## Deploy

- Vercel deployment guide: [`docs/VERCEL_DEPLOYMENT.md`](docs/VERCEL_DEPLOYMENT.md)
- Release checklist: [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md)

## Contributing

PRs are welcome.
If you add a new handler, keep it fast, deterministic, and friendly to browser memory.

## License

GPL-2.0. See [`LICENSE`](LICENSE).

---

Built with TypeScript, Vite, WASM, and unreasonable optimism.
