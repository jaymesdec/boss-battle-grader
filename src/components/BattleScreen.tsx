'use client';

// =============================================================================
// BattleScreen - Main grading interface combining all panels
// =============================================================================

import { useState, useReducer, useCallback, useEffect } from 'react';
import { StreakBar } from './StreakBar';
import { StudentQueue } from './StudentQueue';
import { CharacterCard } from './CharacterCard';
import { SubmissionViewer } from './SubmissionViewer';
import { FeedbackComposer } from './FeedbackComposer';
import { CompetencyScorer } from './CompetencyScorer';
import {
  createInitialGameState,
  gameReducer,
  calculatePoints,
  POINTS,
} from '@/lib/game';
import type {
  CanvasSubmission,
  StudentCharacter,
  CompetencyId,
  Grade,
  FeedbackInput,
} from '@/types';

interface BattleScreenProps {
  courseId: number;
  courseName: string;
  assignmentId: number;
  assignmentName: string;
  submissions: CanvasSubmission[];
  onBack: () => void;
}

export function BattleScreen({
  courseId,
  courseName,
  assignmentId,
  assignmentName,
  submissions,
  onBack,
}: BattleScreenProps) {
  // Game state
  const [gameState, dispatch] = useReducer(gameReducer, null, createInitialGameState);

  // Current selection
  const [currentUserId, setCurrentUserId] = useState<number | null>(
    submissions.length > 0 ? submissions[0].user_id : null
  );

  // Grades for current submission
  const [currentGrades, setCurrentGrades] = useState<Partial<Record<CompetencyId, Grade>>>({});

  // Feedback for current submission
  const [currentFeedback, setCurrentFeedback] = useState<FeedbackInput>({
    text: '',
    voiceDurationSeconds: 0,
  });

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const [isPosting, setIsPosting] = useState(false);

  // Graded submissions tracking
  const [gradedIds, setGradedIds] = useState<Set<number>>(new Set());

  // Parsed submission content
  const [parsedContent, setParsedContent] = useState<string>('');

  // Get current submission and student
  const currentSubmission = submissions.find((s) => s.user_id === currentUserId) || null;
  const studentName = currentSubmission?.user?.name || `Student ${currentSubmission?.user_id || 0}`;
  const currentStudent: StudentCharacter | null = currentSubmission?.user
    ? {
        canvasUserId: currentSubmission.user_id,
        displayName: studentName,
        avatarUrl: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(studentName)}&backgroundColor=1a1a2e`,
        competencyStats: {} as Record<CompetencyId, import('@/types').CompetencyStat>,
      }
    : null;

  // Check idle combo reset
  useEffect(() => {
    const interval = setInterval(() => {
      dispatch({ type: 'CHECK_IDLE' });
    }, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Handle student selection
  const handleSelectStudent = useCallback((userId: number) => {
    setCurrentUserId(userId);
    setCurrentGrades({});
    setCurrentFeedback({ text: '', voiceDurationSeconds: 0 });
    setParsedContent('');
  }, []);

  // Handle grade change
  const handleGradeChange = useCallback((competencyId: CompetencyId, grade: Grade | null) => {
    setCurrentGrades((prev) => {
      if (grade === null) {
        const { [competencyId]: _, ...rest } = prev;
        return rest;
      }

      const isNewGrade = !prev[competencyId];
      if (isNewGrade) {
        // Award points for grading a competency
        const points = calculatePoints({ type: 'grade_competency' }, gameState.combo);
        dispatch({ type: 'ADD_XP', points: points.total });
        dispatch({ type: 'INCREMENT_COMBO' });

        // Check if all 9 are now graded
        const newGrades = { ...prev, [competencyId]: grade };
        if (Object.keys(newGrades).length === 9) {
          const bonusPoints = calculatePoints({ type: 'complete_all_9' }, gameState.combo);
          dispatch({ type: 'ADD_XP', points: bonusPoints.total });
        }
      }

      return { ...prev, [competencyId]: grade };
    });
  }, [gameState.combo]);

  // Handle feedback change
  const handleFeedbackChange = useCallback((feedback: FeedbackInput) => {
    setCurrentFeedback(feedback);
  }, []);

  // Generate AI feedback
  const handleGenerateAI = useCallback(async () => {
    if (Object.keys(currentGrades).length === 0) return;

    setIsGeneratingFeedback(true);
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'generate_feedback',
          studentName: currentStudent?.displayName || 'Student',
          grades: currentGrades,
          submissionContent: parsedContent || currentSubmission?.body || '',
        }),
      });

      if (!response.ok) throw new Error('Failed to generate feedback');

      const data = await response.json();
      setCurrentFeedback((prev) => ({
        ...prev,
        text: data.feedback || prev.text,
      }));

      // Award points for using AI
      const points = calculatePoints({ type: 'generate_ai' }, gameState.combo);
      dispatch({ type: 'ADD_XP', points: points.total });
    } catch (error) {
      console.error('Error generating feedback:', error);
    } finally {
      setIsGeneratingFeedback(false);
    }
  }, [currentGrades, currentStudent, parsedContent, currentSubmission, gameState.combo]);

  // Post grades to Canvas
  const handlePostToCanvas = useCallback(async () => {
    if (!currentSubmission || Object.keys(currentGrades).length !== 9) return;

    setIsPosting(true);
    try {
      // Calculate final score based on grades
      const gradeValues: Record<Grade, number> = {
        'A+': 100, 'A': 95, 'B': 85, 'C': 75, 'D': 65, 'F': 50,
      };
      const totalScore = Object.values(currentGrades).reduce(
        (sum, grade) => sum + (gradeValues[grade] || 0),
        0
      ) / 9;

      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'post_grades',
          courseId,
          assignmentId,
          userId: currentSubmission.user_id,
          score: Math.round(totalScore),
          comment: currentFeedback.text,
        }),
      });

      if (!response.ok) throw new Error('Failed to post to Canvas');

      // Mark as graded
      setGradedIds((prev) => new Set([...prev, currentSubmission.user_id]));
      dispatch({ type: 'MARK_GRADED', submissionId: String(currentSubmission.id) });

      // Award points for posting
      const sessionDuration = (Date.now() - gameState.sessionStartTime) / 1000;
      const avgTimePerSubmission = sessionDuration / (gradedIds.size + 1);
      const points = calculatePoints(
        { type: 'post_to_canvas', timeSpentSeconds: avgTimePerSubmission },
        gameState.combo
      );
      dispatch({ type: 'ADD_XP', points: points.total });

      // Award feedback bonus if feedback was added
      if (currentFeedback.text.trim().length > 0) {
        const feedbackPoints = calculatePoints({ type: 'add_feedback' }, gameState.combo);
        dispatch({ type: 'ADD_XP', points: feedbackPoints.total });
      }

      // Move to next ungraded student
      const nextUngraded = submissions.find(
        (s) => s.user_id !== currentSubmission.user_id && !gradedIds.has(s.user_id)
      );
      if (nextUngraded) {
        handleSelectStudent(nextUngraded.user_id);
      }
    } catch (error) {
      console.error('Error posting to Canvas:', error);
    } finally {
      setIsPosting(false);
    }
  }, [
    currentSubmission,
    currentGrades,
    currentFeedback,
    courseId,
    assignmentId,
    gameState,
    gradedIds,
    submissions,
    handleSelectStudent,
  ]);

  // Handle content parsed from submission
  const handleContentParsed = useCallback((content: string) => {
    setParsedContent(content);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top HUD */}
      <StreakBar
        gameState={gameState}
        gradedCount={gradedIds.size}
        totalCount={submissions.length}
        onBack={onBack}
        assignmentName={assignmentName}
        courseName={courseName}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Student Queue + Character Card */}
        <div className="w-72 flex flex-col border-r border-surface bg-surface/10">
          {/* Character Card */}
          <div className="h-80 border-b border-surface">
            <CharacterCard
              student={currentStudent}
              currentGrades={currentGrades}
              isLoading={isLoading}
            />
          </div>

          {/* Student Queue */}
          <div className="flex-1 overflow-y-auto">
            <StudentQueue
              submissions={submissions}
              currentUserId={currentUserId}
              gradedIds={gradedIds}
              onSelect={handleSelectStudent}
            />
          </div>
        </div>

        {/* Center Panel: Submission Viewer + Feedback Composer */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Submission Viewer (Top) */}
          <div className="flex-1 border-b border-surface overflow-hidden">
            <SubmissionViewer
              submission={currentSubmission}
              isLoading={isLoading}
              onContentParsed={handleContentParsed}
            />
          </div>

          {/* Feedback Composer (Bottom) */}
          <div className="h-64 bg-surface/10">
            <FeedbackComposer
              studentName={currentStudent?.displayName || 'Student'}
              submissionContent={parsedContent}
              currentGrades={currentGrades}
              onFeedbackChange={handleFeedbackChange}
              onGenerateAI={handleGenerateAI}
              isGenerating={isGeneratingFeedback}
            />
          </div>
        </div>

        {/* Right Panel: Competency Scorer */}
        <div className="w-80 border-l border-surface bg-surface/10">
          <CompetencyScorer
            grades={currentGrades}
            onGradeChange={handleGradeChange}
            onPostToCanvas={handlePostToCanvas}
            isPosting={isPosting}
            canPost={Object.keys(currentGrades).length === 9}
          />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Battle Screen with Data Fetching
// =============================================================================

interface BattleScreenContainerProps {
  courseId: number;
  assignmentId: number;
  onBack: () => void;
}

export function BattleScreenContainer({
  courseId,
  assignmentId,
  onBack,
}: BattleScreenContainerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    courseName: string;
    assignmentName: string;
    submissions: CanvasSubmission[];
  } | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch course, assignment, and submissions data
        const response = await fetch('/api/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task: 'custom',
            prompt: `Get the course name for course ${courseId}, assignment name for assignment ${assignmentId}, and all submissions for that assignment. Return as JSON with courseName, assignmentName, and submissions array.`,
          }),
        });

        if (!response.ok) throw new Error('Failed to fetch data');

        const result = await response.json();
        setData({
          courseName: result.courseName || `Course ${courseId}`,
          assignmentName: result.assignmentName || `Assignment ${assignmentId}`,
          submissions: result.submissions || [],
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [courseId, assignmentId]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">⚔️</div>
          <p className="text-text-primary font-display">LOADING DUNGEON...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-6xl mb-4">💀</div>
          <p className="text-accent-danger font-display mb-4">FAILED TO LOAD</p>
          <p className="text-text-muted text-sm mb-4">{error}</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-surface rounded-lg text-text-primary hover:bg-surface/80"
          >
            Return to Hub
          </button>
        </div>
      </div>
    );
  }

  return (
    <BattleScreen
      courseId={courseId}
      courseName={data.courseName}
      assignmentId={assignmentId}
      assignmentName={data.assignmentName}
      submissions={data.submissions}
      onBack={onBack}
    />
  );
}
