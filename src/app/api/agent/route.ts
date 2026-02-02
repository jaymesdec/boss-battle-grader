// =============================================================================
// Agent API Route - Main endpoint for agent tasks
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { runAgentLoop, streamAgentLoop } from '@/lib/agent/loop';
import { anthropic, MODEL, MAX_TOKENS } from '@/lib/anthropic';
import { postGrade, postComment, deleteComment, canvasClient } from '@/lib/canvas';
import {
  extractStudentIdentity,
  anonymizeText,
  deanonymizeObject,
  stripHtml,
} from '@/lib/privacy';
import { COMPETENCIES, RUBRIC_DESCRIPTORS, COMPETENCY_ORDER } from '@/lib/competencies';
import type { AgentTaskType, SessionState, CanvasRubric, ComprehensiveFeedbackResult, GoogleDocImage } from '@/types';

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
  googleDocImages?: GoogleDocImage[];
  courseId?: number;
  assignmentId?: number;
  userId?: number;
  score?: number;
  comment?: string;
  existingCommentId?: number; // For updating existing comments
  // Fields for generate_all_feedback task
  rubric?: CanvasRubric[];
  assignmentDescription?: string;
  teacherNotes?: string;
  // Fields for post_grades task with rubric assessment
  rubricAssessment?: Record<string, { points: number; rating_id: string; comments: string }>;
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

    // Special handling for generate_all_feedback task
    if (body.task === 'generate_all_feedback') {
      return handleGenerateAllFeedback(body);
    }

    // Special handling for post_grades task (direct Canvas API calls)
    if (body.task === 'post_grades') {
      return handlePostGrades(body);
    }

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
// Generate All Feedback Handler
// -----------------------------------------------------------------------------

async function handleGenerateAllFeedback(body: AgentRequest) {
  const { studentName, submissionContent, pdfImages, googleDocImages, rubric, assignmentDescription, teacherNotes } = body;

  // PRIVACY: Extract student identity for anonymization
  const identity = extractStudentIdentity(studentName || '');

  // PRIVACY: Anonymize all text content before sending to LLM
  const anonymizedSubmission = anonymizeText(submissionContent || '', identity);
  const anonymizedNotes = anonymizeText(teacherNotes || '', identity);
  const cleanAssignmentDescription = stripHtml(assignmentDescription || '');

  // Build rubric JSON for the prompt
  const rubricJson = rubric?.map((criterion) => ({
    id: criterion.id,
    description: criterion.description,
    long_description: criterion.long_description,
    points: criterion.points,
    ratings: criterion.ratings.map((r) => ({
      id: r.id,
      description: r.description,
      long_description: r.long_description,
      points: r.points,
    })),
  })) || [];

  // Build competency definitions for the prompt
  const competencyJson = COMPETENCY_ORDER.map((id) => ({
    id,
    name: COMPETENCIES[id].name,
    description: COMPETENCIES[id].description,
    gradeDescriptors: RUBRIC_DESCRIPTORS[id],
  }));

  // Build the comprehensive prompt
  const systemPrompt = `You are an expert grading assistant helping a teacher provide feedback on student work.
You will analyze the submission and generate scores and feedback for both the assignment rubric and the TD competencies.

## CRITICAL STYLE REQUIREMENTS
- Use 2nd person ("You demonstrated...", "Your work shows...")
- NEVER use the student's name - they are referred to as [STUDENT] in the content but you should not use any name or placeholder in your output
- NEVER say "your teacher" or reference the teacher in third person - speak AS the teacher directly
- Be specific about what you observed but do NOT summarize or list what they submitted
- Keep all feedback SHORT and DIRECT
- If selecting the highest rating for a criterion: challenge them to go even further

## SPECIFICITY ANALYSIS
When teacher notes are provided, analyze them for specificity:
- Submission references: quotes, slide numbers, specific examples from the student's work
- Rubric/competency references: mentions of specific criteria or competency names
Count and list these references to help measure feedback quality.

## OUTPUT FORMAT
You must respond with ONLY valid JSON in this exact format:
{
  "rubricScores": [
    {
      "criterionId": "criterion_id_here",
      "ratingId": "rating_id_here",
      "points": 20,
      "comments": "First sentence about what was done well. Second sentence with specific improvement or challenge."
    }
  ],
  "competencyScores": [
    { "competencyId": "collaboration", "grade": "B" }
  ],
  "generalSummary": "First sentence: overall assessment. Second sentence: key strength with evidence. Third sentence: primary growth opportunity or next challenge.",
  "specificityAnalysis": {
    "submissionReferences": ["specific quote or reference from student work"],
    "rubricReferences": ["competency or criterion mentioned by name"],
    "totalReferences": 2,
    "tier": "medium"
  }
}

For specificityAnalysis.tier: "low" = 0 references, "medium" = 1-2 references, "high" = 3+ references`;

  const userPrompt = `## ASSIGNMENT DESCRIPTION
${cleanAssignmentDescription || 'No assignment description provided.'}

## RUBRIC CRITERIA
${JSON.stringify(rubricJson, null, 2)}

## TD COMPETENCIES
${JSON.stringify(competencyJson, null, 2)}

## STUDENT SUBMISSION
${anonymizedSubmission || 'No text submission provided.'}

${anonymizedNotes ? `## TEACHER NOTES (use as additional context)\n${anonymizedNotes}` : ''}

## YOUR TASK
1. For each RUBRIC CRITERION: Select the most appropriate rating and write exactly 2 sentences of feedback (what they did well + improvement/challenge)
2. For each of the 9 TD COMPETENCIES: Assign a grade (A+, A, B, C, D, or F) based on evidence in the submission
3. Write a GENERAL SUMMARY of exactly 3 sentences (overall assessment + key strength + growth opportunity)

Respond with ONLY the JSON object, no other text.`;

  // Build the message content with optional PDF and Google Doc images
  const userContent: Array<{ type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg'; data: string } }> = [];

  const MAX_GOOGLE_DOC_IMAGES = 20;
  const MAX_IMAGE_SIZE_BASE64 = 5 * 1024 * 1024; // 5MB per image

  // Validate Google Doc images before processing
  const validateGoogleDocImages = (images: GoogleDocImage[]): GoogleDocImage[] => {
    return images.filter(img => {
      const sizeBytes = Buffer.byteLength(img.base64Data, 'base64');
      if (sizeBytes > MAX_IMAGE_SIZE_BASE64) {
        console.warn(`Rejecting oversized image: ${img.objectId}`);
        return false;
      }
      if (!/^[A-Za-z0-9+/]+=*$/.test(img.base64Data)) {
        console.warn(`Rejecting invalid base64: ${img.objectId}`);
        return false;
      }
      return true;
    });
  };

  // Add PDF images first if available
  if (pdfImages && pdfImages.length > 0) {
    userContent.push({
      type: 'text',
      text: `I'm providing ${pdfImages.length} slide images from the student's PDF submission for your visual analysis:\n`,
    });

    for (let i = 0; i < pdfImages.length; i++) {
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: pdfImages[i].source.data,
        },
      });
      userContent.push({
        type: 'text',
        text: `[Slide ${i + 1}]`,
      });
    }
  }

  // Add Google Doc images if available
  if (googleDocImages && googleDocImages.length > 0) {
    const validImages = validateGoogleDocImages(googleDocImages);
    const imagesToUse = validImages.slice(0, MAX_GOOGLE_DOC_IMAGES);
    const truncated = validImages.length > MAX_GOOGLE_DOC_IMAGES;
    const total = imagesToUse.length;

    if (total > 0) {
      userContent.push({
        type: 'text',
        text: `\nI'm providing ${total} image${total !== 1 ? 's' : ''} from the student's Google Doc submission${truncated ? ` (${validImages.length - MAX_GOOGLE_DOC_IMAGES} additional images omitted due to limit)` : ''}:\n`,
      });

      for (let i = 0; i < imagesToUse.length; i++) {
        userContent.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: imagesToUse[i].base64Data,
          },
        });
        // Consistent labeling with [Image N of M] pattern
        const label = imagesToUse[i].altText
          ? `[Image ${i + 1} of ${total}: ${imagesToUse[i].altText}]`
          : `[Image ${i + 1} of ${total}]`;
        userContent.push({
          type: 'text',
          text: label,
        });
      }
    }
  }

  // Add the main prompt
  userContent.push({
    type: 'text',
    text: (pdfImages?.length || googleDocImages?.length) ? '\n\n' + userPrompt : userPrompt,
  });

  try {
    // Call Claude directly for structured JSON output
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    });

    // Extract text response
    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse JSON response
    let result: ComprehensiveFeedbackResult;
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      result = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Failed to parse Claude response:', textBlock.text);
      throw new Error('Failed to parse feedback response as JSON');
    }

    // PRIVACY: De-anonymize all text fields in the response
    // (In case [STUDENT] slipped through, we remove it rather than replacing with name)
    const cleanedResult = deanonymizeObject(result, identity);

    return NextResponse.json({
      success: true,
      result: cleanedResult,
    });
  } catch (error) {
    console.error('Generate all feedback error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate feedback',
      },
      { status: 500 }
    );
  }
}

// -----------------------------------------------------------------------------
// Post Grades Handler (Direct Canvas API Calls)
// -----------------------------------------------------------------------------

async function handlePostGrades(body: AgentRequest) {
  const { courseId, assignmentId, userId, score, comment, rubricAssessment } = body;

  if (!courseId || !assignmentId || !userId) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields: courseId, assignmentId, or userId' },
      { status: 400 }
    );
  }

  try {
    // Build rubric assessment in Canvas format (points + comments, no rating_id needed for API)
    let canvasRubricAssessment: Record<string, { points: number; comments?: string }> | undefined;

    if (rubricAssessment && Object.keys(rubricAssessment).length > 0) {
      canvasRubricAssessment = {};
      for (const [criterionId, assessment] of Object.entries(rubricAssessment)) {
        canvasRubricAssessment[criterionId] = {
          points: assessment.points,
          comments: assessment.comments || undefined,
        };
      }
    }

    // Post grade with rubric assessment
    const gradeResult = await postGrade(
      courseId,
      assignmentId,
      userId,
      String(score || 0),
      canvasRubricAssessment
    );

    if (!gradeResult.success) {
      throw new Error(gradeResult.error || 'Failed to post grade');
    }

    // Post comment if provided - delete existing teacher comments first
    if (comment && comment.trim().length > 0) {
      // Fetch current submission to get existing comments
      try {
        const submission = await canvasClient.get<{
          user_id: number;
          submission_comments?: Array<{ id: number; author_id: number }>;
        }>(
          `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`,
          { 'include[]': 'submission_comments' }
        );

        // Delete existing teacher comments (comments not from the student)
        if (submission.submission_comments) {
          for (const existingComment of submission.submission_comments) {
            if (existingComment.author_id !== userId) {
              await deleteComment(courseId, assignmentId, userId, existingComment.id);
            }
          }
        }
      } catch (deleteError) {
        console.error('Warning: Failed to delete existing comments:', deleteError);
        // Continue anyway - not critical
      }

      // Now post the new comment
      const commentResult = await postComment(courseId, assignmentId, userId, comment);
      if (!commentResult.success) {
        console.error('Warning: Failed to post comment:', commentResult.error);
        // Don't fail the whole operation if comment fails
      }
    }

    return NextResponse.json({
      success: true,
      submissionId: gradeResult.data?.id,
      postedGrade: gradeResult.data?.grade,
    });
  } catch (error) {
    console.error('Post grades error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to post grades',
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
