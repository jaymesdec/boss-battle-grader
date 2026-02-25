---
title: "PDF.js v5.x Worker Module Loading Failure"
date: 2026-02-03
category: runtime-errors
tags:
  - pdfjs
  - worker
  - esm
  - cdn
  - batch-upload
  - pdf-processing
  - module-loading
module: pdf-processing
symptoms:
  - "Setting up fake worker failed: Failed to fetch dynamically imported module"
  - "Failed to fetch dynamically imported module: http://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.530/pdf.worker.min.js"
  - "PDF upload fails in BatchUploadModal"
  - "PDF worker initialization error"
affected_components:
  - src/components/PDFViewer.tsx
  - src/components/BatchUploadModal.tsx
---

# PDF.js v5.x Worker Module Loading Failure

## Problem

When uploading PDFs via the batch upload feature, the following error appears:

```
Setting up fake worker failed: "Failed to fetch dynamically imported module:
http://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.530/pdf.worker.min.js"
```

PDFs fail to process and show error state in the upload modal.

## Root Cause

PDF.js version 5.4.530 (and other v5.x releases) uses **ES Modules (ESM)** for its web worker files, which have the `.mjs` extension. The original code was attempting to load the worker from a CDN using the legacy `.min.js` file format:

```typescript
// BROKEN - Old approach using CDN with .js extension
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
```

This caused the PDF.js worker to fail to load because:

1. The CDN URL pattern was outdated for PDF.js v5.x
2. The `.min.js` file format is no longer used - v5.x ships with `.mjs` (ESM modules)
3. Version mismatch between the installed package (5.4.530) and what might be available on the CDN
4. Protocol-relative URLs (`//`) can cause issues in certain environments

## Solution

### Step 1: Copy the Worker File to Public Directory

Copy the ESM worker file from `node_modules` to the `public/` directory so it can be served as a static asset:

```bash
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/
```

### Step 2: Update Worker Configuration in PDFViewer.tsx

**File:** `src/components/PDFViewer.tsx` (line 25)

**Before:**
```typescript
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
```

**After:**
```typescript
// Configure worker from local file (copied from node_modules/pdfjs-dist/build/)
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
```

### Step 3: Update Worker Configuration in BatchUploadModal.tsx

**File:** `src/components/BatchUploadModal.tsx` (line 571)

**Before:**
```typescript
const pdfjs = await import('pdfjs-dist');
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
```

**After:**
```typescript
const pdfjs = await import('pdfjs-dist');
// Configure worker from local file (copied from node_modules/pdfjs-dist/build/)
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
```

## Prevention

### Automate Worker File Synchronization

Add a postinstall script to `package.json` to automatically copy the worker file whenever dependencies are installed or updated:

```json
{
  "scripts": {
    "postinstall": "cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/"
  }
}
```

### Upgrade Checklist

When upgrading `pdfjs-dist`, follow this checklist:

- [ ] Check the [release notes](https://github.com/nicolo-ribaudo/pdfjs-dist/releases) for breaking changes
- [ ] Verify worker file naming conventions haven't changed (e.g., `.js` vs `.mjs`)
- [ ] Run `npm install` (postinstall will copy the new worker file)
- [ ] Test PDF loading functionality in development
- [ ] Test PDF loading in production build

### CI/CD Verification

Add a build step to verify the worker file is present:

```yaml
- name: Verify PDF.js worker
  run: |
    if [ ! -f "public/pdf.worker.min.mjs" ]; then
      echo "Error: PDF.js worker file missing"
      exit 1
    fi
```

## Key Points

1. **Local file serving** - Using `/pdf.worker.min.mjs` serves the file from the Next.js `public/` directory, ensuring version consistency
2. **ESM format (.mjs)** - PDF.js v5.x requires the ES Module worker file, not the legacy CommonJS format
3. **No version interpolation** - Removing `${pdfjs.version}` from the path eliminates CDN version availability issues
4. **Both files updated** - The fix must be applied to both `PDFViewer.tsx` and `BatchUploadModal.tsx` since they independently configure the worker

## Related

- [PDF.js GitHub Repository](https://github.com/nicolo-ribaudo/pdfjs-dist)
- Similar ESM/CJS handling pattern exists in `src/lib/tools/content.ts` for `pdf-parse`
