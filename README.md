# Utility Platform

A clean, independent source repository for a free, browser-first digital utility platform. This independently branded site uses one source repository and Cloudflare Pages.

## What's working

- **26 original browser utilities** for images, PDF, text, developer work, and everyday tasks.
- **Document Pack Builder workflow:** resize a photo and signature to specified pixel dimensions, check basic file constraints on an existing PDF, and package outputs with a requirements report into a ZIP.
- Responsive utility directory, tool pages, descriptions, privacy information, sitemap, and security headers.

Eight additional browser PDF tools are staged on the PDF workbench branch: merge, split, extract, delete, rotate, reorder, watermark and page numbers. They rely on pdf-lib 1.17.1 loaded from jsDelivr, and do not upload PDF bytes. A preview browser end-to-end test is still required before production approval.\n\nSome advanced features discussed in the product roadmap (high-fidelity Office conversion, OCR, PDF compression, full AI task interpretation) are **not implemented yet**. Do not advertise them as available.

## Development and verification

Requires Node.js 20 or later for the static build; no npm dependency installation is needed.

```bash
node tests/workflow-unit.mjs\nnode tests/pdf-pages.mjs
node scripts/build.mjs
python3 -m http.server 8000 --directory dist
```

Open `http://localhost:8000`. Optional browser ZIP-export smoke test: `python3 tests/test_pack_browser.py` with Python Playwright, Pillow, and Chromium installed.

## Cloudflare Pages (Git-based deployment)

Source: **`mohsin-builds/utility-platform`**, branch **`main`**.

- Framework preset: `None`
- Build command: `node scripts/build.mjs`
- Build output: `dist`
- Root directory: `/` (or blank/repository root)
- Environment variables: none

Follow [DEPLOYMENT.md](DEPLOYMENT.md) to connect Cloudflare and migrate away from the original Direct Upload project safely.

## Privacy and limits

The included file tools process user-provided files in the browser; selected files are not sent to a processing API. The hosting service still receives standard webpage requests. Document Pack Builder validates basic PDF structure and size, **not document authenticity** or a receiving institution's acceptance requirements. Treat its output as a convenience tool, not an official validation.

## Project boundaries

- This is the **single new source repository**. No separate source copies are required for deployment.
- **Production site:** https://utility-platform.pages.dev/. Do not delete the old Cloudflare project without approval.
- Domain purchase and final customer-facing brand can be decided later.

## PDF-first upgrade (review branch)

As of 2026-10-20 the review branch now contains 16 PDF/document tools and 25 other utilities. New additions after the initial eight operations: PDF to JPG/PNG, rasterized PDF size reduction (not lossless), crop by crop box, text overlay, image-signature stamp, and extraction of selectable text. Source files are not submitted to a processing API; pdf-lib and pdf.js are loaded from jsDelivr. Real browser output checks remain a release gate.

**Not implemented:** genuine lossless PDF compression, accurate Office conversion, encrypted PDF protection/unlocking, archival PDF/A, permanent redaction, OCR, interactive forms, true digitally signed certificates, high-fidelity PDF editing, AI translation or summarization. Do not advertise these as working.

## Additional feature branch tools (2026-10-21)

Added five source implementations: fill existing interactive AcroForm fields, flatten form fields, PDF selectable text to basic Markdown, basic text-line comparisons, English scanned PDF OCR to TXT. These are **not verified as production-ready** and require browser tests. Office conversion, protected PDF handling, true redaction and full iLovePDF parity remain unavailable.

## Deployment verification

Production builds from the GitHub `main` branch through Cloudflare Pages using `node scripts/build.mjs`, output `dist`. The PDF-first directory includes 46 source tool pages; advanced browser tools still need end-to-end output verification. Some capabilities available on iLovePDF (e.g., high-fidelity Office conversion, secure redaction, encryption and PDF/A) remain unimplemented and must not be advertised as ready.

## Extended image suite (feature branch)

Added six image-tool source implementations: bulk rotate/flip, text watermark, meme creation, selected-area blur/solid cover, brightness/contrast/saturation adjustments, and standard interpolation image enlargement. These are new implementations pending end-to-end browser tests. They are not equivalent to AI background removal, AI photo restoration, or AI super-resolution.
