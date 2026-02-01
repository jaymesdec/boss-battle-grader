'use client';

// =============================================================================
// SubmissionViewer - Display student submission content with tabs
// =============================================================================

import { useState, useCallback, useEffect } from 'react';
import { PDFViewer, getPDFImagesForAI, type PDFPage } from './PDFViewer';
import type { CanvasSubmission, BatchAttachment } from '@/types';

// Type for PDF images formatted for Claude's vision API
export type PDFImageForAI = ReturnType<typeof getPDFImagesForAI>[number];

interface SubmissionViewerProps {
  submission: CanvasSubmission | null;
  isLoading?: boolean;
  onContentParsed?: (content: string) => void;
  onPDFPagesLoaded?: (pages: PDFPage[], aiImages: PDFImageForAI[]) => void;
  batchAttachment?: BatchAttachment | null;
}

export function SubmissionViewer({
  submission,
  isLoading = false,
  onContentParsed,
  onPDFPagesLoaded,
  batchAttachment,
}: SubmissionViewerProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [parsedContent, setParsedContent] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [batchImageIndex, setBatchImageIndex] = useState(0);

  // Handle PDF pages loaded - convert to AI format and notify parent
  const handlePDFPagesLoaded = useCallback((pages: PDFPage[]) => {
    const aiImages = getPDFImagesForAI(pages);
    onPDFPagesLoaded?.(pages, aiImages);
  }, [onPDFPagesLoaded]);

  // Reset batch image index when batch attachment changes
  useEffect(() => {
    setBatchImageIndex(0);
  }, [batchAttachment]);

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <div className="animate-pulse space-y-4 w-full max-w-md">
          <div className="h-8 bg-surface rounded w-3/4" />
          <div className="h-4 bg-surface rounded w-full" />
          <div className="h-4 bg-surface rounded w-5/6" />
          <div className="h-4 bg-surface rounded w-4/5" />
        </div>
        <p className="text-text-muted text-sm mt-4">Loading submission...</p>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-text-muted">
        <span className="text-6xl mb-4">📄</span>
        <p className="text-lg font-display">No Submission Selected</p>
        <p className="text-sm mt-2">Select a student to view their work</p>
      </div>
    );
  }

  // If there's a batch attachment, show it instead of regular submission
  if (batchAttachment) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-surface">
          <div className="flex items-center gap-2">
            <span className="text-accent-primary">📦</span>
            <span className="font-display text-sm text-text-primary">
              BATCH UPLOAD
            </span>
            <span className="px-2 py-0.5 bg-accent-secondary/20 text-accent-secondary text-xs rounded">
              {batchAttachment.pdfImages.length} pages
            </span>
          </div>
          <div className="text-xs text-text-muted">
            {batchAttachment.filename}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between p-2 border-b border-surface bg-surface/30">
          <button
            onClick={() => setBatchImageIndex((i) => Math.max(0, i - 1))}
            disabled={batchImageIndex === 0}
            className={`p-2 rounded-lg transition-all ${
              batchImageIndex === 0
                ? 'text-text-muted cursor-not-allowed'
                : 'text-text-primary hover:bg-surface'
            }`}
          >
            ◀
          </button>
          <span className="font-display text-sm text-text-primary">
            SLIDE {batchImageIndex + 1} of {batchAttachment.pdfImages.length}
          </span>
          <button
            onClick={() =>
              setBatchImageIndex((i) =>
                Math.min(batchAttachment.pdfImages.length - 1, i + 1)
              )
            }
            disabled={batchImageIndex === batchAttachment.pdfImages.length - 1}
            className={`p-2 rounded-lg transition-all ${
              batchImageIndex === batchAttachment.pdfImages.length - 1
                ? 'text-text-muted cursor-not-allowed'
                : 'text-text-primary hover:bg-surface'
            }`}
          >
            ▶
          </button>
        </div>

        {/* Image Display */}
        <div className="flex-1 flex items-center justify-center p-4 overflow-auto bg-background/50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={batchAttachment.pdfImages[batchImageIndex]}
            alt={`Page ${batchImageIndex + 1}`}
            className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
          />
        </div>

        {/* Thumbnails */}
        <div className="flex gap-2 p-2 border-t border-surface overflow-x-auto bg-surface/20">
          {batchAttachment.pdfImages.map((img, i) => (
            <button
              key={i}
              onClick={() => setBatchImageIndex(i)}
              className={`flex-shrink-0 rounded-lg overflow-hidden transition-all ${
                batchImageIndex === i
                  ? 'ring-2 ring-accent-primary'
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img}
                alt={`Thumbnail ${i + 1}`}
                className="h-16 w-auto object-contain bg-white"
              />
            </button>
          ))}
        </div>

        {/* AI Note */}
        <div className="p-2 bg-surface/30 border-t border-surface">
          <p className="text-xs text-text-muted text-center">
            📸 AI can see all {batchAttachment.pdfImages.length} slides when generating feedback
          </p>
        </div>
      </div>
    );
  }

  // Check if submission has been submitted
  if (!submission.submitted_at) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-text-muted">
        <span className="text-6xl mb-4">⏳</span>
        <p className="text-lg font-display">Not Yet Submitted</p>
        <p className="text-sm mt-2">This student hasn&apos;t submitted their work yet</p>
      </div>
    );
  }

  // Gather all content sources
  const contentSources: ContentSource[] = [];

  // Add attachments
  if (submission.attachments) {
    submission.attachments.forEach((attachment) => {
      contentSources.push({
        type: 'file',
        name: attachment.filename,
        url: attachment.url,
        contentType: attachment.content_type || 'application/octet-stream',
      });
    });
  }

  // Add submission body if present
  if (submission.body) {
    contentSources.push({
      type: 'text',
      name: 'Submission Text',
      content: submission.body,
    });
  }

  // Add URL if present
  if (submission.url) {
    contentSources.push({
      type: 'url',
      name: 'Submitted URL',
      url: submission.url,
    });
  }

  // Handle empty submission
  if (contentSources.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-text-muted">
        <span className="text-6xl mb-4">📭</span>
        <p className="text-lg font-display">Empty Submission</p>
        <p className="text-sm mt-2">No content found in this submission</p>
      </div>
    );
  }

  const activeSource = contentSources[activeTab];

  return (
    <div className="h-full flex flex-col">
      {/* Header with submission metadata */}
      <div className="flex items-center justify-between p-3 border-b border-surface">
        <div className="flex items-center gap-2">
          <span className="text-accent-primary">📋</span>
          <span className="font-display text-sm text-text-primary">
            Attempt {submission.attempt}
          </span>
          {submission.late && (
            <span className="px-2 py-0.5 bg-accent-danger/20 text-accent-danger text-xs rounded">
              LATE
            </span>
          )}
        </div>
        <div className="text-xs text-text-muted">
          {formatSubmissionDate(submission.submitted_at)}
        </div>
      </div>

      {/* Tabs for multiple content sources */}
      {contentSources.length > 1 && (
        <div className="flex gap-1 p-2 border-b border-surface overflow-x-auto">
          {contentSources.map((source, index) => (
            <button
              key={index}
              onClick={() => setActiveTab(index)}
              className={`
                px-3 py-1.5 text-xs rounded-lg whitespace-nowrap transition-all
                ${activeTab === index
                  ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary'
                  : 'bg-surface/50 text-text-muted hover:bg-surface border border-transparent'
                }
              `}
            >
              {getSourceIcon(source.type)} {source.name}
            </button>
          ))}
        </div>
      )}

      {/* Content display */}
      <div className="flex-1 overflow-auto p-4">
        <ContentDisplay
          source={activeSource}
          parsedContent={parsedContent}
          isParsing={isParsing}
          onPDFPagesLoaded={handlePDFPagesLoaded}
          onContentParsed={onContentParsed}
          onParse={async () => {
            if (activeSource.type === 'file' && activeSource.url) {
              setIsParsing(true);
              try {
                const content = await parseFileContent(activeSource.url, activeSource.contentType || '');
                setParsedContent(content);
                onContentParsed?.(content);
              } catch (error) {
                console.error('Failed to parse content:', error);
                setParsedContent('Failed to parse file content');
              } finally {
                setIsParsing(false);
              }
            }
          }}
        />
      </div>
    </div>
  );
}

// =============================================================================
// Content Source Types
// =============================================================================

interface FileSource {
  type: 'file';
  name: string;
  url: string;
  contentType: string;
}

interface TextSource {
  type: 'text';
  name: string;
  content: string;
}

interface UrlSource {
  type: 'url';
  name: string;
  url: string;
}

type ContentSource = FileSource | TextSource | UrlSource;

// =============================================================================
// Content Display Component
// =============================================================================

function ContentDisplay({
  source,
  parsedContent,
  isParsing,
  onParse,
  onPDFPagesLoaded,
  onContentParsed,
}: {
  source: ContentSource;
  parsedContent: string | null;
  isParsing: boolean;
  onParse: () => void;
  onPDFPagesLoaded?: (pages: PDFPage[]) => void;
  onContentParsed?: (content: string) => void;
}) {
  if (source.type === 'text') {
    return (
      <div className="prose prose-invert prose-sm max-w-none">
        <div
          className="text-text-primary"
          dangerouslySetInnerHTML={{ __html: source.content }}
        />
      </div>
    );
  }

  if (source.type === 'url') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-3 bg-surface rounded-lg">
          <span className="text-accent-secondary">🔗</span>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-primary hover:underline text-sm break-all"
          >
            {source.url}
          </a>
        </div>
        <p className="text-text-muted text-sm">
          Click the link to view the submitted content in a new tab.
        </p>
      </div>
    );
  }

  // File source
  const isImage = source.contentType.startsWith('image/');
  const isPdf = source.contentType === 'application/pdf';
  const isNotebook = source.name.endsWith('.ipynb');
  const isPythonScript = source.name.endsWith('.py');
  const isDocument = source.contentType.includes('word') ||
                     source.contentType.includes('document') ||
                     source.name.endsWith('.docx') ||
                     source.name.endsWith('.doc');

  if (isImage) {
    return (
      <div className="flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={source.url}
          alt={source.name}
          className="max-w-full max-h-[500px] object-contain rounded-lg"
        />
      </div>
    );
  }

  if (isPdf) {
    return (
      <div className="h-full flex flex-col">
        <PDFViewer
          url={source.url}
          onPagesLoaded={onPDFPagesLoaded}
          onError={(err) => console.error('PDF load error:', err)}
        />
        <div className="mt-2 p-2 bg-surface/30 rounded-lg">
          <p className="text-xs text-text-muted text-center">
            📸 AI can see all slides when generating feedback
          </p>
        </div>
      </div>
    );
  }

  if (isNotebook) {
    return (
      <NotebookDisplay
        url={source.url}
        filename={source.name}
        onContentParsed={onContentParsed}
      />
    );
  }

  if (isPythonScript) {
    return (
      <ScriptDisplay
        url={source.url}
        filename={source.name}
        onContentParsed={onContentParsed}
      />
    );
  }

  if (isDocument) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-surface rounded-lg">
          <span className="text-4xl">📄</span>
          <div>
            <p className="text-text-primary font-display">{source.name}</p>
            <p className="text-text-muted text-sm">{source.contentType}</p>
          </div>
        </div>
        {!parsedContent && (
          <button
            onClick={onParse}
            disabled={isParsing}
            className="px-4 py-2 bg-accent-primary text-background rounded-lg text-sm hover:bg-accent-primary/80 transition-colors disabled:opacity-50"
          >
            {isParsing ? 'Parsing...' : '📖 Extract Text for AI Analysis'}
          </button>
        )}
        {parsedContent && (
          <div className="p-4 bg-surface/50 rounded-lg">
            <h4 className="text-xs font-display text-text-muted mb-2">EXTRACTED TEXT</h4>
            <pre className="text-sm text-text-primary whitespace-pre-wrap font-mono">
              {parsedContent}
            </pre>
          </div>
        )}
      </div>
    );
  }

  // Generic file
  return (
    <div className="flex items-center gap-3 p-4 bg-surface rounded-lg">
      <span className="text-4xl">📎</span>
      <div className="flex-1">
        <p className="text-text-primary font-display">{source.name}</p>
        <p className="text-text-muted text-sm">{source.contentType}</p>
      </div>
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="px-3 py-1.5 bg-accent-primary text-background rounded text-sm hover:bg-accent-primary/80 transition-colors"
      >
        Download
      </a>
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function getSourceIcon(type: ContentSource['type']): string {
  switch (type) {
    case 'file':
      return '📄';
    case 'text':
      return '📝';
    case 'url':
      return '🔗';
  }
}

function formatSubmissionDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

async function parseFileContent(url: string, contentType: string): Promise<string> {
  // Call our agent API to parse the file
  const response = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task: 'custom',
      prompt: `Parse the content from this file URL and return the extracted text: ${url}`,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to parse file');
  }

  const data = await response.json();
  return data.result || 'No text extracted';
}

// =============================================================================
// Notebook Types and Parsing
// =============================================================================

interface NotebookCell {
  cell_type: 'code' | 'markdown' | 'raw';
  source: string | string[];
  outputs?: NotebookOutput[];
}

interface NotebookOutput {
  output_type: string;
  text?: string | string[];
  data?: Record<string, string | string[]>;
}

interface NotebookData {
  cells: NotebookCell[];
  metadata?: Record<string, unknown>;
}

async function parseNotebookContent(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch notebook');
  }

  const notebook: NotebookData = await response.json();
  const lines: string[] = [];

  notebook.cells.forEach((cell, index) => {
    const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source;

    if (cell.cell_type === 'markdown') {
      lines.push(`## Markdown Cell ${index + 1}`);
      lines.push(source.trim());
      lines.push('');
    } else if (cell.cell_type === 'code') {
      lines.push(`## Code Cell ${index + 1}`);
      lines.push('```python');
      lines.push(source.trim());
      lines.push('```');

      // Include outputs if present
      if (cell.outputs && cell.outputs.length > 0) {
        lines.push('### Output:');
        cell.outputs.forEach((output) => {
          if (output.text) {
            const text = Array.isArray(output.text) ? output.text.join('') : output.text;
            lines.push('```');
            lines.push(text.trim());
            lines.push('```');
          } else if (output.data?.['text/plain']) {
            const text = Array.isArray(output.data['text/plain'])
              ? output.data['text/plain'].join('')
              : output.data['text/plain'];
            lines.push('```');
            lines.push(text.trim());
            lines.push('```');
          }
        });
      }
      lines.push('');
    } else if (cell.cell_type === 'raw') {
      lines.push(`## Raw Cell ${index + 1}`);
      lines.push(source.trim());
      lines.push('');
    }
  });

  return lines.join('\n');
}

// =============================================================================
// Notebook Display Component
// =============================================================================

function NotebookDisplay({
  url,
  filename,
  onContentParsed,
}: {
  url: string;
  filename: string;
  onContentParsed?: (content: string) => void;
}) {
  const [notebookContent, setNotebookContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadNotebook() {
      try {
        setIsLoading(true);
        setError(null);
        const content = await parseNotebookContent(url);
        setNotebookContent(content);
        // Notify parent so AI can use this content
        onContentParsed?.(content);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load notebook');
      } finally {
        setIsLoading(false);
      }
    }

    loadNotebook();
  }, [url, onContentParsed]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="animate-spin text-4xl mb-4">📓</div>
        <p className="text-text-muted text-sm">Loading notebook...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-accent-danger/20 rounded-lg">
        <p className="text-accent-danger">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-surface rounded-lg">
        <span className="text-4xl">📓</span>
        <div>
          <p className="text-text-primary font-display">{filename}</p>
          <p className="text-text-muted text-sm">Jupyter Notebook</p>
        </div>
      </div>

      {notebookContent && (
        <div className="p-4 bg-surface/50 rounded-lg max-h-[500px] overflow-auto">
          <h4 className="text-xs font-display text-text-muted mb-2">NOTEBOOK CONTENT</h4>
          <pre className="text-sm text-text-primary whitespace-pre-wrap font-mono">
            {notebookContent}
          </pre>
        </div>
      )}

      <div className="p-2 bg-surface/30 rounded-lg">
        <p className="text-xs text-text-muted text-center">
          📓 AI can see all notebook cells when generating feedback
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// Script Display Component (for .py files)
// =============================================================================

function ScriptDisplay({
  url,
  filename,
  onContentParsed,
}: {
  url: string;
  filename: string;
  onContentParsed?: (content: string) => void;
}) {
  const [scriptContent, setScriptContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadScript() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch script');
        }
        const content = await response.text();
        setScriptContent(content);
        // Notify parent so AI can use this content
        onContentParsed?.(content);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load script');
      } finally {
        setIsLoading(false);
      }
    }

    loadScript();
  }, [url, onContentParsed]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="animate-spin text-4xl mb-4">🐍</div>
        <p className="text-text-muted text-sm">Loading script...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-accent-danger/20 rounded-lg">
        <p className="text-accent-danger">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-surface rounded-lg">
        <span className="text-4xl">🐍</span>
        <div>
          <p className="text-text-primary font-display">{filename}</p>
          <p className="text-text-muted text-sm">Python Script</p>
        </div>
      </div>

      {scriptContent && (
        <div className="p-4 bg-surface/50 rounded-lg max-h-[500px] overflow-auto">
          <h4 className="text-xs font-display text-text-muted mb-2">SCRIPT CONTENT</h4>
          <pre className="text-sm text-text-primary whitespace-pre-wrap font-mono">
            <code>{scriptContent}</code>
          </pre>
        </div>
      )}

      <div className="p-2 bg-surface/30 rounded-lg">
        <p className="text-xs text-text-muted text-center">
          🐍 AI can see the full script when generating feedback
        </p>
      </div>
    </div>
  );
}
