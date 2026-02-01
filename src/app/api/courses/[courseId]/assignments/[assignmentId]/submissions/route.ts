import { NextResponse } from 'next/server';

const CANVAS_BASE_URL = process.env.CANVAS_BASE_URL;
const CANVAS_API_TOKEN = process.env.CANVAS_API_TOKEN;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string; assignmentId: string }> }
) {
  const { courseId, assignmentId } = await params;

  if (!CANVAS_BASE_URL || !CANVAS_API_TOKEN) {
    return NextResponse.json(
      { error: 'Canvas API not configured' },
      { status: 500 }
    );
  }

  try {
    // Fetch submissions with user info and submission comments
    const response = await fetch(
      `${CANVAS_BASE_URL}/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions?per_page=100&include[]=user&include[]=submission_comments&include[]=rubric_assessment`,
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
        { error: 'Failed to fetch submissions from Canvas' },
        { status: response.status }
      );
    }

    const submissions = await response.json();

    // Test student names to exclude
    const TEST_STUDENT_PATTERNS = [
      'Test Student',
      'J-DEC Test Child',
      'DEC Test',
    ];

    // Filter to only include submissions that have been submitted
    // and exclude test students
    const submittedSubmissions = submissions.filter(
      (sub: { workflow_state: string; submitted_at: string | null; user?: { name: string } }) => {
        // Must be submitted
        if (sub.workflow_state === 'unsubmitted' || sub.submitted_at === null) {
          return false;
        }
        // Exclude test students
        const userName = sub.user?.name || '';
        if (TEST_STUDENT_PATTERNS.some(pattern => userName.includes(pattern))) {
          return false;
        }
        return true;
      }
    );

    return NextResponse.json(submittedSubmissions);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json(
      { error: 'Failed to connect to Canvas' },
      { status: 500 }
    );
  }
}
