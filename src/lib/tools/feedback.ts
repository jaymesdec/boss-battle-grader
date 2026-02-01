// =============================================================================
// Feedback Tools - AI-powered feedback generation
// =============================================================================

import { anthropic, MODEL, MAX_TOKENS } from '@/lib/anthropic';
import { COMPETENCIES, RUBRIC_DESCRIPTORS } from '@/lib/competencies';
import type { ToolDefinition, FeedbackDraft, FeedbackPair, Grade, CompetencyId } from '@/types';
import { promises as fs } from 'fs';
import path from 'path';

const FEEDBACK_PAIRS_PATH = path.join(process.cwd(), 'data', 'feedback-pairs.json');

// -----------------------------------------------------------------------------
// Tool Definitions
// -----------------------------------------------------------------------------

export const feedbackToolDefinitions: ToolDefinition[] = [
  {
    name: 'draft_feedback',
    description: 'Generates initial feedback for a student submission based on teacher notes, the submission content, rubric criteria, and competency grades. Returns structured feedback with summary, strengths, growth areas, and next steps.',
    input_schema: {
      type: 'object',
      properties: {
        teacher_notes: {
          type: 'string',
          description: 'Raw notes from the teacher about the submission',
        },
        submission_text: {
          type: 'string',
          description: 'The extracted text content of the student submission',
        },
        competency_grades: {
          type: 'string',
          description: 'JSON string mapping competency IDs to letter grades (e.g., {"collaboration": "A", "communication": "B+"})',
        },
        rubric_criteria: {
          type: 'string',
          description: 'The rubric criteria and descriptors for this assignment',
        },
        student_name: {
          type: 'string',
          description: 'The name of the student',
        },
        assignment_name: {
          type: 'string',
          description: 'The name of the assignment',
        },
      },
      required: ['submission_text', 'competency_grades', 'student_name'],
    },
  },
  {
    name: 'revise_feedback',
    description: 'Takes an existing feedback draft and revision instructions, returns an improved version.',
    input_schema: {
      type: 'object',
      properties: {
        current_draft: {
          type: 'string',
          description: 'The current feedback draft to revise',
        },
        revision_instructions: {
          type: 'string',
          description: 'Instructions for how to revise the feedback (e.g., "make it shorter", "be more encouraging", "add specific examples")',
        },
      },
      required: ['current_draft', 'revision_instructions'],
    },
  },
  {
    name: 'save_feedback_pair',
    description: 'Saves a before/after pair of AI-generated and teacher-edited feedback for learning purposes.',
    input_schema: {
      type: 'object',
      properties: {
        assignment_id: {
          type: 'number',
          description: 'The Canvas assignment ID',
        },
        student_id: {
          type: 'number',
          description: 'The Canvas student user ID',
        },
        original_draft: {
          type: 'string',
          description: 'The original AI-generated feedback',
        },
        teacher_edited: {
          type: 'string',
          description: 'The teacher-edited version of the feedback',
        },
        competency_grades: {
          type: 'string',
          description: 'JSON string of competency grades used',
        },
      },
      required: ['assignment_id', 'student_id', 'original_draft', 'teacher_edited'],
    },
  },
];

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function buildRubricContext(grades: Partial<Record<CompetencyId, Grade>>): string {
  const lines: string[] = [];

  for (const [competencyId, grade] of Object.entries(grades)) {
    const competency = COMPETENCIES[competencyId as CompetencyId];
    const descriptor = RUBRIC_DESCRIPTORS[competencyId as CompetencyId]?.[grade as Grade];

    if (competency && descriptor) {
      lines.push(`${competency.emoji} ${competency.name}: ${grade}`);
      lines.push(`   Descriptor: ${descriptor}`);
    }
  }

  return lines.join('\n');
}

async function loadFeedbackPairs(): Promise<FeedbackPair[]> {
  try {
    const data = await fs.readFile(FEEDBACK_PAIRS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveFeedbackPairs(pairs: FeedbackPair[]): Promise<void> {
  await fs.mkdir(path.dirname(FEEDBACK_PAIRS_PATH), { recursive: true });
  await fs.writeFile(FEEDBACK_PAIRS_PATH, JSON.stringify(pairs, null, 2));
}

// -----------------------------------------------------------------------------
// Tool Implementations
// -----------------------------------------------------------------------------

export async function executeDraftFeedback(
  teacherNotes: string,
  submissionText: string,
  competencyGradesJson: string,
  rubricCriteria: string,
  studentName: string,
  assignmentName?: string
): Promise<string> {
  try {
    const competencyGrades = JSON.parse(competencyGradesJson) as Partial<Record<CompetencyId, Grade>>;
    const rubricContext = buildRubricContext(competencyGrades);

    // Load recent feedback pairs for few-shot examples
    const pairs = await loadFeedbackPairs();
    const recentExamples = pairs.slice(-3).map((pair) =>
      `Original: ${pair.originalDraft.slice(0, 200)}...\nTeacher edited to: ${pair.teacherEdited.slice(0, 200)}...`
    ).join('\n\n');

    const prompt = `You are a grading assistant for Franklin School. Generate constructive, encouraging feedback for a student submission.

## Student Information
- Name: ${studentName}
- Assignment: ${assignmentName || 'Unknown'}

## Competency Grades Given
${rubricContext}

## Teacher's Notes
${teacherNotes || 'No specific notes provided.'}

## Rubric Criteria
${rubricCriteria || 'Use the TD competency descriptors above as the rubric.'}

## Student Submission
${submissionText.slice(0, 8000)}

${recentExamples ? `## Teacher's Preferred Style (from recent edits)\n${recentExamples}` : ''}

## Instructions
Generate feedback that:
1. Opens with a brief, encouraging summary (1-2 sentences)
2. Highlights 2-3 specific strengths with examples from the submission
3. Identifies 1-2 growth areas constructively
4. Provides 1-2 concrete next steps for improvement
5. References specific parts of the submission
6. Maintains an encouraging but honest tone
7. Is appropriate for a student audience
8. Is concise (2-3 paragraphs total)

Respond with a JSON object containing:
{
  "summary": "Brief encouraging summary",
  "strengths": ["strength 1", "strength 2"],
  "growthAreas": ["growth area 1"],
  "nextSteps": ["next step 1"],
  "formattedFeedback": "The full formatted feedback paragraph ready to post to Canvas"
}`;

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from AI');
    }

    // Extract JSON from response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // If no JSON, create a simple structure
      return JSON.stringify({
        success: true,
        feedback: {
          summary: 'Feedback generated',
          strengths: [],
          growthAreas: [],
          nextSteps: [],
          formattedFeedback: textContent.text,
        },
      });
    }

    const feedback = JSON.parse(jsonMatch[0]) as FeedbackDraft;
    return JSON.stringify({
      success: true,
      feedback,
    });
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate feedback',
    });
  }
}

export async function executeReviseFeedback(
  currentDraft: string,
  revisionInstructions: string
): Promise<string> {
  try {
    const prompt = `You are a grading assistant. Revise the following feedback based on the instructions.

## Current Feedback
${currentDraft}

## Revision Instructions
${revisionInstructions}

## Guidelines
- Maintain an encouraging but honest tone
- Keep the feedback appropriate for students
- Be concise

Respond with the revised feedback as a JSON object:
{
  "summary": "Brief summary",
  "strengths": ["strength 1", "strength 2"],
  "growthAreas": ["growth area 1"],
  "nextSteps": ["next step 1"],
  "formattedFeedback": "The full formatted feedback"
}`;

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from AI');
    }

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return JSON.stringify({
        success: true,
        feedback: {
          summary: 'Revised feedback',
          strengths: [],
          growthAreas: [],
          nextSteps: [],
          formattedFeedback: textContent.text,
        },
      });
    }

    const feedback = JSON.parse(jsonMatch[0]) as FeedbackDraft;
    return JSON.stringify({
      success: true,
      feedback,
    });
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to revise feedback',
    });
  }
}

export async function executeSaveFeedbackPair(
  assignmentId: number,
  studentId: number,
  originalDraft: string,
  teacherEdited: string,
  competencyGradesJson?: string
): Promise<string> {
  try {
    const pairs = await loadFeedbackPairs();

    const newPair: FeedbackPair = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      assignmentId,
      studentId,
      originalDraft,
      teacherEdited,
      competencyGrades: competencyGradesJson ? JSON.parse(competencyGradesJson) : {},
      timestamp: new Date().toISOString(),
    };

    pairs.push(newPair);

    // Keep only the last 100 pairs
    const trimmedPairs = pairs.slice(-100);
    await saveFeedbackPairs(trimmedPairs);

    return JSON.stringify({
      success: true,
      pairId: newPair.id,
      totalPairs: trimmedPairs.length,
    });
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save feedback pair',
    });
  }
}
