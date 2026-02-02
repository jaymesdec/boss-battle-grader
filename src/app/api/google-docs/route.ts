import { NextRequest, NextResponse } from 'next/server';
import { fetchGoogleDoc, fetchGoogleSlides, parseGoogleDocsUrl } from '@/lib/google';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  const documentId = request.nextUrl.searchParams.get('documentId');
  const presentationId = request.nextUrl.searchParams.get('presentationId');

  // Handle Google Slides
  if (url) {
    const parsed = parseGoogleDocsUrl(url);

    if (parsed.isGoogleSlides && parsed.presentationId) {
      const result = await fetchGoogleSlides(parsed.presentationId);
      return NextResponse.json({
        ...result,
        type: 'slides',
        method: result.success ? 'oauth' : undefined,
      });
    }

    if (parsed.isUnsupportedType) {
      return NextResponse.json({
        success: false,
        error: `${parsed.docType} is not supported. Only Google Docs and Slides can be processed.`,
        errorCode: 'UNSUPPORTED_TYPE',
      });
    }

    if (parsed.isGoogleDoc && parsed.documentId) {
      // Handle Google Docs (existing flow)
      return handleGoogleDoc(parsed.documentId);
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid Google URL',
      errorCode: 'INVALID_URL',
    });
  }

  // Direct ID parameters
  if (presentationId) {
    const result = await fetchGoogleSlides(presentationId);
    return NextResponse.json({
      ...result,
      type: 'slides',
      method: result.success ? 'oauth' : undefined,
    });
  }

  if (documentId) {
    return handleGoogleDoc(documentId);
  }

  return NextResponse.json({
    success: false,
    error: 'Missing url, documentId, or presentationId parameter',
    errorCode: 'MISSING_PARAM',
  });
}

async function handleGoogleDoc(docId: string) {
  // Try public export first
  try {
    const publicUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
    const response = await fetch(publicUrl, {
      headers: {
        'User-Agent': 'BossBattleGrader/1.0',
      },
    });

    if (response.ok) {
      const text = await response.text();
      return NextResponse.json({
        success: true,
        content: text,
        type: 'doc',
        method: 'public',
      });
    }
  } catch {
    // Public access failed, continue to OAuth
  }

  // Fall back to OAuth
  const result = await fetchGoogleDoc(docId);
  return NextResponse.json({
    ...result,
    type: 'doc',
    method: result.success ? 'oauth' : undefined,
  });
}
