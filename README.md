# Transformo — Universal File Converter

> **Convert any file to any format, instantly — right in your browser.**

[![License: GPL-2.0](https://img.shields.io/badge/License-GPL%202.0-blue.svg)](LICENSE)
[![Made with Vite](https://img.shields.io/badge/Built%20with-Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

---

## What is Transformo?

Most file converters are slow, boring, and require you to upload your files to some external server — which is terrible for privacy. They also typically only handle conversions *within the same medium* (images to images, audio to audio, etc.).

**Transformo** is different:

- 🔒 **100% private** — All conversion happens locally in your browser. Your files *never leave your device*.
- ⚡ **Blazing fast** — Powered by WebAssembly engines (FFmpeg, ImageMagick, Pandoc, and more).
- 🌐 **Truly universal** — Convert across formats *and* across media types. Need to turn an AVI video into a PDF? Transformo will try.
- 📱 **Mobile-first** — Fully responsive premium design that works beautifully on any screen.
- 🆓 **Free and open source** — Forever.

---

## Supported Conversions

Transformo supports hundreds of formats across many categories:

| Category | Examples |
|----------|---------|
| **Images** | PNG, JPEG, GIF, WebP, AVIF, BMP, TIFF, SVG, QOI, ... |
| **Video** | MP4, WebM, AVI, MOV, MKV, GIF, ... |
| **Audio** | MP3, WAV, OGG, FLAC, AAC, MIDI, QOA, ... |
| **Documents** | PDF, DOCX, HTML, Markdown, EPUB, RTF, ... |
| **Data** | JSON, XML, YAML, CSV, SQLite, ... |
| **Archives** | ZIP, LZH, ... |
| **Fonts** | TTF, OTF, WOFF, WOFF2, ... |
| **3D / Code / Games** | And much more... |

> **Note:** Transformo uses a graph-based conversion routing system. If a direct path doesn't exist, it automatically chains multiple converters to find the best route.

---

## How to Use

1. **Open Transformo** in your browser.
2. **Drop your file** onto the upload area, click to browse, or paste with `Ctrl+V`.
3. The input format will be **auto-detected** — select it manually if needed.
4. **Choose an output format** from the right panel.
5. Click **Convert** and your file will download automatically.

### Simple vs Advanced Mode

- **Simple Mode** (default): Formats are grouped by file type. Recommended for most users.
- **Advanced Mode**: Shows individual conversion handlers, giving you fine-grained control over which tool processes your file.

---

## Running Locally

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js 18+
- Git with submodule support

### Setup

```bash
# Clone with submodules (required for some handlers)
git clone --recursive https://github.com/YOUR_USERNAME/transformo

cd transformo

# Install dependencies
bun install

# Start the development server
bunx vite
```

> **Tip:** On first run, format caches are built on-demand (you'll see warnings in the console). After they're ready, run `printSupportedFormatCache()` in the browser console and save the output to `cache.json` to skip the loading step on future visits.

### Production Build

```bash
bun run build
```

### Base Path (Important)

This project supports both root-domain deploys (Vercel) and subpath deploys (GitHub Pages).

- Vercel/custom domain root: `VITE_BASE_PATH=/`
- GitHub Pages repo path: `VITE_BASE_PATH=/transformo/`

Example:

```bash
VITE_BASE_PATH=/ bun run build
```

## Monetization & Analytics Setup

Transformo now supports optional donation links, GA4 analytics, and an AdSense slot via environment variables.

1. Copy `.env.example` to `.env`.
2. Fill only the values you want to enable.
3. Restart the dev server.

```bash
cp .env.example .env
```

### Variables

- `VITE_GA_MEASUREMENT_ID`: Enables Google Analytics 4 tracking.
- `VITE_DONATE_URL`: Primary donation URL shown after successful conversion.
- `VITE_DONATE_SECONDARY_URL`: Optional secondary support URL.
- `VITE_FEEDBACK_URL`: Optional feedback form URL.
- `VITE_ADSENSE_CLIENT_ID` + `VITE_ADSENSE_SLOT_ID`: Enables the ad slot in the support strip.

---

## Deployment (Vercel)

See the full guide: [`docs/VERCEL_DEPLOYMENT.md`](docs/VERCEL_DEPLOYMENT.md)

---

## Open Source Release Process

See release checklist: [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md)
Growth + monetization roadmap: [`docs/GROWTH_MONETIZATION_PLAN.md`](docs/GROWTH_MONETIZATION_PLAN.md)

Tag releases using semver:

```bash
git tag v1.0.0
git push origin v1.0.0
```

On tag push (`v*.*.*`), GitHub Actions builds and publishes a release artifact automatically.

---

## Architecture Overview

```
transformo/
├── index.html              # App entry point
├── style.css               # Global design system & styles
├── src/
│   ├── main.ts             # Main UI logic & event handling
│   ├── FormatHandler.ts    # Handler interface & types
│   ├── TraversionGraph.ts  # Graph-based conversion routing
│   ├── CommonFormats.ts    # Standard format definitions
│   ├── normalizeMimeType.ts
│   └── handlers/           # Conversion engines
│       ├── FFmpeg.ts       # Video/audio/image (FFmpeg WASM)
│       ├── ImageMagick.ts  # Image manipulation
│       ├── pandoc/         # Document conversion
│       ├── font.ts         # Font format conversion
│       └── ...             # 40+ more handlers
├── docker/                 # Docker deployment configs
└── test/                   # Test resources
```

### How the Conversion Graph Works

Transformo builds a **directed graph** of all known format conversions across all handlers. When you request a conversion:

1. It searches the graph for the shortest valid path from input → output format.
2. If the direct conversion fails (e.g., due to an incompatibility), it marks that edge as a "dead end" and tries alternate routes.
3. Files pass through each intermediate handler in sequence until the final output is produced.

---

## Contributing

### Adding a New Format Handler

Each conversion tool is wrapped in a standardized handler class. Here's a minimal example:

```typescript
// src/handlers/myformat.ts
import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";
import CommonFormats from "src/CommonFormats.ts";

class myformatHandler implements FormatHandler {
  public name: string = "myformat";
  public supportedFormats?: FileFormat[];
  public ready: boolean = false;

  async init() {
    this.supportedFormats = [
      CommonFormats.PNG.builder("png")
        .markLossless()
        .allowFrom(true)
        .allowTo(true),
    ];
    this.ready = true;
  }

  async doConvert(
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat
  ): Promise<FileData[]> {
    // Your conversion logic here
    return [];
  }
}

export default myformatHandler;
```

Then register it in `src/handlers/index.ts`.

### Guidelines

- Name the class `{name}Handler` and the file `{name}.ts`.
- The handler is responsible for setting the output file name.
- Never mutate input byte buffers — clone with `new Uint8Array()` if needed.
- Run MIME types through `normalizeMimeType` before comparison.
- Treat files as the media they represent, not as raw data (an SVG is an image, not XML).

### Adding Dependencies

- **npm packages**: `bun add your-package`
- **Git repos**: Add as a submodule under `src/handlers/`
- **WebAssembly binaries**: Add to `vite.config.js` under the `wasm/` target directory.

### Project Standards

- Changelog: [`CHANGELOG.md`](CHANGELOG.md)
- Code of Conduct: [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md)
- Security Policy: [`SECURITY.md`](SECURITY.md)

---

## License

Transformo is licensed under the **GNU General Public License v2.0**. See [LICENSE](LICENSE) for details.

---

<p align="center">Built with ❤️ using TypeScript, Vite, and WebAssembly</p>
