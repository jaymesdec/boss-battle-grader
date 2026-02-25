import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const CANVAS_BASE_URL = process.env.CANVAS_BASE_URL ?? 'https://franklinjc.instructure.com';
const CANVAS_API_TOKEN = process.env.CANVAS_API_TOKEN;

// Parse Canvas Link header for pagination
function getNextPageUrl(linkHeader: string | null): string | null {
  if (!linkHeader) return null;

  const parts = linkHeader.split(',');
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match) {
      return match[1];
    }
  }
  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  const session = await auth();
  const accessToken = session?.canvasAccessToken ?? CANVAS_API_TOKEN;

  if (!CANVAS_BASE_URL || !accessToken) {
    return NextResponse.json(
      { error: 'Canvas API not configured' },
      { status: 500 }
    );
  }

  try {
    // Fetch all assignments with pagination
    const allAssignments: unknown[] = [];
    let url: string | null = `${CANVAS_BASE_URL}/api/v1/courses/${courseId}/assignments?per_page=100&include[]=submission_summary&include[]=needs_grading_count`;

    while (url) {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Canvas API error:', error);
        return NextResponse.json(
          { error: 'Failed to fetch assignments from Canvas' },
          { status: response.status }
        );
      }

      const assignments = await response.json();
      allAssignments.push(...assignments);

      // Check for next page
      url = getNextPageUrl(response.headers.get('Link'));
    }

    return NextResponse.json(allAssignments);
  } catch (error) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json(
      { error: 'Failed to connect to Canvas' },
      { status: 500 }
    );
  }
}
