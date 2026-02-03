// =============================================================================
// Feedback Distiller - Extracts teacher style preferences from feedback pairs
// =============================================================================

import { anthropic, MODEL, MAX_TOKENS } from '@/lib/anthropic';
import type { FeedbackPair, TeacherStyleRules } from '@/types';

// -----------------------------------------------------------------------------
// Style Analysis Prompt
// -----------------------------------------------------------------------------

const DISTILLATION_PROMPT = `You are analyzing a teacher's feedback editing patterns. Given pairs of AI-generated feedback and teacher-edited versions, extract the teacher's style preferences.

## Feedback Pairs

{pairs}

## Analysis Task

Compare the original AI drafts with the teacher's edited versions. Identify patterns in how the teacher modifies feedback.

Respond with a JSON object containing these boolean flags and notes:

{
  "softensCriticism": true/false,     // Does teacher soften critical language?
  "addsEncouragement": true/false,    // Does teacher add more encouragement?
  "prefersShorter": true/false,       // Does teacher consistently shorten feedback?
  "includesNextSteps": true/false,    // Does teacher add/keep actionable next steps?
  "usesStudentName": true/false,      // Does teacher personalize with student name?
  "referencesRubric": true/false,     // Does teacher reference rubric criteria?
  "toneNotes": "...",                 // Brief description of tone preferences
  "structureNotes": "..."             // Brief description of structure preferences
}

Be specific in toneNotes and structureNotes - capture the teacher's unique voice and preferences.`;

// -----------------------------------------------------------------------------
// Distillation Function
// -----------------------------------------------------------------------------

export async function distillPreferences(pairs: FeedbackPair[]): Promise<TeacherStyleRules | null> {
  if (pairs.length < 5) {
    return null;
  }

  // Use recent pairs for analysis (last 20, or all if fewer)
  const recentPairs = pairs.slice(-20);

  const pairsText = recentPairs.map((pair, i) => `
### Pair ${i + 1}
**Original AI Draft:**
${pair.originalDraft.slice(0, 600)}${pair.originalDraft.length > 600 ? '...' : ''}

**Teacher's Edited Version:**
${pair.teacherEdited.slice(0, 600)}${pair.teacherEdited.length > 600 ? '...' : ''}
`).join('\n');

  const prompt = DISTILLATION_PROMPT.replace('{pairs}', pairsText);

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      console.error('Distillation: No text response from AI');
      return null;
    }

    // Extract JSON from response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Distillation: No JSON found in response');
      return null;
    }

    const rules = JSON.parse(jsonMatch[0]) as TeacherStyleRules;

    // Validate required fields
    if (
      typeof rules.softensCriticism !== 'boolean' ||
      typeof rules.addsEncouragement !== 'boolean' ||
      typeof rules.prefersShorter !== 'boolean' ||
      typeof rules.includesNextSteps !== 'boolean' ||
      typeof rules.usesStudentName !== 'boolean' ||
      typeof rules.referencesRubric !== 'boolean' ||
      typeof rules.toneNotes !== 'string' ||
      typeof rules.structureNotes !== 'string'
    ) {
      console.error('Distillation: Invalid rules structure');
      return null;
    }

    return rules;
  } catch (error) {
    console.error('Distillation failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

// -----------------------------------------------------------------------------
// Style Injection for Feedback Generation
// -----------------------------------------------------------------------------

export function buildStyleInstructions(rules: TeacherStyleRules): string {
  const instructions: string[] = [];

  if (rules.softensCriticism) {
    instructions.push('- Use gentler language when discussing areas for improvement');
  }
  if (rules.addsEncouragement) {
    instructions.push('- Include additional words of encouragement and recognition');
  }
  if (rules.prefersShorter) {
    instructions.push('- Keep feedback concise and to the point');
  }
  if (rules.includesNextSteps) {
    instructions.push('- Always include specific, actionable next steps');
  }
  if (rules.usesStudentName) {
    instructions.push('- Address the student by name throughout the feedback');
  }
  if (rules.referencesRubric) {
    instructions.push('- Reference specific rubric criteria when explaining grades');
  }

  if (rules.toneNotes) {
    instructions.push(`- Tone: ${rules.toneNotes}`);
  }
  if (rules.structureNotes) {
    instructions.push(`- Structure: ${rules.structureNotes}`);
  }

  return instructions.length > 0
    ? `## Teacher's Feedback Style Preferences\n${instructions.join('\n')}`
    : '';
}
