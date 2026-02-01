'use client';

// =============================================================================
// PDFViewer - Render PDF pages as images with AI vision support
// =============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';

// Constants for image quality
const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.6;

// Dynamically import pdfjs-dist only on client side
let pdfjsLib: typeof import('pdfjs-dist') | null = null;

async function getPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  if (typeof window === 'undefined') return null;

  const pdfjs = await import('pdfjs-dist');

  // Configure worker from CDN using legacy build for browser compatibility
  pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

  pdfjsLib = pdfjs;
  return pdfjs;
}

export interface PDFPage {
  pageNumber: number;
  imageDataUrl: string; // Full data URL for display
  base64Data: string;   // Just the base64 portion for AI
  width: number;
  height: number;
}

interface PDFViewerProps {
  url: string;
  onPagesLoaded?: (pages: PDFPage[]) => void;
  onError?: (error: Error) => void;
}

export function PDFViewer({ url, onPagesLoaded, onError }: PDFViewerProps) {
  const [pages, setPages] = useState<PDFPage[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Render a single PDF page to canvas and extract as base64 JPEG
  const renderPageToImage = useCallback(async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdf: any, // PDFDocumentProxy type - using any to avoid import issues
    pageNumber: number
  ): Promise<PDFPage> => {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });

    // Calculate scale to fit within MAX_DIMENSION
    const scale = Math.min(
      MAX_DIMENSION / viewport.width,
      MAX_DIMENSION / viewport.height,
      2 // Cap at 2x for quality
    );

    const scaledViewport = page.getViewport({ scale });

    // Create canvas for rendering
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;

    // Render page to canvas
    await page.render({
      canvasContext: context,
      viewport: scaledViewport,
      canvas: canvas,
    }).promise;

    // Convert to JPEG data URL
    const imageDataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);

    // Extract just the base64 portion (strip "data:image/jpeg;base64,")
    const base64Data = imageDataUrl.replace(/^data:image\/jpeg;base64,/, '');

    return {
      pageNumber,
      imageDataUrl,
      base64Data,
      width: scaledViewport.width,
      height: scaledViewport.height,
    };
  }, []);

  // Load PDF and render all pages
  useEffect(() => {
    let cancelled = false;

    async function loadPDF() {
      setIsLoading(true);
      setError(null);

      try {
        // Dynamically load pdfjs on client side only
        const pdfjs = await getPdfJs();
        if (!pdfjs) {
          throw new Error('PDF.js could not be loaded');
        }

        if (cancelled) return;

        // Load the PDF document
        const loadingTask = pdfjs.getDocument(url);
        const pdf = await loadingTask.promise;

        if (cancelled) return;

        setTotalPages(pdf.numPages);

        // Render all pages
        const renderedPages: PDFPage[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
          const page = await renderPageToImage(pdf, i);
          renderedPages.push(page);
        }

        if (cancelled) return;

        setPages(renderedPages);
        setIsLoading(false);
        onPagesLoaded?.(renderedPages);
      } catch (err) {
        if (cancelled) return;
        const error = err instanceof Error ? err : new Error('Failed to load PDF');
        setError(error.message);
        setIsLoading(false);
        onError?.(error);
      }
    }

    loadPDF();

    return () => {
      cancelled = true;
    };
  }, [url, renderPageToImage, onPagesLoaded, onError]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-surface rounded-full" />
          <div className="absolute inset-0 border-4 border-t-accent-primary rounded-full animate-spin" />
        </div>
        <p className="text-text-muted text-sm font-display">LOADING PDF...</p>
        {totalPages > 0 && (
          <p className="text-text-muted text-xs">
            Rendering page {pages.length + 1} of {totalPages}
          </p>
        )}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <span className="text-4xl mb-4">❌</span>
        <p className="text-accent-danger font-display mb-2">FAILED TO LOAD PDF</p>
        <p className="text-text-muted text-sm">{error}</p>
      </div>
    );
  }

  // No pages
  if (pages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <span className="text-4xl mb-4">📄</span>
        <p className="text-text-muted">No pages found in PDF</p>
      </div>
    );
  }

  const currentPageData = pages[currentPage - 1];

  return (
    <div className="flex flex-col h-full">
      {/* Navigation Header */}
      <div className="flex items-center justify-between p-2 border-b border-surface bg-surface/30">
        <button
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className={`
            p-2 rounded-lg transition-all
            ${currentPage === 1
              ? 'text-text-muted cursor-not-allowed'
              : 'text-text-primary hover:bg-surface'
            }
          `}
          aria-label="Previous page"
        >
          ◀
        </button>

        <div className="flex items-center gap-2">
          <span className="font-display text-sm text-text-primary">
            SLIDE {currentPage}
          </span>
          <span className="text-text-muted text-sm">of {totalPages}</span>
        </div>

        <button
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
          className={`
            p-2 rounded-lg transition-all
            ${currentPage === totalPages
              ? 'text-text-muted cursor-not-allowed'
              : 'text-text-primary hover:bg-surface'
            }
          `}
          aria-label="Next page"
        >
          ▶
        </button>
      </div>

      {/* Main Image Display */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto bg-background/50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentPageData.imageDataUrl}
          alt={`Page ${currentPage}`}
          className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
          style={{ maxHeight: 'calc(100vh - 300px)' }}
        />
      </div>

      {/* Thumbnail Strip */}
      <div className="flex gap-2 p-2 border-t border-surface overflow-x-auto bg-surface/20">
        {pages.map((page, index) => (
          <button
            key={page.pageNumber}
            onClick={() => setCurrentPage(page.pageNumber)}
            className={`
              flex-shrink-0 rounded-lg overflow-hidden transition-all
              ${currentPage === page.pageNumber
                ? 'ring-2 ring-accent-primary'
                : 'opacity-60 hover:opacity-100'
              }
            `}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={page.imageDataUrl}
              alt={`Thumbnail ${page.pageNumber}`}
              className="h-16 w-auto object-contain bg-white"
            />
            <span className="block text-[10px] text-center text-text-muted py-0.5">
              {page.pageNumber}
            </span>
          </button>
        ))}
      </div>

      {/* Hidden canvas for rendering */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

// =============================================================================
// Utility function to get base64 images for AI analysis
// =============================================================================

export function getPDFImagesForAI(pages: PDFPage[]): Array<{
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/jpeg';
    data: string;
  };
}> {
  return pages.map((page) => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: 'image/jpeg' as const,
      data: page.base64Data,
    },
  }));
}
