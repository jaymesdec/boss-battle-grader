// =============================================================================
// Canvas Tools - Agent-callable Canvas LMS operations
// =============================================================================

import {
  fetchCourses,
  fetchAssignments,
  fetchSubmissions,
  postGrade,
  postComment,
} from '@/lib/canvas';
import type { ToolDefinition } from '@/types';

// -----------------------------------------------------------------------------
// Tool Definitions (for Anthropic API)
// -----------------------------------------------------------------------------

export const canvasToolDefinitions: ToolDefinition[] = [
  {
    name: 'fetch_courses',
    description: 'Fetches all Canvas courses where the user has a teacher enrollment. Returns course names, IDs, student counts, and term information.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'fetch_assignments',
    description: 'Fetches all assignments for a specific course. Returns assignment names, due dates, points possible, submission summaries, and rubric data.',
    input_schema: {
      type: 'object',
      properties: {
        course_id: {
          type: 'number',
          description: 'The Canvas course ID',
        },
      },
      required: ['course_id'],
    },
  },
  {
    name: 'fetch_submissions',
    description: 'Fetches all student submissions for a specific assignment. Returns submission content, attachments, user info, existing grades, and comments.',
    input_schema: {
      type: 'object',
      properties: {
        course_id: {
          type: 'number',
          description: 'The Canvas course ID',
        },
        assignment_id: {
          type: 'number',
          description: 'The Canvas assignment ID',
        },
      },
      required: ['course_id', 'assignment_id'],
    },
  },
  {
    name: 'post_grade',
    description: 'Posts a grade to a student submission in Canvas. Can include rubric assessment scores.',
    input_schema: {
      type: 'object',
      properties: {
        course_id: {
          type: 'number',
          description: 'The Canvas course ID',
        },
        assignment_id: {
          type: 'number',
          description: 'The Canvas assignment ID',
        },
        user_id: {
          type: 'number',
          description: 'The Canvas user ID of the student',
        },
        grade: {
          type: 'string',
          description: 'The grade to post (e.g., "A", "B+", "85", "pass")',
        },
      },
      required: ['course_id', 'assignment_id', 'user_id', 'grade'],
    },
  },
  {
    name: 'post_comment',
    description: 'Posts a text comment on a student submission in Canvas. Use this to provide feedback to the student.',
    input_schema: {
      type: 'object',
      properties: {
        course_id: {
          type: 'number',
          description: 'The Canvas course ID',
        },
        assignment_id: {
          type: 'number',
          description: 'The Canvas assignment ID',
        },
        user_id: {
          type: 'number',
          description: 'The Canvas user ID of the student',
        },
        comment_text: {
          type: 'string',
          description: 'The feedback comment to post',
        },
      },
      required: ['course_id', 'assignment_id', 'user_id', 'comment_text'],
    },
  },
];

// -----------------------------------------------------------------------------
// Tool Implementations
// -----------------------------------------------------------------------------

export async function executeFetchCourses(): Promise<string> {
  const result = await fetchCourses();
  if (!result.success) {
    return JSON.stringify({ error: result.error });
  }
  return JSON.stringify({
    courses: result.data?.map((course) => ({
      id: course.id,
      name: course.name,
      code: course.course_code,
      studentCount: course.total_students,
      term: course.term?.name,
    })),
  });
}

export async function executeFetchAssignments(courseId: number): Promise<string> {
  const result = await fetchAssignments(courseId);
  if (!result.success) {
    return JSON.stringify({ error: result.error });
  }
  return JSON.stringify({
    assignments: result.data?.map((assignment) => ({
      id: assignment.id,
      name: assignment.name,
      dueAt: assignment.due_at,
      pointsPossible: assignment.points_possible,
      needsGrading: assignment.needs_grading_count,
      submissionSummary: assignment.submission_summary,
      hasRubric: !!assignment.rubric,
    })),
  });
}

export async function executeFetchSubmissions(
  courseId: number,
  assignmentId: number
): Promise<string> {
  const result = await fetchSubmissions(courseId, assignmentId);
  if (!result.success) {
    return JSON.stringify({ error: result.error });
  }
  return JSON.stringify({
    submissions: result.data?.map((submission) => ({
      id: submission.id,
      userId: submission.user_id,
      userName: submission.user?.name,
      submittedAt: submission.submitted_at,
      late: submission.late,
      attempt: submission.attempt,
      score: submission.score,
      grade: submission.grade,
      submissionType: submission.submission_type,
      hasBody: !!submission.body,
      hasUrl: !!submission.url,
      attachmentCount: submission.attachments?.length || 0,
    })),
  });
}

export async function executePostGrade(
  courseId: number,
  assignmentId: number,
  userId: number,
  grade: string
): Promise<string> {
  const result = await postGrade(courseId, assignmentId, userId, grade);
  if (!result.success) {
    return JSON.stringify({ error: result.error });
  }
  return JSON.stringify({
    success: true,
    submissionId: result.data?.id,
    postedGrade: result.data?.grade,
  });
}

export async function executePostComment(
  courseId: number,
  assignmentId: number,
  userId: number,
  commentText: string
): Promise<string> {
  const result = await postComment(courseId, assignmentId, userId, commentText);
  if (!result.success) {
    return JSON.stringify({ error: result.error });
  }
  return JSON.stringify({
    success: true,
    submissionId: result.data?.id,
  });
}
