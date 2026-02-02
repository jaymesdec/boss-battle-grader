---
title: "Canvas Auto-Screenshots (websnappr) Obscuring URL Submissions"
date: 2026-02-02
category: integration-issues
tags:
  - canvas-lms
  - submissions
  - url-submissions
  - websnappr
  - screenshots
  - grading-ui
module: SubmissionViewer
symptoms: "URL submissions display as auto-generated PNG screenshots instead of clickable links, making it difficult or impossible to access the actual submitted URL"
root_cause: "Canvas LMS automatically generates preview images for URL submissions using websnappr service, and the integration may prioritize displaying these images over the original URL"
---

# Canvas Auto-Screenshots (websnappr) Obscuring URL Submissions

## Problem

When students submit URLs in Canvas (e.g., Google Docs links, website URLs, portfolio links), the grading interface displays auto-generated PNG screenshots from Canvas's websnappr service instead of the actual clickable URL. This makes it difficult to:

1. Access the live content (which may have changed since screenshot was taken)
2. Click through to interactive content (Google Docs, Slides, websites)
3. See the actual URL that was submitted
4. Grade content that requires interaction (animations, videos, forms)

## Root Cause

Canvas LMS uses a service called **websnappr** to automatically generate preview images for URL submissions. The Canvas API returns submission data that includes:

```json
{
  "submission_type": "online_url",
  "url": "https://docs.google.com/document/d/...",
  "preview_url": "https://canvas.instructure.com/.../websnappr/...",
  "attachments": [
    {
      "content-type": "image/png",
      "url": "https://inst-fs-pdx-prod.inscloudgate.net/.../websnappr.png"
    }
  ]
}
```

If the integration prioritizes `attachments` or `preview_url` over the `url` field, users see a static screenshot instead of the actual link.

## Solution

### 1. Always Prioritize the Original URL for URL Submissions

```typescript
function getSubmissionContent(submission: CanvasSubmission) {
  // For URL submissions, ALWAYS use the url field
  if (submission.submission_type === 'online_url' && submission.url) {
    return {
      type: 'url',
      url: submission.url,
      // Include preview as supplementary, not primary
      previewImage: submission.attachments?.[0]?.url,
    };
  }

  // For other submission types, use attachments
  if (submission.attachments?.length) {
    return {
      type: 'attachment',
      attachments: submission.attachments,
    };
  }

  // Fallback to body text
  return {
    type: 'text',
    body: submission.body,
  };
}
```

### 2. Display URL Submissions with Clickable Links

```tsx
function SubmissionViewer({ submission }) {
  const content = getSubmissionContent(submission);

  if (content.type === 'url') {
    return (
      <div className="url-submission">
        {/* Primary: Clickable link to actual URL */}
        <a
          href={content.url}
          target="_blank"
          rel="noopener noreferrer"
          className="submission-url-link"
        >
          Open Submitted URL
        </a>

        {/* Display the actual URL for transparency */}
        <code className="submission-url-display">{content.url}</code>

        {/* Optional: Show preview image as thumbnail, not main content */}
        {content.previewImage && (
          <details>
            <summary>View Canvas Preview (may be outdated)</summary>
            <img
              src={content.previewImage}
              alt="Canvas auto-generated preview"
            />
          </details>
        )}
      </div>
    );
  }

  // ... handle other submission types
}
```

### 3. Handle Special URL Types

```typescript
const URL_HANDLERS: Record<string, (url: string) => React.ReactNode> = {
  'docs.google.com': (url) => <GoogleDocsEmbed url={url} />,
  'drive.google.com': (url) => <GoogleDriveEmbed url={url} />,
  'youtube.com': (url) => <YouTubeEmbed url={url} />,
  'youtu.be': (url) => <YouTubeEmbed url={url} />,
  'figma.com': (url) => <FigmaEmbed url={url} />,
  'codepen.io': (url) => <CodePenEmbed url={url} />,
};

function getUrlHandler(url: string) {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    return URL_HANDLERS[hostname] || null;
  } catch {
    return null;
  }
}
```

## Prevention Checklist

### Before Implementing Submission Display:

- [ ] **Identify submission type first** - Check `submission_type` field before processing
- [ ] **Map submission types to display strategies:**
  - `online_url` -> Prioritize `url` field, not attachments
  - `online_upload` -> Use `attachments` array
  - `online_text_entry` -> Use `body` field
  - `media_recording` -> Use `media_comment` field
- [ ] **Never assume attachments are user-uploaded** - Canvas adds auto-generated content
- [ ] **Test with actual Canvas URL submissions** - Verify links work, not just previews display

### Patterns to Watch For

| Red Flag | Problem | Fix |
|----------|---------|-----|
| Displaying `attachments[0]` for all submissions | URL submissions show screenshots | Check `submission_type` first |
| Using `preview_url` as primary content | Shows Canvas proxy, not original | Use `url` field for URL submissions |
| No clickable link for URL submissions | Users can't access actual content | Always render `url` as clickable link |
| Treating websnappr PNGs as uploaded files | Confusion about what student submitted | Filter or label auto-generated content |

## Code Review Guidelines

### Questions to Ask During Review

1. "What happens when a student submits a Google Docs URL?"
2. "Can the grader click through to the actual submitted content?"
3. "Are we showing the original URL or just a Canvas-generated preview?"
4. "How do we distinguish user-uploaded files from Canvas auto-attachments?"

### Detection Patterns for websnappr Content

Canvas websnappr attachments typically have:
- `filename` containing "websnappr" or similar
- `content-type` of `image/png`
- `url` pointing to Canvas infrastructure, not original domain

```typescript
function isWebsnapprAttachment(attachment: CanvasAttachment): boolean {
  return (
    attachment.filename?.toLowerCase().includes('websnappr') ||
    (attachment['content-type'] === 'image/png' &&
     attachment.url?.includes('inst-fs') &&
     // Check if this is for a URL submission
     !attachment.url?.includes('user_upload'))
  );
}
```

## Canvas API Submission Types Reference

| `submission_type` | Primary Content Field | Notes |
|-------------------|----------------------|-------|
| `online_url` | `url` | User submitted a URL; `attachments` may contain auto-generated preview |
| `online_upload` | `attachments` | User uploaded file(s) |
| `online_text_entry` | `body` | User typed text in Canvas editor |
| `media_recording` | `media_comment` | Audio/video recording |
| `basic_lti_launch` | `external_tool_url` | LTI tool submission |
| `discussion_topic` | N/A | Linked to discussion posts |
| `online_quiz` | N/A | Linked to quiz attempt |

## Testing Strategy

```typescript
describe('SubmissionViewer', () => {
  it('displays clickable URL for online_url submissions', () => {
    const submission = {
      submission_type: 'online_url',
      url: 'https://docs.google.com/document/d/123',
      attachments: [{
        url: 'https://canvas.../websnappr.png',
        'content-type': 'image/png',
      }],
    };

    render(<SubmissionViewer submission={submission} />);

    // Should have clickable link to actual URL
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://docs.google.com/document/d/123');

    // Should NOT prominently display websnappr image
    const mainImage = screen.queryByRole('img', { name: /submission/i });
    expect(mainImage).not.toBeInTheDocument();
  });

  it('displays uploaded files for online_upload submissions', () => {
    const submission = {
      submission_type: 'online_upload',
      attachments: [{
        url: 'https://canvas.../student-work.pdf',
        filename: 'my-essay.pdf',
      }],
    };

    render(<SubmissionViewer submission={submission} />);

    // Should display the uploaded file
    expect(screen.getByText('my-essay.pdf')).toBeInTheDocument();
  });
});
```

## Warning Signs

1. **Graders complaining they can't access student work** - Likely showing screenshot instead of URL
2. **"Preview image is blank or broken"** - websnappr may have failed, but original URL still works
3. **"Content looks outdated"** - Screenshot was taken at submission time; live content has changed
4. **Google Docs showing "Request access" in screenshot** - Screenshot captured auth-gated view

## Related

- [Canvas API Submissions Documentation](https://canvas.instructure.com/doc/api/submissions.html)
- [Canvas LMS Submission Types Guide](https://community.canvaslms.com/t5/Canvas-Basics-Guide/What-are-the-different-submission-types-in-Canvas/ta-p/64)
- Solution: `docs/solutions/integration-issues/canvas-lms-submission-summary-null-and-graded-count.md`
