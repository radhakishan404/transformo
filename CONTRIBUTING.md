# Contributing to Transformo

Thank you for your interest in contributing to Transformo! Here's everything you need to know.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Adding File Format Support](#adding-file-format-support)
- [Submitting a Bug Report](#submitting-a-bug-report)
- [Requesting a File Format](#requesting-a-file-format)
- [Development Guidelines](#development-guidelines)

---

## Code of Conduct

Be respectful, constructive, and patient. We're all here to make something great together.

---

## Getting Started

```bash
# 1. Fork the repository and clone it with submodules
git clone --recursive https://github.com/YOUR_USERNAME/transformo

# 2. Install dependencies
bun install

# 3. Start the dev server
bunx vite
```

---

## Adding File Format Support

The best way to contribute is by adding support for new file formats.

### Structure

Each conversion tool is wrapped in a standardized handler class in `src/handlers/`. Register new handlers in `src/handlers/index.ts`.

### Handler Template

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
        .allowTo(false),
    ];
    this.ready = true;
  }

  async doConvert(
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat
  ): Promise<FileData[]> {
    const outputFiles: FileData[] = [];
    // Your conversion logic here
    return outputFiles;
  }
}

export default myformatHandler;
```

### Handler Rules

- Class name must be `{name}Handler`, file name must be `{name}.ts`
- The handler is responsible for setting output file names (usually just swapping extension)
- **Never mutate input byte buffers** — wrap in `new Uint8Array()` to clone if needed
- Run MIME types through `normalizeMimeType` before any comparisons
- Treat files as the media they represent (an SVG is an **image**, not XML data)
- Keep handlers focused on a single tool/library

### Adding Dependencies

- **npm/jsr packages**: `bun add your-package`
- **Git repositories**: Add as a submodule under `src/handlers/`
- **WebAssembly binaries**: Reference in `vite.config.js` under the `wasm/` static copy targets

---

## Submitting a Bug Report

Before filing a bug:
1. Check if the issue is already reported in the issue tracker.
2. Reproduce the issue in the latest version.

A good bug report includes:
- **What happened** vs **what you expected**
- Steps to reproduce
- Browser and OS version
- Screenshots or console output if applicable

> **Note:** "Converting X to Y doesn't work" is **not** a bug report by itself.  
> "Converting X to Y produces a corrupted file" or "the convert button is unresponsive" **is** a bug report.

---

## Requesting a File Format

When requesting support for a new file format, please provide:

1. **What the format is** — name, description, common use cases
2. **What the conversion should look like** — what medium is it converting to/from?
3. **Reference implementations** — open-source libraries or examples (must be GPL-2.0 compatible)

> Simply listing format names without providing resources will likely result in your request being closed.  
> Developers need to implement these — good research saves everyone time.

---

## Development Guidelines

### TypeScript

- Enable strict mode (see `tsconfig.json`)
- Prefer `const` over `let` where possible
- Use meaningful variable names; avoid single-letter names except in short lambdas
- Add JSDoc comments to public APIs

### Performance

- Handlers should offload heavy work to WebAssembly where possible
- Avoid synchronous blocking operations in UI code
- Use `requestAnimationFrame` to yield to the browser between heavy operations

### Testing

Run the test suite before submitting a pull request:

```bash
bun test
```

Tests live in the `test/` directory and cover the conversion routing graph and common format paths.

---

## Pull Request Process

1. Fork the repo and create a feature branch: `git checkout -b feat/my-format`
2. Make your changes and ensure tests pass
3. Update the README if you're adding notable new functionality
4. Open a pull request with a clear description of what you've added/changed

---

Thanks again for contributing! 🚀
