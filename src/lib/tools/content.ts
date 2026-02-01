// =============================================================================
// Content Tools - File and URL parsing for submissions
// =============================================================================

import mammoth from 'mammoth';
import { fetchSubmissionFiles } from '@/lib/canvas';
import type { ToolDefinition, CanvasSubmission } from '@/types';

// Dynamic import for pdf-parse to handle ESM/CJS issues
async function getPdfParser(): Promise<(buffer: Buffer) => Promise<{ text: string }>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfParse = await import('pdf-parse') as any;
  return pdfParse.default || pdfParse;
}

// -----------------------------------------------------------------------------
// Tool Definitions
// -----------------------------------------------------------------------------

export const contentToolDefinitions: ToolDefinition[] = [
  {
    name: 'read_submission',
    description: 'Extracts readable text content from a Canvas submission. Handles text entries, file attachments (PDF, DOCX), and URL submissions.',
    input_schema: {
      type: 'object',
      properties: {
        submission_id: {
          type: 'number',
          description: 'The Canvas submission ID',
        },
        submission_type: {
          type: 'string',
          description: 'Type of submission: text, url, or file',
          enum: ['text', 'url', 'file'],
        },
        body: {
          type: 'string',
          description: 'For text submissions, the HTML body content',
        },
        url: {
          type: 'string',
          description: 'For URL submissions, the submitted URL',
        },
        file_url: {
          type: 'string',
          description: 'For file submissions, the file download URL',
        },
        content_type: {
          type: 'string',
          description: 'For file submissions, the MIME type of the file',
        },
      },
      required: ['submission_id', 'submission_type'],
    },
  },
  {
    name: 'parse_file',
    description: 'Parses a file attachment and extracts text content. Supports PDF, DOCX, and plain text files.',
    input_schema: {
      type: 'object',
      properties: {
        file_url: {
          type: 'string',
          description: 'The URL to download the file from',
        },
        content_type: {
          type: 'string',
          description: 'The MIME type of the file (e.g., application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document)',
        },
      },
      required: ['file_url', 'content_type'],
    },
  },
  {
    name: 'parse_url',
    description: 'Extracts text content from a URL submission. Handles Google Docs links and generic web pages.',
    input_schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to fetch and parse',
        },
      },
      required: ['url'],
    },
  },
];

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function stripHtml(html: string): string {
  // Remove HTML tags and decode entities
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function parseDocx(buffer: ArrayBuffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value;
  } catch (error) {
    throw new Error(`Failed to parse DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function parsePdf(buffer: ArrayBuffer): Promise<string> {
  try {
    const pdf = await getPdfParser();
    const uint8Array = new Uint8Array(buffer);
    const nodeBuffer = Buffer.from(uint8Array);
    const result = await pdf(nodeBuffer);
    return result.text;
  } catch (error) {
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function isGoogleDocsUrl(url: string): boolean {
  return url.includes('docs.google.com') || url.includes('drive.google.com');
}

// -----------------------------------------------------------------------------
// Tool Implementations
// -----------------------------------------------------------------------------

export async function executeReadSubmission(
  submissionId: number,
  submissionType: string,
  body?: string,
  url?: string,
  fileUrl?: string,
  contentType?: string
): Promise<string> {
  try {
    if (submissionType === 'text' && body) {
      const text = stripHtml(body);
      return JSON.stringify({
        success: true,
        submissionId,
        content: text,
        contentType: 'text',
      });
    }

    if (submissionType === 'url' && url) {
      const urlContent = await executeParseUrl(url);
      return JSON.stringify({
        success: true,
        submissionId,
        content: JSON.parse(urlContent).content,
        contentType: 'url',
        sourceUrl: url,
      });
    }

    if (submissionType === 'file' && fileUrl && contentType) {
      const fileContent = await executeParseFile(fileUrl, contentType);
      return JSON.stringify({
        success: true,
        submissionId,
        content: JSON.parse(fileContent).content,
        contentType: 'file',
      });
    }

    return JSON.stringify({
      success: false,
      error: 'No readable content found in submission',
    });
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read submission',
    });
  }
}

export async function executeParseFile(
  fileUrl: string,
  contentType: string
): Promise<string> {
  try {
    const result = await fetchSubmissionFiles(fileUrl);
    if (!result.success || !result.data) {
      return JSON.stringify({ success: false, error: result.error || 'Failed to fetch file' });
    }

    const buffer = result.data;
    let content: string;

    if (contentType.includes('pdf')) {
      content = await parsePdf(buffer);
    } else if (
      contentType.includes('wordprocessingml') ||
      contentType.includes('msword') ||
      contentType.includes('docx')
    ) {
      content = await parseDocx(buffer);
    } else if (contentType.includes('text/plain')) {
      const decoder = new TextDecoder('utf-8');
      content = decoder.decode(buffer);
    } else {
      return JSON.stringify({
        success: false,
        error: `Unsupported file type: ${contentType}`,
      });
    }

    return JSON.stringify({
      success: true,
      content: content.slice(0, 50000), // Limit content length
      contentType,
    });
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse file',
    });
  }
}

export async function executeParseUrl(url: string): Promise<string> {
  try {
    // Handle Google Docs - convert to export URL
    let fetchUrl = url;
    if (isGoogleDocsUrl(url)) {
      // Extract document ID and create export URL
      const docIdMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (docIdMatch) {
        fetchUrl = `https://docs.google.com/document/d/${docIdMatch[1]}/export?format=txt`;
      }
    }

    const response = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'BossBattleGrader/1.0',
      },
    });

    if (!response.ok) {
      return JSON.stringify({
        success: false,
        error: `Failed to fetch URL: ${response.status}`,
      });
    }

    const contentType = response.headers.get('content-type') || '';
    let content: string;

    if (contentType.includes('text/html')) {
      const html = await response.text();
      content = stripHtml(html);
    } else {
      content = await response.text();
    }

    return JSON.stringify({
      success: true,
      content: content.slice(0, 50000), // Limit content length
      sourceUrl: url,
    });
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse URL',
    });
  }
}

// -----------------------------------------------------------------------------
// Submission Content Extractor (Convenience function)
// -----------------------------------------------------------------------------

export async function extractSubmissionContent(
  submission: CanvasSubmission
): Promise<{ content: string; type: string }> {
  // Try text body first
  if (submission.body) {
    return {
      content: stripHtml(submission.body),
      type: 'text',
    };
  }

  // Try URL
  if (submission.url) {
    const result = await executeParseUrl(submission.url);
    const parsed = JSON.parse(result);
    if (parsed.success) {
      return { content: parsed.content, type: 'url' };
    }
  }

  // Try file attachments
  if (submission.attachments && submission.attachments.length > 0) {
    const attachment = submission.attachments[0];
    const result = await executeParseFile(attachment.url, attachment.content_type);
    const parsed = JSON.parse(result);
    if (parsed.success) {
      return { content: parsed.content, type: 'file' };
    }
  }

  return { content: '', type: 'none' };
}
