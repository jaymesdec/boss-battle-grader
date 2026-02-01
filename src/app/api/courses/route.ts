import { NextResponse } from 'next/server';

const CANVAS_BASE_URL = process.env.CANVAS_BASE_URL;
const CANVAS_API_TOKEN = process.env.CANVAS_API_TOKEN;

// Current grading period term ID
const CURRENT_TERM_ID = 155;

export async function GET() {
  if (!CANVAS_BASE_URL || !CANVAS_API_TOKEN) {
    return NextResponse.json(
      { error: 'Canvas API not configured' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `${CANVAS_BASE_URL}/api/v1/courses?enrollment_type=teacher&per_page=100&include[]=total_students`,
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
        { error: 'Failed to fetch courses from Canvas' },
        { status: response.status }
      );
    }

    const allCourses = await response.json();

    // Courses to exclude
    const EXCLUDED_PREFIXES = ['CAP'];
    const EXCLUDED_NAMES = ['FAIR Chatbot Testing', 'TD Week'];

    // Filter to only current term courses, excluding specific ones
    const courses = allCourses.filter(
      (course: { enrollment_term_id: number; name: string; course_code: string }) => {
        if (course.enrollment_term_id !== CURRENT_TERM_ID) return false;
        if (EXCLUDED_NAMES.includes(course.name)) return false;
        if (EXCLUDED_PREFIXES.some(prefix => course.course_code.startsWith(prefix))) return false;
        return true;
      }
    );

    return NextResponse.json(courses);
  } catch (error) {
    console.error('Error fetching courses:', error);
    return NextResponse.json(
      { error: 'Failed to connect to Canvas' },
      { status: 500 }
    );
  }
}
