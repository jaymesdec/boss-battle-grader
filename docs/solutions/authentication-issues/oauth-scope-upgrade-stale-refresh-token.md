---
title: OAuth refresh token missing new scopes after adding Google Slides API
category: authentication-issues
tags: [oauth, google-api, google-slides, nextauth, refresh-token, scope-mismatch]
module: Google OAuth Integration
symptom: "Access denied to presentation even though user has access and API is enabled"
root_cause: "Refresh token was issued with original scopes, doesn't include newly added scopes"
date_solved: 2026-02-02
---

# OAuth Scope Update Issue: Refresh Token Missing New Scopes

## Problem

After adding a new OAuth scope (`presentations.readonly` for Google Slides) to a NextAuth + Google OAuth app, users who previously authorized the app get "Access denied" errors when accessing the new API - even after signing out and back in.

**Symptoms:**
- Google Slides URLs show "Your Google account doesn't have access to this presentation"
- User can access the presentation directly in Google Slides
- Google Slides API is confirmed enabled in Google Cloud Console
- Other Google APIs (Docs) continue to work correctly
- Issue only affects users who authorized the app BEFORE the new scope was added

## Root Cause

OAuth refresh tokens are **scoped at authorization time**. When a new API scope is added to the application config, existing refresh tokens still only contain the original scopes.

When NextAuth refreshes the access token using the cached refresh token, Google only returns an access token with the **original scopes** - not any new scopes added to the NextAuth configuration.

**Key insight:** Simply signing out and signing back in does NOT work because NextAuth reuses the cached refresh token, which still only has the old scopes.

## Solution

### For End Users

Users must **fully revoke** the app's access to their Google account:

1. Navigate to https://myaccount.google.com/permissions
2. Find the application in the list
3. Click on the app name
4. Click **"Remove all access"**
5. Sign back into the application

This forces a completely fresh OAuth flow where Google prompts for consent to ALL scopes, including newly added ones.

### Why Other Approaches Don't Work

| Action | Result |
|--------|--------|
| Sign out / Sign in | Reuses cached refresh token with old scopes |
| Clear browser cookies | Refresh token still stored server-side |
| Revoke at Google Permissions | Forces fresh OAuth flow with all scopes |

## Prevention Strategies

### 1. Add Sign Out Button to App

Ensure users can easily sign out. NextAuth provides a signout endpoint:

```
/api/auth/signout
```

### 2. Document Scope Changes in Release Notes

When adding new OAuth scopes, inform users:

> "This update adds Google Slides support. If you previously used the app, you may need to re-authorize. Go to [Google Account Permissions](https://myaccount.google.com/permissions), remove access for [App Name], then sign back in."

### 3. Consider Incremental Authorization

Request additional scopes only when the user tries to access the feature that needs them, rather than upfront.

### 4. Scope Detection (Advanced)

Check if the current token has required scopes before making API calls:

```typescript
const checkTokenScopes = async (accessToken: string) => {
  const response = await fetch(
    `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`
  );
  const data = await response.json();
  return data.scope?.split(' ') || [];
};
```

## Related

- [Google OAuth 2.0 Scopes](https://developers.google.com/identity/protocols/oauth2/scopes)
- [NextAuth Google Provider](https://next-auth.js.org/providers/google)
- [Google Account Permissions](https://myaccount.google.com/permissions)
