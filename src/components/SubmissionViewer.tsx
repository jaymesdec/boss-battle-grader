'use client';

// =============================================================================
// SubmissionViewer - Display student submission content with tabs
// =============================================================================

import { useState } from 'react';
import type { CanvasSubmission } from '@/types';

interface SubmissionViewerProps {
  submission: CanvasSubmission | null;
  isLoading?: boolean;
  onContentParsed?: (content: string) => void;
}

export function SubmissionViewer({
  submission,
  isLoading = false,
  onContentParsed,
}: SubmissionViewerProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [parsedContent, setParsedContent] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

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
}: {
  source: ContentSource;
  parsedContent: string | null;
  isParsing: boolean;
  onParse: () => void;
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
      <div className="space-y-4">
        <iframe
          src={source.url}
          className="w-full h-[500px] rounded-lg border border-surface"
          title={source.name}
        />
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
