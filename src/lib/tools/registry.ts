// =============================================================================
// Tool Registry - Maps tool names to implementations for the agent loop
// =============================================================================

import type { ToolDefinition, CompetencyId, Grade } from '@/types';

// Import tool definitions
import { canvasToolDefinitions, executeFetchCourses, executeFetchAssignments, executeFetchSubmissions, executePostGrade, executePostComment } from './canvas';
import { contentToolDefinitions, executeReadSubmission, executeParseFile, executeParseUrl } from './content';
import { feedbackToolDefinitions, executeDraftFeedback, executeReviseFeedback, executeSaveFeedbackPair, executeReadPreferences } from './feedback';
import { studentToolDefinitions, executeReadStudentHistory, executeScoreCompetency } from './student';

// -----------------------------------------------------------------------------
// State Tool Definitions
// -----------------------------------------------------------------------------

export const stateToolDefinitions: ToolDefinition[] = [
  {
    name: 'read_context',
    description: 'Reads the current agent context including session state, teacher preferences, and available data.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'complete_task',
    description: 'Signals that the agent has completed its current task. Call this when done with the assigned work.',
    input_schema: {
      type: 'object',
      properties: {
        success: {
          type: 'string',
          description: 'Whether the task was completed successfully (true/false)',
          enum: ['true', 'false'],
        },
        notes: {
          type: 'string',
          description: 'Optional notes about the completion status',
        },
      },
      required: ['success'],
    },
  },
];

// -----------------------------------------------------------------------------
// Combined Tool Definitions
// -----------------------------------------------------------------------------

export const allToolDefinitions: ToolDefinition[] = [
  ...canvasToolDefinitions,
  ...contentToolDefinitions,
  ...feedbackToolDefinitions,
  ...studentToolDefinitions,
  ...stateToolDefinitions,
];

// -----------------------------------------------------------------------------
// Tool Executor
// -----------------------------------------------------------------------------

export type ToolInput = Record<string, unknown>;

export interface ToolResult {
  output: string;
  isCompletion: boolean;
}

export async function executeTool(
  toolName: string,
  input: ToolInput,
  contextProvider?: () => string
): Promise<ToolResult> {
  try {
    let output: string;
    let isCompletion = false;

    switch (toolName) {
      // Canvas tools
      case 'fetch_courses':
        output = await executeFetchCourses();
        break;

      case 'fetch_assignments':
        output = await executeFetchAssignments(input.course_id as number);
        break;

      case 'fetch_submissions':
        output = await executeFetchSubmissions(
          input.course_id as number,
          input.assignment_id as number
        );
        break;

      case 'post_grade':
        output = await executePostGrade(
          input.course_id as number,
          input.assignment_id as number,
          input.user_id as number,
          input.grade as string
        );
        break;

      case 'post_comment':
        output = await executePostComment(
          input.course_id as number,
          input.assignment_id as number,
          input.user_id as number,
          input.comment_text as string
        );
        break;

      // Content tools
      case 'read_submission':
        output = await executeReadSubmission(
          input.submission_id as number,
          input.submission_type as string,
          input.body as string | undefined,
          input.url as string | undefined,
          input.file_url as string | undefined,
          input.content_type as string | undefined
        );
        break;

      case 'parse_file':
        output = await executeParseFile(
          input.file_url as string,
          input.content_type as string
        );
        break;

      case 'parse_url':
        output = await executeParseUrl(input.url as string);
        break;

      // Feedback tools
      case 'draft_feedback':
        output = await executeDraftFeedback(
          input.teacher_notes as string || '',
          input.submission_text as string,
          input.competency_grades as string,
          input.rubric_criteria as string || '',
          input.student_name as string,
          input.assignment_name as string | undefined
        );
        break;

      case 'revise_feedback':
        output = await executeReviseFeedback(
          input.current_draft as string,
          input.revision_instructions as string
        );
        break;

      case 'save_feedback_pair':
        output = await executeSaveFeedbackPair(
          input.assignment_id as number,
          input.student_id as number,
          input.original_draft as string,
          input.teacher_edited as string,
          input.competency_grades as string | undefined
        );
        break;

      case 'read_preferences':
        output = await executeReadPreferences();
        break;

      // Student tools
      case 'read_student_history':
        output = await executeReadStudentHistory(
          input.course_id as number,
          input.user_id as number
        );
        break;

      case 'score_competency':
        output = await executeScoreCompetency(
          input.course_id as number,
          input.user_id as number,
          input.assignment_id as number,
          input.competency_id as CompetencyId,
          input.grade as Grade
        );
        break;

      // State tools
      case 'read_context':
        output = contextProvider ? contextProvider() : JSON.stringify({ error: 'No context provider available' });
        break;

      case 'complete_task':
        output = JSON.stringify({
          success: input.success === 'true',
          notes: input.notes || 'Task completed',
        });
        isCompletion = true;
        break;

      default:
        output = JSON.stringify({
          error: `Unknown tool: ${toolName}`,
        });
    }

    return { output, isCompletion };
  } catch (error) {
    return {
      output: JSON.stringify({
        error: error instanceof Error ? error.message : 'Tool execution failed',
      }),
      isCompletion: false,
    };
  }
}

// -----------------------------------------------------------------------------
// Tool Definition Helpers
// -----------------------------------------------------------------------------

export function getToolByName(name: string): ToolDefinition | undefined {
  return allToolDefinitions.find((tool) => tool.name === name);
}

export function getToolCategories(): Record<string, ToolDefinition[]> {
  return {
    canvas: canvasToolDefinitions,
    content: contentToolDefinitions,
    feedback: feedbackToolDefinitions,
    student: studentToolDefinitions,
    state: stateToolDefinitions,
  };
}
