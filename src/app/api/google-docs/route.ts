import { NextRequest, NextResponse } from 'next/server';
import { fetchGoogleDoc, parseGoogleDocsUrl } from '@/lib/google';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  const documentId = request.nextUrl.searchParams.get('documentId');

  // Either url or documentId must be provided
  let docId = documentId;

  if (!docId && url) {
    const parsed = parseGoogleDocsUrl(url);

    if (parsed.isUnsupportedType) {
      return NextResponse.json({
        success: false,
        error: `${parsed.docType} is not supported. Only Google Docs can be processed.`,
        errorCode: 'UNSUPPORTED_TYPE',
      });
    }

    if (!parsed.isGoogleDoc || !parsed.documentId) {
      return NextResponse.json({
        success: false,
        error: 'Invalid Google Docs URL',
        errorCode: 'INVALID_URL',
      });
    }

    docId = parsed.documentId;
  }

  if (!docId) {
    return NextResponse.json({
      success: false,
      error: 'Missing url or documentId parameter',
      errorCode: 'MISSING_PARAM',
    });
  }

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
    method: result.success ? 'oauth' : undefined,
  });
}
