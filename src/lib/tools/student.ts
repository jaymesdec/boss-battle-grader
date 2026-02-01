// =============================================================================
// Student Tools - Student history and competency tracking
// =============================================================================

import type { ToolDefinition, CompetencyStat, CompetencyId, Grade } from '@/types';
import { promises as fs } from 'fs';
import path from 'path';

const STUDENT_HISTORY_PATH = path.join(process.cwd(), 'data', 'student-history.json');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface StudentHistoryRecord {
  courseId: number;
  userId: number;
  competencies: Record<CompetencyId, CompetencyStat>;
  lastUpdated: string;
}

interface StudentHistoryStore {
  [key: string]: StudentHistoryRecord; // key is `${courseId}-${userId}`
}

// -----------------------------------------------------------------------------
// Tool Definitions
// -----------------------------------------------------------------------------

export const studentToolDefinitions: ToolDefinition[] = [
  {
    name: 'read_student_history',
    description: 'Fetches a student\'s grading history across assignments in a course. Returns per-competency grade history with dates and trend direction.',
    input_schema: {
      type: 'object',
      properties: {
        course_id: {
          type: 'number',
          description: 'The Canvas course ID',
        },
        user_id: {
          type: 'number',
          description: 'The Canvas user ID of the student',
        },
      },
      required: ['course_id', 'user_id'],
    },
  },
  {
    name: 'score_competency',
    description: 'Records the teacher\'s grade for one competency on the current submission. This updates the local state.',
    input_schema: {
      type: 'object',
      properties: {
        course_id: {
          type: 'number',
          description: 'The Canvas course ID',
        },
        user_id: {
          type: 'number',
          description: 'The Canvas user ID of the student',
        },
        assignment_id: {
          type: 'number',
          description: 'The Canvas assignment ID',
        },
        competency_id: {
          type: 'string',
          description: 'The competency ID (e.g., "collaboration", "communication")',
          enum: [
            'collaboration',
            'communication',
            'reflexivity',
            'empathy',
            'knowledge',
            'futures',
            'systems',
            'adaptability',
            'agency',
          ],
        },
        grade: {
          type: 'string',
          description: 'The letter grade (A+, A, B, C, D, F)',
          enum: ['A+', 'A', 'B', 'C', 'D', 'F'],
        },
      },
      required: ['course_id', 'user_id', 'assignment_id', 'competency_id', 'grade'],
    },
  },
];

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

async function loadStudentHistory(): Promise<StudentHistoryStore> {
  try {
    const data = await fs.readFile(STUDENT_HISTORY_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function saveStudentHistory(store: StudentHistoryStore): Promise<void> {
  await fs.mkdir(path.dirname(STUDENT_HISTORY_PATH), { recursive: true });
  await fs.writeFile(STUDENT_HISTORY_PATH, JSON.stringify(store, null, 2));
}

function calculateTrend(history: CompetencyStat['history']): CompetencyStat['trend'] {
  if (history.length < 2) return 'new';

  const gradeValues: Record<Grade, number> = {
    'A+': 100,
    'A': 90,
    'B': 80,
    'C': 70,
    'D': 55,
    'F': 30,
  };

  const sorted = [...history].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const recent = sorted.slice(-3);
  if (recent.length < 2) return 'new';

  const firstValue = gradeValues[recent[0].grade];
  const lastValue = gradeValues[recent[recent.length - 1].grade];

  const diff = lastValue - firstValue;

  if (diff > 5) return 'improving';
  if (diff < -5) return 'declining';
  return 'steady';
}

function getKey(courseId: number, userId: number): string {
  return `${courseId}-${userId}`;
}

function createEmptyCompetencyStats(): Record<CompetencyId, CompetencyStat> {
  const competencyIds: CompetencyId[] = [
    'collaboration',
    'communication',
    'reflexivity',
    'empathy',
    'knowledge',
    'futures',
    'systems',
    'adaptability',
    'agency',
  ];

  const stats: Record<CompetencyId, CompetencyStat> = {} as Record<CompetencyId, CompetencyStat>;

  for (const id of competencyIds) {
    stats[id] = {
      currentGrade: null,
      history: [],
      trend: 'new',
    };
  }

  return stats;
}

// -----------------------------------------------------------------------------
// Tool Implementations
// -----------------------------------------------------------------------------

export async function executeReadStudentHistory(
  courseId: number,
  userId: number
): Promise<string> {
  try {
    const store = await loadStudentHistory();
    const key = getKey(courseId, userId);
    const record = store[key];

    if (!record) {
      return JSON.stringify({
        success: true,
        found: false,
        message: 'No history found for this student in this course',
        competencies: createEmptyCompetencyStats(),
      });
    }

    return JSON.stringify({
      success: true,
      found: true,
      courseId: record.courseId,
      userId: record.userId,
      lastUpdated: record.lastUpdated,
      competencies: record.competencies,
    });
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read student history',
    });
  }
}

export async function executeScoreCompetency(
  courseId: number,
  userId: number,
  assignmentId: number,
  competencyId: CompetencyId,
  grade: Grade
): Promise<string> {
  try {
    const store = await loadStudentHistory();
    const key = getKey(courseId, userId);

    // Get or create record
    let record = store[key];
    if (!record) {
      record = {
        courseId,
        userId,
        competencies: createEmptyCompetencyStats(),
        lastUpdated: new Date().toISOString(),
      };
    }

    // Update the competency
    const competency = record.competencies[competencyId];
    competency.currentGrade = grade;

    // Add to history (avoid duplicates for same assignment)
    const existingIndex = competency.history.findIndex(
      (h) => h.assignmentId === assignmentId
    );

    const historyEntry = {
      assignmentId,
      grade,
      date: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      competency.history[existingIndex] = historyEntry;
    } else {
      competency.history.push(historyEntry);
    }

    // Recalculate trend
    competency.trend = calculateTrend(competency.history);

    // Update timestamp
    record.lastUpdated = new Date().toISOString();

    // Save
    store[key] = record;
    await saveStudentHistory(store);

    return JSON.stringify({
      success: true,
      competencyId,
      grade,
      trend: competency.trend,
      historyCount: competency.history.length,
    });
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to score competency',
    });
  }
}

// -----------------------------------------------------------------------------
// Convenience Functions
// -----------------------------------------------------------------------------

export async function getStudentCompetencyStats(
  courseId: number,
  userId: number
): Promise<Record<CompetencyId, CompetencyStat>> {
  const result = await executeReadStudentHistory(courseId, userId);
  const parsed = JSON.parse(result);
  return parsed.competencies || createEmptyCompetencyStats();
}

export async function updateAllCompetencies(
  courseId: number,
  userId: number,
  assignmentId: number,
  grades: Partial<Record<CompetencyId, Grade>>
): Promise<void> {
  for (const [competencyId, grade] of Object.entries(grades)) {
    if (grade) {
      await executeScoreCompetency(
        courseId,
        userId,
        assignmentId,
        competencyId as CompetencyId,
        grade
      );
    }
  }
}
