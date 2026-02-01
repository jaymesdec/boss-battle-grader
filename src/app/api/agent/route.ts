// =============================================================================
// Agent API Route - Main endpoint for agent tasks
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { runAgentLoop, streamAgentLoop } from '@/lib/agent/loop';
import type { AgentTaskType, SessionState } from '@/types';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

// Type for PDF images formatted for Claude's vision API
interface PDFImageForAI {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/jpeg';
    data: string;
  };
}

interface AgentRequest {
  task: AgentTaskType;
  prompt?: string;
  context: Partial<SessionState>;
  stream?: boolean;
  // Direct fields for simplified API (used by frontend)
  studentName?: string;
  grades?: Record<string, string>;
  submissionContent?: string;
  pdfImages?: PDFImageForAI[];
  courseId?: number;
  assignmentId?: number;
  userId?: number;
  score?: number;
  comment?: string;
}

// -----------------------------------------------------------------------------
// POST Handler - Execute Agent Task
// -----------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body: AgentRequest = await request.json();

    // Validate request
    if (!body.task) {
      return NextResponse.json(
        { error: 'Missing required field: task' },
        { status: 400 }
      );
    }

    // Merge direct fields into context for backwards compatibility
    const mergedContext: Partial<SessionState> = {
      ...body.context,
      studentName: body.studentName || body.context?.studentName,
      grades: body.grades || body.context?.grades,
      courseId: body.courseId || body.context?.courseId,
      assignmentId: body.assignmentId || body.context?.assignmentId,
    };

    // Build user message based on task type
    const userMessage = buildUserMessage(body.task, body.prompt, mergedContext, body.submissionContent);

    // Check if streaming is requested
    if (body.stream) {
      return streamResponse(body.task, userMessage, mergedContext, body.pdfImages);
    }

    // Run non-streaming agent loop with PDF images for vision
    const result = await runAgentLoop({
      task: body.task,
      userMessage,
      context: mergedContext,
      pdfImages: body.pdfImages,
    });

    return NextResponse.json({
      success: result.success,
      result: result.result,
      feedback: result.result, // Alias for generate_feedback task
      toolsUsed: result.toolsUsed,
      iterations: result.iterations,
      error: result.error,
    });
  } catch (error) {
    console.error('Agent API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// -----------------------------------------------------------------------------
// Streaming Response
// -----------------------------------------------------------------------------

async function streamResponse(
  task: AgentTaskType,
  userMessage: string,
  context: Partial<SessionState>,
  pdfImages?: PDFImageForAI[]
) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const generator = streamAgentLoop({
          task,
          userMessage,
          context,
        });

        for await (const event of generator) {
          const data = JSON.stringify(event) + '\n';
          controller.enqueue(encoder.encode(`data: ${data}\n`));
        }

        controller.close();
      } catch (error) {
        const errorData = JSON.stringify({
          type: 'error',
          data: {
            error: error instanceof Error ? error.message : 'Stream error',
          },
        });
        controller.enqueue(encoder.encode(`data: ${errorData}\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

// -----------------------------------------------------------------------------
// User Message Builder
// -----------------------------------------------------------------------------

function buildUserMessage(
  task: AgentTaskType,
  customPrompt: string | undefined,
  context: Partial<SessionState>,
  submissionContent?: string
): string {
  if (customPrompt) {
    return customPrompt;
  }

  switch (task) {
    case 'generate_feedback':
      return `Generate feedback for ${context.studentName || 'this student'}'s submission on the assignment "${context.assignmentName || 'this assignment'}".

${context.teacherNotes ? `Teacher's notes: ${context.teacherNotes}` : 'No specific teacher notes provided.'}

Competency grades assigned: ${JSON.stringify(context.grades || {})}

${submissionContent ? `Submission content:\n${submissionContent}\n` : ''}
Note: If PDF slide images are attached, analyze them visually to provide specific feedback on the student's work.

Please generate encouraging but honest feedback referencing specific parts of the submission.`;

    case 'surface_highlights':
      return `Analyze the grading session for ${context.courseName || 'this course'} and surface interesting highlights about student performance.

Students graded so far: ${context.gradedCount || 0}

Look for patterns, improvements, and notable achievements to share with the teacher.`;

    case 'post_grades':
      return `Post all completed grades and feedback to Canvas for ${context.assignmentName || 'this assignment'}.

Course ID: ${context.courseId}
Assignment ID: ${context.assignmentId}

Proceed with posting each grade and its associated feedback.`;

    case 'analyze_trends':
      return `Analyze competency trends across the class for the assignment "${context.assignmentName || 'this assignment'}".

Course: ${context.courseName || 'Unknown'}

Identify class-wide patterns in the 9 TD competencies.`;

    case 'custom':
    default:
      return customPrompt || 'Please assist with the current grading task.';
  }
}

// -----------------------------------------------------------------------------
// GET Handler - Health Check
// -----------------------------------------------------------------------------

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Boss Battle Grader Agent',
    timestamp: new Date().toISOString(),
  });
}
