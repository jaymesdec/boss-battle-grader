---
title: Google Docs API 403 Error - API Not Enabled in Google Cloud Console
tags:
  - google-docs
  - oauth
  - api-configuration
  - google-cloud
  - 403-error
severity: medium
symptoms:
  - "Your Google account doesn't have access to this document"
  - OAuth session has valid access token but API calls fail
  - 403 Forbidden error from Google Docs API
  - Authentication works but API calls return permission denied
module: GoogleDocsIntegration
date: 2026-02-01
---

# Google Docs API 403 Error - API Not Enabled

## Problem

After implementing Google OAuth for private Google Docs submissions, the application showed "Your Google account doesn't have access to this document" even though:
- OAuth flow completed successfully
- Session contained a valid access token
- User email was correctly authenticated
- User had access to the document in Google Docs

## Symptoms

1. OAuth redirect and callback work correctly
2. Session shows `hasAccessToken: true` and correct user email
3. Google Docs API calls return 403 error
4. Error message misleadingly suggests document permission issue

## Root Cause

The **Google Docs API was not enabled** in the Google Cloud Console project. Even with valid OAuth credentials and correct scopes, API calls fail with 403 if the API itself isn't enabled.

The actual error (visible in server logs):
```
Google Docs API has not been used in project [PROJECT_ID] before or it is disabled.
Enable it by visiting https://console.developers.google.com/apis/api/docs.googleapis.com/overview?project=[PROJECT_ID]
```

## Solution

1. Go to Google Cloud Console: https://console.cloud.google.com
2. Select your project
3. Navigate to **APIs & Services** > **Enabled APIs & Services**
4. Search for "Google Docs API"
5. Click **Enable**
6. Wait 1-2 minutes for propagation
7. Refresh your application

Direct link format:
```
https://console.developers.google.com/apis/api/docs.googleapis.com/overview?project=[YOUR_PROJECT_ID]
```

## Debugging Steps Used

Added logging to trace the issue:

```typescript
// In API route
const session = await auth();
console.log('[google-docs] Session:', {
  hasAccessToken: !!session?.accessToken,
  email: session?.user?.email,
  error: session?.error
});

// In Google Docs client
console.log('[fetchGoogleDoc] Session check:', {
  hasSession: !!session,
  hasAccessToken: !!session?.accessToken,
  email: session?.user?.email,
});

// In catch block
console.error('[fetchGoogleDoc] Error:', err.code, err.message, err.response?.data);
```

This revealed the actual error message mentioning "API not enabled" rather than the generic 403.

## Prevention Checklist

When setting up Google API integrations:

- [ ] Create Google Cloud project
- [ ] **Enable the specific API** (Google Docs API, Drive API, etc.)
- [ ] Configure OAuth consent screen
- [ ] Create OAuth 2.0 credentials
- [ ] Add authorized redirect URIs:
  - `http://localhost:3000/api/auth/callback/google` (dev)
  - `https://yourdomain.com/api/auth/callback/google` (prod)
- [ ] Set environment variables (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
- [ ] Add required OAuth scopes (e.g., `documents.readonly`)

## Key Lesson

**403 errors from Google APIs don't always mean permission denied.** The error can also mean:
1. API not enabled in Google Cloud Console (most common during setup)
2. Wrong OAuth scope
3. Document not shared with authenticated user

Always check server logs for the full error message, which often contains the actual cause and a direct link to fix it.

## Related Files

- `src/lib/auth.ts` - OAuth configuration
- `src/lib/google.ts` - Google Docs API client
- `src/app/api/google-docs/route.ts` - API endpoint
