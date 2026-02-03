// =============================================================================
// Agent Context Generator - Builds context.md for the agent
// =============================================================================

import type { SessionState, CompetencyId, Grade, TeacherStyleRules } from '@/types';
import { COMPETENCIES } from '@/lib/competencies';
import { buildStyleInstructions } from '@/lib/feedback-distiller';

// -----------------------------------------------------------------------------
// Context Template
// -----------------------------------------------------------------------------

export interface ContextOptions {
  state?: Partial<SessionState>;
  styleRules?: TeacherStyleRules | null;
  recentExamples?: Array<{ original: string; edited: string }>;
}

export function generateContext(options?: ContextOptions | Partial<SessionState>): string {
  // Handle both old signature (just state) and new signature (options object)
  const opts: ContextOptions = options && 'state' in options
    ? options as ContextOptions
    : { state: options as Partial<SessionState> };

  const safeState = opts.state || {};
  const gradesFormatted = formatGrades(safeState.grades || {});
  const competencyList = Object.values(COMPETENCIES)
    .map((c) => `${c.emoji} ${c.name}`)
    .join(', ');

  // Build style preferences section if available
  const styleSection = opts.styleRules
    ? `\n${buildStyleInstructions(opts.styleRules)}`
    : '';

  // Build few-shot examples section if available
  const examplesSection = opts.recentExamples && opts.recentExamples.length > 0
    ? `\n\n## Recent Feedback Examples (Teacher's Style)\n${opts.recentExamples.slice(0, 3).map((ex, i) =>
      `### Example ${i + 1}\n**AI Draft:** ${ex.original.slice(0, 200)}...\n**Teacher Edited:** ${ex.edited.slice(0, 200)}...`
    ).join('\n\n')}`
    : '';

  return `# Boss Battle Grader — Agent Context

## Who I Am
Grading assistant for Franklin School. I help the teacher grade
student submissions by composing atomic tools in a loop.

## What I Know About This Teacher
- Name: Jaymes Dec
- Role: Director of Innovation
- Style: Encouraging but honest feedback${styleSection}${examplesSection}

## Current Session
- Course: ${safeState.courseName || 'Not selected'}${safeState.courseId ? ` (ID: ${safeState.courseId})` : ''}
- Assignment: ${safeState.assignmentName || 'Not selected'}${safeState.assignmentId ? ` (ID: ${safeState.assignmentId})` : ''}
- Student: ${safeState.studentName || 'Not selected'}${safeState.studentId ? ` (ID: ${safeState.studentId})` : ''}
- Progress: ${safeState.gradedCount ?? 0} / ${safeState.totalCount ?? 0} graded
- Competency grades so far: ${gradesFormatted || 'None assigned yet'}
- Teacher's voice notes: ${safeState.teacherNotes || 'None provided'}

## The 9 TD Competencies
${competencyList}

## My Guidelines
- Always reference specific parts of the submission in feedback
- Feedback should be encouraging but honest
- Use the 9 TD competencies as the assessment framework
- Match the teacher's voice (professional, supportive, growth-oriented)
- Keep feedback concise (2-3 paragraphs max)
- When unsure about a grade, note the ambiguity
- Never fabricate information about the submission

## Available Tools
Canvas: fetch_courses, fetch_assignments, fetch_submissions, post_grade, post_comment
Content: read_submission, parse_file, parse_url
Feedback: draft_feedback, revise_feedback, save_feedback_pair, read_preferences
Student: read_student_history, score_competency
State: read_context, complete_task

## Important Reminders
- Call complete_task when you have finished your assigned task
- If you encounter an error, report it and continue or call complete_task with success=false
- Do not make assumptions about submission content - always read it first
- Verify grades have been assigned before generating feedback
`;
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

function formatGrades(grades: Partial<Record<CompetencyId, Grade>>): string {
  const entries = Object.entries(grades);
  if (entries.length === 0) return 'None';

  return entries
    .map(([id, grade]) => {
      const competency = COMPETENCIES[id as CompetencyId];
      return competency ? `${competency.emoji} ${competency.name}: ${grade}` : `${id}: ${grade}`;
    })
    .join(', ');
}

// -----------------------------------------------------------------------------
// Task-Specific System Prompts
// -----------------------------------------------------------------------------

export function getSystemPromptForTask(
  taskType: string,
  context?: Partial<SessionState>
): string {
  const baseContext = generateContext(context || {});

  const taskInstructions: Record<string, string> = {
    generate_feedback: `
## Your Task: Generate Feedback

Generate constructive feedback for the current student submission.

Steps:
1. Read the submission content using read_submission or parse_file/parse_url
2. Review the competency grades that have been assigned
3. If teacher notes are provided, incorporate them
4. Call draft_feedback with all the gathered information
5. Return the formatted feedback
6. Call complete_task when done
`,
    surface_highlights: `
## Your Task: Surface Student Highlights

Analyze the grading session and identify interesting patterns about student performance.

Steps:
1. For each student graded, call read_student_history to get their trends
2. Identify notable improvements, consistent strengths, or areas needing attention
3. Compile 3-5 insightful highlights about student progress
4. Call complete_task with your findings
`,
    post_grades: `
## Your Task: Post Grades to Canvas

Post the completed grades and feedback to Canvas LMS.

Steps:
1. For each graded submission, call post_grade with the overall grade
2. Call post_comment with the feedback text
3. Report any errors encountered
4. Call complete_task when all grades are posted
`,
    analyze_trends: `
## Your Task: Analyze Class Trends

Analyze competency trends across the class for this assignment.

Steps:
1. Call fetch_submissions to get all submissions
2. For each student, call read_student_history
3. Identify class-wide patterns in competency performance
4. Note any concerning trends or exceptional improvements
5. Call complete_task with your analysis
`,
  };

  const taskInstruction = taskInstructions[taskType] || `
## Your Task: Custom Request

Complete the user's request using the available tools.
Call complete_task when you have finished.
`;

  return baseContext + taskInstruction;
}
