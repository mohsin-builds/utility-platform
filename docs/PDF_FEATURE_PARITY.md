# iLovePDF functionality comparison — 20 October 2026

Source: https://www.ilovepdf.com/ (catalog reviewed 2026-10-20).
This is a product planning inventory, **not a representation that we have feature parity**.

## Implemented on feature branch (must pass real browser acceptance tests)
- Merge PDF; split PDF by page ranges; extract pages; delete pages; reorder by text sequence; rotate pages.
- Add page numbers (fixed bottom-centered layout); text watermark (simple centered, not image watermark).
- JPG/PNG/WebP images to PDF (existing); PDF to JPG/PNG by PDF.js rasterization; PDF-to-text extraction (only embedded text).
- Crop visible PDF page boxes (not content deletion); add text overlay (not existing-text edit); image stamp signature (not cryptographic signature).
- Rasterized scanned-PDF size reducer (flattens text and vectors; may increase size).
- Task workflow: Document Pack Builder. Browser image utilities separately supported.

## Not implemented / no public working links
- PDF to Word; Word to PDF; PDF to PowerPoint; PowerPoint to PDF; PDF to Excel; Excel to PDF.
- HTML/webpage to PDF; PDF/A conversion.
- Real object-level PDF compression or lossless optimized PDFs.
- Repair corrupted PDFs; full OCR with searchable output; scan-to-PDF capture flow.
- Edit existing PDF text/images; complete visual page organizer with previews; interactive fillable PDF forms.
- Cryptographic digital signatures, remote signature requests, password protection/unlocking.
- Secure permanent redaction; PDF comparisons with highlights; high-fidelity PDF-to-Markdown.
- AI summarizer and PDF translation; user-authored automated workflow composer; cloud integration.
- Extra iLovePDF premium variants (OCR to editable Office formats).

## Suggested technical foundation
- Keep static Cloudflare Pages and browser-first processing for standard edits.
- Bundle vendor JS locally later rather than trusting external runtime downloads where possible.
- PDF.js for rendering/text extraction; pdf-lib for structure/editing operations.
- Consider WASM PDF engines only after licensing/security/browser-memory tests.
- Test with encrypted, scanned, form, rotated, landscape, large, and malformed PDFs.
- No promises of Office or PDF/A fidelity without validated conversion engine.

## UX acceptance requirements
Accessible search/filter, responsive 2–5 column card layout, anchored task categories, predictable upload/process/download flow, keyboard access, explicit privacy & file limits, honest unavailable features, no fake working tool links.

### Additional source implementations 2026-10-21

- AcroForm field filling and flattening, not XFA form creation.
- PDF to basic Markdown derived from selectable text, not layout fidelity.
- PDF text-line comparison, not graphical comparison.
- English image PDF OCR to TXT only, not searchable PDF.

These have source code on the review branch but are not yet confirmed by browser end-to-end tests.
