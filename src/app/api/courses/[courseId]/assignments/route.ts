import { NextResponse } from 'next/server';

const CANVAS_BASE_URL = process.env.CANVAS_BASE_URL;
const CANVAS_API_TOKEN = process.env.CANVAS_API_TOKEN;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;

  if (!CANVAS_BASE_URL || !CANVAS_API_TOKEN) {
    return NextResponse.json(
      { error: 'Canvas API not configured' },
      { status: 500 }
    );
  }

  try {
    // Fetch assignments with submission summary
    const response = await fetch(
      `${CANVAS_BASE_URL}/api/v1/courses/${courseId}/assignments?per_page=50&include[]=submission_summary`,
      {
        headers: {
          Authorization: `Bearer ${CANVAS_API_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Canvas API error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch assignments from Canvas' },
        { status: response.status }
      );
    }

    const assignments = await response.json();
    return NextResponse.json(assignments);
  } catch (error) {
    console.error('Error fetching assignments:', error);
    return NextResponse.json(
      { error: 'Failed to connect to Canvas' },
      { status: 500 }
    );
  }
}
