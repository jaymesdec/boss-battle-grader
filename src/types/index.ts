// =============================================================================
// Boss Battle Grader - TypeScript Types
// =============================================================================

// -----------------------------------------------------------------------------
// Grade Types
// -----------------------------------------------------------------------------

export type Grade = 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

export const GRADE_VALUES: Record<Grade, number> = {
  'A+': 100,
  'A': 90,
  'B': 80,
  'C': 70,
  'D': 55,
  'F': 30,
};

// -----------------------------------------------------------------------------
// TD Competency Types
// -----------------------------------------------------------------------------

export type CompetencyId =
  | 'collaboration'
  | 'communication'
  | 'reflexivity'
  | 'empathy'
  | 'knowledge'
  | 'futures'
  | 'systems'
  | 'adaptability'
  | 'agency';

export interface Competency {
  id: CompetencyId;
  name: string;
  emoji: string;
  description: string;
  color: string;
}

export interface CompetencyStat {
  currentGrade: Grade | null;
  history: Array<{
    assignmentId: number;
    grade: Grade;
    date: string;
  }>;
  trend: 'improving' | 'steady' | 'declining' | 'new';
}

// -----------------------------------------------------------------------------
// Canvas API Types
// -----------------------------------------------------------------------------

export interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
  enrollment_term_id: number;
  total_students: number;
  teachers?: Array<{
    id: number;
    display_name: string;
  }>;
  term?: {
    id: number;
    name: string;
  };
}

export interface CanvasAssignment {
  id: number;
  name: string;
  description: string;
  due_at: string | null;
  points_possible: number;
  course_id: number;
  submission_types: string[];
  rubric?: CanvasRubric[];
  rubric_settings?: {
    id: number;
    title: string;
  };
  needs_grading_count?: number;
  has_submitted_submissions?: boolean;
  submission_summary?: {
    graded: number;
    ungraded: number;
    not_submitted: number;
  };
}

export interface CanvasRubric {
  id: string;
  description: string;
  long_description: string;
  points: number;
  ratings: Array<{
    id: string;
    description: string;
    long_description: string;
    points: number;
  }>;
}

export interface CanvasSubmission {
  id: number;
  user_id: number;
  assignment_id: number;
  submitted_at: string | null;
  late: boolean;
  attempt: number;
  score: number | null;
  grade: string | null;
  body: string | null;
  url: string | null;
  submission_type: 'online_text_entry' | 'online_url' | 'online_upload' | 'none' | null;
  attachments?: CanvasAttachment[];
  user?: CanvasUser;
  submission_comments?: CanvasComment[];
  rubric_assessment?: Record<string, {
    points: number;
    rating_id: string;
    comments: string;
  }>;
}

export interface CanvasAttachment {
  id: number;
  filename: string;
  url: string;
  content_type: string;
  size: number;
}

export interface CanvasUser {
  id: number;
  name: string;
  sortable_name: string;
  short_name: string;
  avatar_url?: string;
}

export interface CanvasComment {
  id: number;
  author_id: number;
  author_name: string;
  comment: string;
  created_at: string;
}

// -----------------------------------------------------------------------------
// Student Types
// -----------------------------------------------------------------------------

export interface StudentCharacter {
  canvasUserId: number;
  displayName: string;
  avatarUrl: string;
  competencyStats: Record<CompetencyId, CompetencyStat>;
}

// -----------------------------------------------------------------------------
// Grading Types
// -----------------------------------------------------------------------------

export interface GradingSubmission {
  submissionId: number;
  student: StudentCharacter;
  submissionContent: string;
  submissionType: 'text' | 'url' | 'file' | 'none';
  attachments: Array<{
    filename: string;
    url: string;
    contentType: string;
  }>;
  submittedAt: string | null;
  late: boolean;
  attempt: number;
  competencyGrades: Partial<Record<CompetencyId, Grade>>;
  teacherNotes: string;
  aiFeedback: FeedbackDraft | null;
  postedToCanvas: boolean;
  gradedAt: number | null;
  timeSpentSeconds: number;
}

// -----------------------------------------------------------------------------
// Feedback Types
// -----------------------------------------------------------------------------

export interface FeedbackDraft {
  summary: string;
  strengths: string[];
  growthAreas: string[];
  nextSteps: string[];
  formattedFeedback: string;
}

export interface FeedbackInput {
  text: string;
  voiceNote?: Blob;
  voiceDurationSeconds: number;
}

export interface FeedbackPair {
  id: string;
  assignmentId: number;
  studentId: number;
  originalDraft: string;
  teacherEdited: string;
  competencyGrades: Partial<Record<CompetencyId, Grade>>;
  timestamp: string;
}

export interface TeacherPreferences {
  styleRules: string[];
  recentExamples: FeedbackPair[];
  distilledPatterns: string[];
}

// -----------------------------------------------------------------------------
// Game State Types
// -----------------------------------------------------------------------------

export type ScreenType = 'hub' | 'level' | 'battle' | 'results';

export interface GameState {
  currentScreen: ScreenType;
  selectedCourseId: number | null;
  selectedAssignmentId: number | null;
  sessionXP: number;
  combo: number;
  streak: number;
  lastGradeTimestamp: number | null;
  sessionStartTime: number;
  gradedSubmissionIds: string[];
  soundEnabled: boolean;
}

export type StreakLabel = 'COMBO' | 'STREAK' | 'ON FIRE' | 'UNSTOPPABLE' | null;

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: string;
}

// -----------------------------------------------------------------------------
// Agent Types
// -----------------------------------------------------------------------------

export type AgentTaskType =
  | 'generate_feedback'
  | 'generate_all_feedback'
  | 'surface_highlights'
  | 'post_grades'
  | 'analyze_trends'
  | 'custom';

// Response from generate_all_feedback task
export interface ComprehensiveFeedbackResult {
  rubricScores: Array<{
    criterionId: string;
    ratingId: string;
    points: number;
    comments: string;
  }>;
  competencyScores: Array<{
    competencyId: CompetencyId;
    grade: Grade;
  }>;
  generalSummary: string;
}

export interface AgentTask {
  task: AgentTaskType;
  context: Record<string, unknown>;
  prompt?: string;
}

export interface AgentToolResult {
  success: boolean;
  output: string;
  shouldContinue: boolean;
}

export interface SessionState {
  courseName: string;
  courseId: number;
  assignmentName: string;
  assignmentId: number;
  studentName: string;
  studentId: number;
  gradedCount: number;
  totalCount: number;
  grades: Partial<Record<CompetencyId, Grade>>;
  teacherNotes: string;
  submissionText: string;
  rubricCriteria: string;
}

// -----------------------------------------------------------------------------
// Tool Definition Types
// -----------------------------------------------------------------------------

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
}

// -----------------------------------------------------------------------------
// API Response Types
// -----------------------------------------------------------------------------

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AgentResponse {
  result: string;
  toolsUsed: string[];
  tokensUsed: number;
}

// -----------------------------------------------------------------------------
// Points System Types
// -----------------------------------------------------------------------------

export interface GradeAction {
  type: 'grade_competency' | 'complete_all_9' | 'add_feedback' | 'generate_ai' | 'post_to_canvas';
  timeSpentSeconds?: number;
}

export interface PointsBreakdown {
  base: number;
  speedBonus: number;
  multiplier: number;
  total: number;
}

// -----------------------------------------------------------------------------
// Batch Upload Types
// -----------------------------------------------------------------------------

export interface BatchAttachment {
  extractedText: string | null;
  pdfImages: string[]; // Base64 image data URLs
  filename: string;
  teacherNotes?: string;
}

export interface BatchFileInfo {
  id: string;
  file: File;
  filename: string;
  extractedText: string | null;
  pdfImages: string[];
  isProcessing: boolean;
  error: string | null;
}

export interface StudentMatch {
  fileId: string;
  filename: string;
  matchedStudentId: number | null;
  matchedStudentName: string | null;
  confidence: number;
  alternatives: Array<{
    id: number;
    name: string;
    score: number;
  }>;
}
