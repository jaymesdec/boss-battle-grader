---
title: "feat: Add Google Docs OAuth Submission Support"
type: feat
date: 2026-02-01
---

# Add Google Docs OAuth Submission Support

## Overview

Enable the grading application to extract text content from private Google Docs submitted by students. When a student submits a Google Doc URL, the system will use OAuth 2.0 to authenticate with the teacher's Google account and fetch the document content via the Google Docs API, including support for multi-tab documents.

## Problem Statement / Motivation

Currently, the application can only access publicly shared Google Docs using the export URL pattern (`/export?format=txt`). Many students share documents with restricted access (e.g., "Anyone with the link" or specific users), which causes the current system to fail silently or show unhelpful errors.

Teachers need to:
1. View student submissions that are private Google Docs
2. Have the AI agent analyze these documents for feedback generation
3. Not have to manually copy-paste content from Google Docs

## Proposed Solution

Implement OAuth 2.0 authentication with Google using Auth.js (NextAuth v5), store tokens securely, and use the Google Docs API to fetch document content. Support multi-tab documents by extracting text from all tabs (up to 3 levels of nesting).

### Key Behaviors

| Scenario | Behavior |
|----------|----------|
| Public Google Doc | Try public export URL first (no OAuth needed) |
| Private Google Doc, OAuth connected | Fetch via Google Docs API |
| Private Google Doc, OAuth not connected | Show inline prompt to connect Google |
| Private Google Doc, OAuth connected but no access | Show error, preserve original link |
| Multi-tab document | Combine all tabs with headers: `--- Tab: [Name] ---` |
| Google Sheets/Slides URL | Show "unsupported document type" error |

## Technical Approach

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js Application                       │
├─────────────────────────────────────────────────────────────────┤
│  /app/api/auth/[...nextauth]/route.ts   ← OAuth endpoints       │
│  /src/lib/google.ts                      ← Google API client     │
│  /src/lib/tools/content.ts               ← Updated parse_url     │
│  /src/components/SubmissionViewer.tsx    ← Google Docs UI        │
│  /src/components/GoogleAuthStatus.tsx    ← Settings component    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Google Cloud Platform                       │
├─────────────────────────────────────────────────────────────────┤
│  OAuth 2.0 Consent Screen                                        │
│  Google Docs API (documents.readonly scope)                      │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Phases

#### Phase 1: OAuth Foundation

**Tasks:**
1. Set up Google Cloud project with OAuth consent screen
2. Install and configure Auth.js (NextAuth v5)
3. Create OAuth API routes
4. Add token storage (using NextAuth's built-in handling)
5. Create settings page component for Google connection status

**Files to create/modify:**
- `src/app/api/auth/[...nextauth]/route.ts` - OAuth endpoints
- `src/lib/auth.ts` - Auth configuration and helpers
- `src/components/GoogleAuthStatus.tsx` - Settings component
- `src/app/settings/page.tsx` - Settings page (if doesn't exist)
- `.env.local` - Add Google OAuth credentials

**Success criteria:**
- [ ] Teacher can click "Connect Google Account" in settings
- [ ] OAuth flow redirects to Google and back
- [ ] Token is stored and persists across sessions
- [ ] Settings shows "Connected as [email]" with disconnect option

#### Phase 2: Google Docs API Integration

**Tasks:**
1. Create Google Docs API client
2. Implement document ID extraction from various URL formats
3. Implement text extraction with multi-tab support
4. Add recursive tab traversal (up to 3 levels)
5. Implement error handling for all failure modes

**Files to create/modify:**
- `src/lib/google.ts` - Google API client

```typescript
// src/lib/google.ts

import { google } from 'googleapis';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

interface TabContent {
  tabId: string;
  tabTitle: string;
  text: string;
}

interface GoogleDocsResult {
  success: boolean;
  content?: string;
  tabs?: TabContent[];
  error?: string;
  errorCode?: 'NOT_AUTHENTICATED' | 'ACCESS_DENIED' | 'NOT_FOUND' | 'RATE_LIMITED' | 'UNSUPPORTED_TYPE' | 'UNKNOWN';
}

export async function fetchGoogleDoc(documentId: string): Promise<GoogleDocsResult> {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return {
      success: false,
      error: 'Google account not connected',
      errorCode: 'NOT_AUTHENTICATED'
    };
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.accessToken });

  const docs = google.docs({ version: 'v1', auth });

  try {
    const response = await docs.documents.get({
      documentId,
      includeTabsContent: true,  // Critical for multi-tab support
    });

    const document = response.data;
    const allTabs = getAllTabs(document.tabs || []);

    const tabs = allTabs.map(tab => ({
      tabId: tab.tabProperties?.tabId || '',
      tabTitle: tab.tabProperties?.title || 'Untitled',
      text: extractTextFromTab(tab),
    }));

    // Combine tabs with headers
    const combinedContent = tabs.map(tab =>
      `--- Tab: ${tab.tabTitle} ---\n${tab.text}`
    ).join('\n\n');

    return { success: true, content: combinedContent, tabs };
  } catch (error: any) {
    if (error.code === 403) {
      return { success: false, error: 'Access denied', errorCode: 'ACCESS_DENIED' };
    }
    if (error.code === 404) {
      return { success: false, error: 'Document not found', errorCode: 'NOT_FOUND' };
    }
    if (error.code === 429) {
      return { success: false, error: 'Rate limited', errorCode: 'RATE_LIMITED' };
    }
    return { success: false, error: error.message, errorCode: 'UNKNOWN' };
  }
}

function getAllTabs(tabs: any[]): any[] {
  const allTabs: any[] = [];

  function addCurrentAndChildTabs(tab: any) {
    allTabs.push(tab);
    if (tab.childTabs) {
      for (const childTab of tab.childTabs) {
        addCurrentAndChildTabs(childTab);
      }
    }
  }

  for (const tab of tabs) {
    addCurrentAndChildTabs(tab);
  }

  return allTabs;
}

function extractTextFromTab(tab: any): string {
  const content = tab.documentTab?.body?.content || [];
  return readStructuralElements(content);
}

function readStructuralElements(elements: any[]): string {
  let text = '';

  for (const element of elements) {
    if (element.paragraph) {
      for (const paragraphElement of element.paragraph.elements || []) {
        if (paragraphElement.textRun?.content) {
          text += paragraphElement.textRun.content;
        }
      }
    } else if (element.table) {
      for (const row of element.table.tableRows || []) {
        for (const cell of row.tableCells || []) {
          text += readStructuralElements(cell.content || []);
        }
      }
    } else if (element.tableOfContents) {
      text += readStructuralElements(element.tableOfContents.content || []);
    }
  }

  return text;
}
```

**Success criteria:**
- [ ] Can extract text from single-tab Google Docs
- [ ] Can extract text from multi-tab Google Docs (all tabs, nested up to 3 levels)
- [ ] Tabs are combined with `--- Tab: [Name] ---` headers
- [ ] All error cases return appropriate error codes

#### Phase 3: Update Content Tools

**Tasks:**
1. Update `executeParseUrl` to detect Google Docs URLs
2. Try public export first, fall back to OAuth
3. Create new `parse_google_doc` tool for agent
4. Handle rate limiting with exponential backoff

**Files to modify:**
- `src/lib/tools/content.ts` - Update parse_url, add parse_google_doc tool

```typescript
// Addition to src/lib/tools/content.ts

import { fetchGoogleDoc } from '../google';

export function parseGoogleDocsUrl(url: string): { isGoogleDoc: boolean; documentId: string | null; isUnsupportedType: boolean; docType?: string } {
  // Google Docs
  const docsMatch = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (docsMatch) {
    return { isGoogleDoc: true, documentId: docsMatch[1], isUnsupportedType: false };
  }

  // Google Sheets (unsupported)
  if (url.includes('docs.google.com/spreadsheets')) {
    return { isGoogleDoc: false, documentId: null, isUnsupportedType: true, docType: 'Google Sheets' };
  }

  // Google Slides (unsupported)
  if (url.includes('docs.google.com/presentation')) {
    return { isGoogleDoc: false, documentId: null, isUnsupportedType: true, docType: 'Google Slides' };
  }

  // Google Drive file (may or may not be a Doc)
  const driveMatch = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/);
  if (driveMatch) {
    // Drive files need additional handling - treat as potential doc
    return { isGoogleDoc: true, documentId: driveMatch[1], isUnsupportedType: false };
  }

  return { isGoogleDoc: false, documentId: null, isUnsupportedType: false };
}

export async function executeParseUrl(url: string): Promise<string> {
  const googleInfo = parseGoogleDocsUrl(url);

  // Handle unsupported Google doc types
  if (googleInfo.isUnsupportedType) {
    return JSON.stringify({
      success: false,
      error: `${googleInfo.docType} is not supported. Only Google Docs can be processed.`,
      errorCode: 'UNSUPPORTED_TYPE',
      sourceUrl: url,
    });
  }

  // Handle Google Docs
  if (googleInfo.isGoogleDoc && googleInfo.documentId) {
    // Try public export first
    try {
      const publicUrl = `https://docs.google.com/document/d/${googleInfo.documentId}/export?format=txt`;
      const response = await fetch(publicUrl);
      if (response.ok) {
        const text = await response.text();
        return JSON.stringify({ success: true, content: text, sourceUrl: url, method: 'public' });
      }
    } catch {
      // Public access failed, try OAuth
    }

    // Fall back to OAuth
    const result = await fetchGoogleDoc(googleInfo.documentId);
    if (result.success) {
      return JSON.stringify({ success: true, content: result.content, sourceUrl: url, method: 'oauth' });
    }

    return JSON.stringify({
      success: false,
      error: result.error,
      errorCode: result.errorCode,
      sourceUrl: url,
    });
  }

  // Non-Google URL - existing logic
  // ... (keep existing implementation)
}
```

**Success criteria:**
- [ ] Public Google Docs work without OAuth
- [ ] Private Google Docs fall back to OAuth
- [ ] Unsupported types (Sheets, Slides) show clear error
- [ ] AI agent can use updated `parse_url` tool

#### Phase 4: Update SubmissionViewer UI

**Tasks:**
1. Detect Google Docs URLs in submission
2. Show inline OAuth prompt when not connected
3. Display fetched content with source indicator
4. Show appropriate error messages for each failure mode
5. Add "fetched at" timestamp warning

**Files to modify:**
- `src/components/SubmissionViewer.tsx` - Google Docs UI

```typescript
// Additions to SubmissionViewer.tsx

interface GoogleDocState {
  status: 'loading' | 'connected' | 'not_connected' | 'error';
  content?: string;
  error?: string;
  errorCode?: string;
  fetchedAt?: Date;
}

// In the URL source rendering section:
function GoogleDocViewer({ url, documentId }: { url: string; documentId: string }) {
  const [state, setState] = useState<GoogleDocState>({ status: 'loading' });

  useEffect(() => {
    fetchGoogleDocContent(documentId).then(result => {
      if (result.success) {
        setState({ status: 'connected', content: result.content, fetchedAt: new Date() });
      } else if (result.errorCode === 'NOT_AUTHENTICATED') {
        setState({ status: 'not_connected' });
      } else {
        setState({ status: 'error', error: result.error, errorCode: result.errorCode });
      }
    });
  }, [documentId]);

  if (state.status === 'loading') {
    return <div className="animate-pulse">Loading Google Doc...</div>;
  }

  if (state.status === 'not_connected') {
    return (
      <div className="p-4 bg-surface rounded-lg border border-accent-secondary">
        <p className="text-text-primary mb-3">
          This submission is a private Google Doc.
        </p>
        <button
          onClick={() => signIn('google')}
          className="px-4 py-2 bg-accent-primary text-white rounded hover:bg-accent-primary/90"
        >
          Connect Google Account
        </button>
        <a href={url} target="_blank" rel="noopener noreferrer"
           className="ml-3 text-accent-primary hover:underline text-sm">
          Or open manually
        </a>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="p-4 bg-red-50 rounded-lg border border-red-200">
        <p className="text-red-700 mb-2">{getErrorMessage(state.errorCode)}</p>
        <a href={url} target="_blank" rel="noopener noreferrer"
           className="text-accent-primary hover:underline text-sm">
          Open in Google Docs
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <span>Content from Google Docs</span>
        {state.fetchedAt && (
          <span className="text-xs">(fetched {formatRelativeTime(state.fetchedAt)})</span>
        )}
      </div>
      <div className="prose max-w-none whitespace-pre-wrap">
        {state.content}
      </div>
    </div>
  );
}

function getErrorMessage(errorCode?: string): string {
  switch (errorCode) {
    case 'ACCESS_DENIED':
      return "Your Google account doesn't have access to this document.";
    case 'NOT_FOUND':
      return "This document has been deleted or moved.";
    case 'RATE_LIMITED':
      return "Too many requests. Please wait a moment and try again.";
    case 'UNSUPPORTED_TYPE':
      return "This document type is not supported. Only Google Docs can be processed.";
    default:
      return "Unable to load this Google Doc.";
  }
}
```

**Success criteria:**
- [ ] Google Doc URLs show content inline (when accessible)
- [ ] Inline OAuth prompt appears for private docs when not connected
- [ ] Error messages are clear and actionable
- [ ] "Open in Google Docs" fallback link always available
- [ ] Fetched timestamp shown

## Acceptance Criteria

### Functional Requirements
- [ ] Teacher can connect their Google account from settings page
- [ ] Teacher can disconnect their Google account from settings page
- [ ] Public Google Docs display content without OAuth
- [ ] Private Google Docs display content after OAuth connection
- [ ] Multi-tab documents show all tabs with `--- Tab: [Name] ---` headers
- [ ] AI agent can analyze Google Doc content for feedback generation
- [ ] Error states show appropriate messages with fallback to manual link
- [ ] Google Sheets/Slides URLs show "unsupported type" message

### Non-Functional Requirements
- [ ] OAuth tokens stored securely (NextAuth encrypted session)
- [ ] Rate limiting handled with exponential backoff
- [ ] Token refresh happens automatically before expiration
- [ ] Page load not blocked by Google Doc fetching (async load)

### Quality Gates
- [ ] No OAuth credentials exposed in client-side code
- [ ] Error handling covers all documented failure modes
- [ ] Works with various Google Docs URL formats

## Dependencies & Prerequisites

1. **Google Cloud Project** - Must create project with OAuth consent screen configured
2. **OAuth Consent Screen Approval** - If app will be public, needs Google verification
3. **Environment Variables** - Must have:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`

## Risk Analysis & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| OAuth consent screen requires Google verification | Delays launch | Start verification process early; use "Internal" for initial testing |
| Rate limits hit during batch grading | Poor UX | Implement caching, exponential backoff |
| Token expires mid-grading session | Data loss | Background token refresh, queue requests |
| Student edits doc after submission | Grading integrity | Show "fetched at" timestamp, document in grading policy |

## Environment Setup

Add to `.env.local`:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here

# NextAuth (Auth.js)
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:3000
```

## References & Research

### Internal References
- Canvas client pattern: `src/lib/canvas.ts`
- Content tools: `src/lib/tools/content.ts:131-280`
- SubmissionViewer: `src/components/SubmissionViewer.tsx:346-365`

### External References
- [Google Docs API - Working with Tabs](https://developers.google.com/workspace/docs/api/how-tos/tabs)
- [Auth.js Google Provider](https://authjs.dev/getting-started/providers/google)
- [Google Docs API Quotas](https://developers.google.com/workspace/docs/api/limits) - 300 reads/min per user
