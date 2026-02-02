'use client';

// =============================================================================
// BattleScreen - Main grading interface combining all panels
// =============================================================================

import { useState, useReducer, useCallback, useEffect } from 'react';
import { StreakBar } from './StreakBar';
import { StudentQueue } from './StudentQueue';
import { CharacterCard } from './CharacterCard';
import { SubmissionViewer, type PDFImageForAI } from './SubmissionViewer';
import type { PDFPage } from './PDFViewer';
import { BatchUploadModal } from './BatchUploadModal';
import { FeedbackComposer } from './FeedbackComposer';
import { CompetencyScorer } from './CompetencyScorer';
import { FeedbackReviewOverlay } from './FeedbackReviewOverlay';
import { SubmissionXPSummary, type XPBreakdown } from './SubmissionXPSummary';
import {
  createInitialGameState,
  gameReducer,
  calculatePoints,
  calculatePersonalizationTier,
  getDaysSinceDeadline,
  calculateTimelinessMultiplier,
  getComboMultiplier,
  POINTS,
  CATEGORY_POINTS,
} from '@/lib/game';
import { saveCompetencyScores, loadCompetencyScores } from '@/lib/storage';
import { useSound } from '@/hooks/useSound';
import type {
  CanvasSubmission,
  StudentCharacter,
  CompetencyId,
  Grade,
  FeedbackInput,
  CanvasRubric,
  BatchAttachment,
  ComprehensiveFeedbackResult,
  RubricScore,
} from '@/types';

interface BattleScreenProps {
  courseId: number;
  courseName: string;
  assignmentId: number;
  assignmentName: string;
  assignmentDescription?: string;
  dueAt?: string | null;
  submissions: CanvasSubmission[];
  rubric?: CanvasRubric[];
  onBack: () => void;
}

export function BattleScreen({
  courseId,
  courseName,
  assignmentId,
  assignmentName,
  assignmentDescription,
  dueAt,
  submissions,
  rubric,
  onBack,
}: BattleScreenProps) {
  // Game state
  const [gameState, dispatch] = useReducer(gameReducer, null, createInitialGameState);

  // Sound effects
  const { play: playSound } = useSound(gameState.soundEnabled);

  // Current selection
  const [currentUserId, setCurrentUserId] = useState<number | null>(
    submissions.length > 0 ? submissions[0].user_id : null
  );

  // Grades for current submission (competency mode)
  const [currentGrades, setCurrentGrades] = useState<Partial<Record<CompetencyId, Grade>>>({});

  // Rubric scores for current submission (rubric mode)
  const [rubricScores, setRubricScores] = useState<Record<string, RubricScore>>({});

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

  // PDF images for AI vision analysis
  const [pdfImages, setPdfImages] = useState<PDFImageForAI[]>([]);

  // Batch upload state
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchAttachments, setBatchAttachments] = useState<Map<number, BatchAttachment>>(new Map());

  // Track existing comment ID for updating instead of creating new
  const [existingCommentId, setExistingCommentId] = useState<number | null>(null);

  // Collapsible student panel
  const [isStudentPanelOpen, setIsStudentPanelOpen] = useState(true);

  // Show assignment description toggle
  const [showAssignmentDescription, setShowAssignmentDescription] = useState(false);

  // Comprehensive AI feedback generation (all at once)
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);

  // Feedback review overlay
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  // Engagement tracking for scroll-to-unlock
  const [engagementMet, setEngagementMet] = useState(false);
  const [scrollPercent, setScrollPercent] = useState(0);

  // XP summary modal state
  const [showXPSummary, setShowXPSummary] = useState(false);
  const [xpBreakdown, setXPBreakdown] = useState<XPBreakdown | null>(null);
  const [lastSpecificityTier, setLastSpecificityTier] = useState<'low' | 'medium' | 'high' | null>(null);
  const [pendingNextStudentId, setPendingNextStudentId] = useState<number | null>(null);
  const [isLastSubmission, setIsLastSubmission] = useState(false);

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
    setParsedContent('');
    setPdfImages([]);
    setLastSpecificityTier(null); // Reset for new student

    // Find the submission for this student
    const submission = submissions.find((s) => s.user_id === userId);

    // Pre-populate rubric scores from existing Canvas rubric_assessment
    if (submission?.rubric_assessment && rubric) {
      const existingScores: Record<string, RubricScore> = {};
      for (const [criterionId, assessment] of Object.entries(submission.rubric_assessment)) {
        existingScores[criterionId] = {
          criterionId,
          ratingId: assessment.rating_id,
          points: assessment.points,
          comments: assessment.comments || '',
        };
      }
      setRubricScores(existingScores);
    } else {
      setRubricScores({});
    }

    // Pre-populate feedback text from existing Canvas comments (teacher's comments only)
    if (submission?.submission_comments && submission.submission_comments.length > 0) {
      // Find the most recent teacher comment (not from the student)
      const teacherComments = submission.submission_comments.filter(
        (c) => c.author_id !== submission.user_id
      );
      const latestComment = teacherComments[teacherComments.length - 1];
      if (latestComment) {
        setCurrentFeedback({ text: latestComment.comment, voiceDurationSeconds: 0 });
        setExistingCommentId(latestComment.id);
      } else {
        setCurrentFeedback({ text: '', voiceDurationSeconds: 0 });
        setExistingCommentId(null);
      }
    } else {
      setCurrentFeedback({ text: '', voiceDurationSeconds: 0 });
      setExistingCommentId(null);
    }

    // Load competency grades from localStorage (not stored in Canvas)
    const savedGrades = loadCompetencyScores(userId, assignmentId);
    if (savedGrades && Object.keys(savedGrades).length > 0) {
      setCurrentGrades(savedGrades);
    } else {
      setCurrentGrades({});
    }

    // Check for batch attachment for this student
    const batchAttachment = batchAttachments.get(userId);
    if (batchAttachment) {
      // Convert data URLs to AI format
      const aiImages: PDFImageForAI[] = batchAttachment.pdfImages.map((dataUrl) => ({
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: 'image/jpeg' as const,
          data: dataUrl.replace(/^data:image\/jpeg;base64,/, ''),
        },
      }));
      setPdfImages(aiImages);
      setParsedContent(`[Batch upload: ${batchAttachment.filename} with ${batchAttachment.pdfImages.length} pages]`);
    }
  }, [batchAttachments, submissions, rubric]);

  // Handle PDF pages loaded - store for AI vision
  const handlePDFPagesLoaded = useCallback((pages: PDFPage[], aiImages: PDFImageForAI[]) => {
    setPdfImages(aiImages);
    // Create a text summary of the PDF for text-based context
    const pagesSummary = `[PDF with ${pages.length} slides loaded for AI vision analysis]`;
    setParsedContent(pagesSummary);
  }, []);

  // Handle batch attachments received from modal
  const handleBatchAttachments = useCallback((attachments: Map<number, BatchAttachment>) => {
    setBatchAttachments(attachments);

    // If current student has a batch attachment, load it
    if (currentUserId && attachments.has(currentUserId)) {
      const attachment = attachments.get(currentUserId)!;
      // Convert data URLs to AI format
      const aiImages: PDFImageForAI[] = attachment.pdfImages.map((dataUrl) => ({
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: 'image/jpeg' as const,
          data: dataUrl.replace(/^data:image\/jpeg;base64,/, ''),
        },
      }));
      setPdfImages(aiImages);
      setParsedContent(`[Batch upload: ${attachment.filename} with ${attachment.pdfImages.length} pages]`);
    }
  }, [currentUserId]);

  // Get current batch attachment if available
  const currentBatchAttachment = currentUserId ? batchAttachments.get(currentUserId) : null;

  // Handle grade change
  const handleGradeChange = useCallback((competencyId: CompetencyId, grade: Grade | null) => {
    setCurrentGrades((prev) => {
      if (grade === null) {
        const { [competencyId]: _, ...rest } = prev;
        return rest;
      }

      const isNewGrade = !prev[competencyId];
      if (isNewGrade) {
        // Play success sound for new grade
        playSound('success');

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
  }, [gameState.combo, playSound]);

  // Handle rubric score change
  const handleRubricScoreChange = useCallback((criterionId: string, score: RubricScore | null) => {
    setRubricScores((prev) => {
      if (score === null) {
        const { [criterionId]: _, ...rest } = prev;
        return rest;
      }

      const isNewScore = !prev[criterionId];
      if (isNewScore) {
        // Award points for scoring a rubric criterion
        const points = calculatePoints({ type: 'grade_competency' }, gameState.combo);
        dispatch({ type: 'ADD_XP', points: points.total });
        dispatch({ type: 'INCREMENT_COMBO' });

        // Check if all criteria are now scored
        const newScores = { ...prev, [criterionId]: score };
        if (rubric && Object.keys(newScores).length === rubric.length) {
          const bonusPoints = calculatePoints({ type: 'complete_all_9' }, gameState.combo);
          dispatch({ type: 'ADD_XP', points: bonusPoints.total });
        }
      }

      return { ...prev, [criterionId]: score };
    });
  }, [gameState.combo, rubric]);

  // Handle feedback change
  const handleFeedbackChange = useCallback((feedback: FeedbackInput) => {
    setCurrentFeedback(feedback);
  }, []);

  // Handle scroll progress for engagement tracking
  const handleScrollProgress = useCallback((percent: number, met: boolean) => {
    setScrollPercent(percent);
    setEngagementMet(met);

    // Store engagement state in game state for the current submission
    if (currentSubmission) {
      dispatch({
        type: 'SET_SUBMISSION_ENGAGEMENT',
        submissionId: String(currentSubmission.id),
        scrollPercentage: percent,
        engagementMet: met,
      });
    }
  }, [currentSubmission]);

  // Reset engagement when switching students
  useEffect(() => {
    // Check if we have stored engagement for this submission
    if (currentSubmission) {
      const storedEngagement = gameState.submissionEngagement[String(currentSubmission.id)];
      if (storedEngagement) {
        setScrollPercent(storedEngagement.scrollPercentage);
        setEngagementMet(storedEngagement.engagementMet);
      } else {
        setScrollPercent(0);
        setEngagementMet(false);
      }
    }
  }, [currentSubmission?.id, gameState.submissionEngagement]);

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
          // Include PDF images for vision analysis if available
          pdfImages: pdfImages.length > 0 ? pdfImages : undefined,
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
  }, [currentGrades, currentStudent, parsedContent, currentSubmission, gameState.combo, pdfImages]);

  // Generate ALL feedback at once (rubric scores, competency scores, and summary)
  const handleGenerateAllFeedback = useCallback(async () => {
    if (!currentSubmission) return;

    setIsGeneratingAll(true);
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'generate_all_feedback',
          studentName: currentStudent?.displayName || 'Student',
          submissionContent: parsedContent || currentSubmission?.body || '',
          pdfImages: pdfImages.length > 0 ? pdfImages : undefined,
          rubric: rubric,
          assignmentDescription: assignmentDescription,
          teacherNotes: currentFeedback.text, // Use current feedback text as teacher notes
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate feedback');
      }

      const data = await response.json();

      if (!data.success || !data.result) {
        throw new Error('Invalid response from AI');
      }

      const result = data.result as ComprehensiveFeedbackResult;

      // Update rubric scores
      if (result.rubricScores && result.rubricScores.length > 0) {
        const newScores: Record<string, RubricScore> = {};
        for (const score of result.rubricScores) {
          newScores[score.criterionId] = {
            criterionId: score.criterionId,
            ratingId: score.ratingId,
            points: score.points,
            comments: score.comments,
          };
        }
        setRubricScores(newScores);
      }

      // Update competency grades
      if (result.competencyScores && result.competencyScores.length > 0) {
        const newGrades: Partial<Record<CompetencyId, Grade>> = {};
        for (const score of result.competencyScores) {
          newGrades[score.competencyId] = score.grade;
        }
        setCurrentGrades(newGrades);

        // Save to localStorage
        if (currentSubmission) {
          saveCompetencyScores(currentSubmission.user_id, assignmentId, newGrades);
        }
      }

      // Update feedback with general summary (replaces teacher notes)
      if (result.generalSummary) {
        setCurrentFeedback({ text: result.generalSummary, voiceDurationSeconds: 0 });

        // Store AI draft baseline for personalization tracking (Phase 4)
        dispatch({
          type: 'SET_AI_DRAFT_BASELINE',
          submissionId: String(currentSubmission.id),
          draft: result.generalSummary,
        });
      }

      // Calculate timeliness multiplier based on days since deadline
      const daysSinceDeadline = getDaysSinceDeadline(dueAt || null);
      const timelinessMultiplier = calculateTimelinessMultiplier(daysSinceDeadline);

      // Award engagement XP if engagement threshold was met (with timeliness multiplier)
      if (engagementMet) {
        const engagementPoints = Math.round(CATEGORY_POINTS.ENGAGEMENT * timelinessMultiplier);
        dispatch({
          type: 'ADD_CATEGORY_XP',
          category: 'engagement',
          points: engagementPoints,
        });
        dispatch({ type: 'INCREMENT_COMBO' });
      }

      // Award specificity XP based on AI analysis tier (with timeliness multiplier)
      if (result.specificityAnalysis) {
        const baseSpecificityPoints = CATEGORY_POINTS.SPECIFICITY[result.specificityAnalysis.tier];
        const specificityPoints = Math.round(baseSpecificityPoints * timelinessMultiplier);
        dispatch({
          type: 'ADD_CATEGORY_XP',
          category: 'specificity',
          points: specificityPoints,
        });
        // Store tier for XP summary display on submission
        setLastSpecificityTier(result.specificityAnalysis.tier);
      }

      // Award timeliness XP as a tracking category (shows in summary)
      if (timelinessMultiplier > 1.0) {
        // Bonus timeliness XP for same-day grading
        dispatch({
          type: 'ADD_CATEGORY_XP',
          category: 'timeliness',
          points: Math.round(20 * timelinessMultiplier), // Bonus visibility points
        });
      }

      // Award legacy points for using AI (kept for backward compatibility)
      const points = calculatePoints({ type: 'generate_ai' }, gameState.combo);
      dispatch({ type: 'ADD_XP', points: points.total });

    } catch (error) {
      console.error('Error generating comprehensive feedback:', error);
      // Could add a toast notification here
    } finally {
      setIsGeneratingAll(false);
    }
  }, [
    currentSubmission,
    currentStudent,
    parsedContent,
    pdfImages,
    rubric,
    assignmentDescription,
    currentFeedback.text,
    assignmentId,
    gameState.combo,
    engagementMet,
    dueAt,
  ]);

  // Open feedback review overlay
  const handleOpenReview = useCallback(() => {
    setIsReviewOpen(true);
  }, []);

  // Post grades to Canvas
  const handlePostToCanvas = useCallback(async () => {
    if (!currentSubmission) return;

    // Determine if we're in rubric mode or competency mode
    const hasRubricScores = Object.keys(rubricScores).length > 0 && rubric && rubric.length > 0;
    const hasCompetencyGrades = Object.keys(currentGrades).length === 9;

    // Must have either all rubric scores or all competency grades
    if (!hasRubricScores && !hasCompetencyGrades) {
      console.error('Must complete all scoring before posting to Canvas');
      return;
    }

    setIsPosting(true);
    try {
      let totalScore: number;
      let rubricAssessment: Record<string, { points: number; rating_id: string; comments: string }> | undefined;

      if (hasRubricScores && rubric) {
        // Calculate total from rubric scores
        totalScore = Object.values(rubricScores).reduce((sum, score) => sum + score.points, 0);

        // Build rubric assessment for Canvas
        rubricAssessment = {};
        for (const [criterionId, score] of Object.entries(rubricScores)) {
          rubricAssessment[criterionId] = {
            points: score.points,
            rating_id: score.ratingId,
            comments: score.comments || '',
          };
        }
      } else {
        // Calculate score from competency grades
        const gradeValues: Record<Grade, number> = {
          'A+': 100, 'A': 95, 'B': 85, 'C': 75, 'D': 65, 'F': 50,
        };
        totalScore = Object.values(currentGrades).reduce(
          (sum, grade) => sum + (gradeValues[grade] || 0),
          0
        ) / 9;
      }

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
          rubricAssessment,
        }),
      });

      if (!response.ok) throw new Error('Failed to post to Canvas');

      // Play success sound on successful post
      playSound('success');

      // Close review overlay if open
      setIsReviewOpen(false);

      // Save competency scores to localStorage (these don't go to Canvas)
      if (Object.keys(currentGrades).length > 0) {
        saveCompetencyScores(currentSubmission.user_id, assignmentId, currentGrades);
      }

      // Mark as graded
      setGradedIds((prev) => new Set([...prev, currentSubmission.user_id]));
      dispatch({ type: 'MARK_GRADED', submissionId: String(currentSubmission.id) });

      // Calculate timeliness multiplier for personalization
      const daysSinceDeadline = getDaysSinceDeadline(dueAt || null);
      const timelinessMultiplier = calculateTimelinessMultiplier(daysSinceDeadline);

      // Award personalization XP based on how much teacher edited the AI draft
      const aiDraftBaseline = gameState.aiDraftBaselines[String(currentSubmission.id)];
      const personalizationTier = calculatePersonalizationTier(
        aiDraftBaseline || null,
        currentFeedback.text
      );
      const basePersonalizationPoints = CATEGORY_POINTS.PERSONALIZATION[personalizationTier];
      const personalizationPoints = Math.round(basePersonalizationPoints * timelinessMultiplier);
      if (personalizationPoints > 0) {
        dispatch({
          type: 'ADD_CATEGORY_XP',
          category: 'personalization',
          points: personalizationPoints,
        });
        // Combo applies to personalization (per spec)
        if (personalizationTier === 'personalized') {
          dispatch({ type: 'INCREMENT_COMBO' });
        }
      }

      // Award legacy points for posting (kept for backward compatibility)
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

      // Check for completeness bonus - all submissions graded
      const newGradedIds = new Set([...gradedIds, currentSubmission.user_id]);
      const submissionsWithContent = submissions.filter(
        (s) => s.submitted_at !== null && s.submission_type !== null
      );
      const allGraded = submissionsWithContent.every((s) => newGradedIds.has(s.user_id));
      let completenessBonus = 0;

      if (allGraded && submissionsWithContent.length > 0) {
        // Award completeness bonus for finishing the entire assignment
        dispatch({ type: 'AWARD_COMPLETENESS_BONUS' });
        playSound('success'); // Special sound for completing assignment
        completenessBonus = CATEGORY_POINTS.COMPLETENESS_BONUS;
      }

      // Calculate XP breakdown for this submission to show in summary
      const comboMultiplier = getComboMultiplier(gameState.combo);
      const engagementPoints = engagementMet ? Math.round(CATEGORY_POINTS.ENGAGEMENT * timelinessMultiplier) : 0;
      const specificityPoints = lastSpecificityTier
        ? Math.round(CATEGORY_POINTS.SPECIFICITY[lastSpecificityTier] * timelinessMultiplier)
        : 0;
      const baseTotal = engagementPoints + specificityPoints + personalizationPoints;
      const multipliedTotal = Math.round(baseTotal * comboMultiplier);
      const finalTotal = multipliedTotal + completenessBonus;

      // Build XP breakdown for summary modal
      const breakdown: XPBreakdown = {
        engagement: engagementPoints,
        specificity: specificityPoints,
        personalization: personalizationPoints,
        baseTotal,
        timelinessMultiplier,
        comboMultiplier,
        finalTotal,
        completenessBonus: completenessBonus > 0 ? completenessBonus : undefined,
      };

      // Find next ungraded student
      const nextUngraded = submissions.find(
        (s) => s.user_id !== currentSubmission.user_id && !newGradedIds.has(s.user_id)
      );

      // Show XP summary modal instead of immediately transitioning
      setXPBreakdown(breakdown);
      setPendingNextStudentId(nextUngraded?.user_id || null);
      setIsLastSubmission(allGraded);
      setShowXPSummary(true);
    } catch (error) {
      console.error('Error posting to Canvas:', error);
    } finally {
      setIsPosting(false);
    }
  }, [
    currentSubmission,
    currentGrades,
    rubricScores,
    rubric,
    currentFeedback,
    courseId,
    assignmentId,
    gameState,
    gradedIds,
    submissions,
    handleSelectStudent,
    playSound,
    dueAt,
    engagementMet,
    lastSpecificityTier,
  ]);

  // Handle XP summary modal dismiss - continue to next student
  const handleXPSummaryContinue = useCallback(() => {
    setShowXPSummary(false);
    setXPBreakdown(null);

    // Reset specificity tier for next submission
    setLastSpecificityTier(null);

    // Transition to next student or stay on current if none left
    if (pendingNextStudentId) {
      handleSelectStudent(pendingNextStudentId);
      setPendingNextStudentId(null);
    }
    setIsLastSubmission(false);
  }, [pendingNextStudentId, handleSelectStudent]);

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
        onToggleSound={() => dispatch({ type: 'TOGGLE_SOUND' })}
        assignmentName={assignmentName}
        courseName={courseName}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Student Queue + Character Card (Collapsible) */}
        <div
          className={`
            flex flex-col border-r border-surface bg-surface/10 transition-all duration-300
            ${isStudentPanelOpen ? 'w-72' : 'w-12'}
          `}
        >
          {/* Collapse Toggle */}
          <button
            onClick={() => setIsStudentPanelOpen(!isStudentPanelOpen)}
            className="p-2 border-b border-surface hover:bg-surface/50 transition-colors flex items-center justify-center"
            title={isStudentPanelOpen ? 'Collapse panel' : 'Expand panel'}
          >
            <span className="text-text-muted">
              {isStudentPanelOpen ? '◀' : '▶'}
            </span>
          </button>

          {isStudentPanelOpen ? (
            <>
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
                {/* Batch Upload Button */}
                <div className="p-2 border-b border-surface">
                  <button
                    onClick={() => setIsBatchModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-surface/50 hover:bg-surface rounded-lg text-text-muted hover:text-text-primary transition-colors text-sm"
                  >
                    <span>📦</span>
                    <span>Batch Upload PDFs</span>
                    {batchAttachments.size > 0 && (
                      <span className="px-1.5 py-0.5 bg-accent-primary/20 text-accent-primary text-xs rounded">
                        {batchAttachments.size}
                      </span>
                    )}
                  </button>
                </div>
                <StudentQueue
                  submissions={submissions}
                  currentUserId={currentUserId}
                  gradedIds={gradedIds}
                  batchUploadedIds={new Set(batchAttachments.keys())}
                  onSelect={handleSelectStudent}
                />
              </div>
            </>
          ) : (
            /* Collapsed state - show current student mini info */
            <div className="flex-1 flex flex-col items-center py-4 gap-2">
              <span className="text-2xl">👤</span>
              <span className="text-xs text-text-muted [writing-mode:vertical-rl] rotate-180">
                {currentStudent?.displayName || 'Select'}
              </span>
            </div>
          )}
        </div>

        {/* Center Panel: Submission Viewer + Feedback Composer */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Toggle Bar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-surface bg-surface/20">
            <button
              onClick={() => setShowAssignmentDescription(false)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display transition-all
                ${!showAssignmentDescription
                  ? 'bg-accent-primary text-background'
                  : 'bg-surface/50 text-text-muted hover:bg-surface'
                }
              `}
            >
              <span>📝</span>
              <span>SUBMISSION</span>
            </button>
            <button
              onClick={() => setShowAssignmentDescription(true)}
              disabled={!assignmentDescription}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display transition-all
                ${showAssignmentDescription
                  ? 'bg-accent-primary text-background'
                  : assignmentDescription
                    ? 'bg-surface/50 text-text-muted hover:bg-surface'
                    : 'bg-surface/30 text-text-muted/50 cursor-not-allowed'
                }
              `}
            >
              <span>📋</span>
              <span>ASSIGNMENT</span>
            </button>
          </div>

          {/* Submission Viewer or Assignment Description (Top) */}
          <div className="flex-1 border-b border-surface overflow-hidden">
            {showAssignmentDescription && assignmentDescription ? (
              <div className="h-full overflow-y-auto p-6 bg-surface/10">
                <h2 className="font-display text-lg text-text-primary mb-4">
                  {assignmentName}
                </h2>
                <div className="text-text-primary text-sm whitespace-pre-wrap">
                  {assignmentDescription
                    .replace(/<[^>]*>/g, '')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/Start Here\s*Syllabus\s*Modules\s*More Resources/gi, '')
                    .replace(/\n{3,}/g, '\n\n')
                    .trim()}
                </div>
              </div>
            ) : (
              <SubmissionViewer
                submission={currentSubmission}
                isLoading={isLoading}
                onContentParsed={handleContentParsed}
                onPDFPagesLoaded={handlePDFPagesLoaded}
                batchAttachment={currentBatchAttachment}
                onScrollProgress={handleScrollProgress}
              />
            )}
          </div>

          {/* Feedback Composer (Bottom) */}
          <div className="h-64 bg-surface/10">
            <FeedbackComposer
              studentName={currentStudent?.displayName || 'Student'}
              submissionContent={parsedContent}
              currentGrades={currentGrades}
              currentFeedback={currentFeedback}
              onFeedbackChange={handleFeedbackChange}
              onGenerateAI={handleGenerateAllFeedback}
              isGenerating={isGeneratingAll}
              engagementMet={engagementMet}
              scrollPercent={scrollPercent}
            />
          </div>
        </div>

        {/* Right Panel: Competency Scorer - wider when student panel is closed */}
        <div className={`border-l border-surface bg-surface/10 transition-all duration-300 ${isStudentPanelOpen ? 'w-80' : 'w-[36rem]'}`}>
          <CompetencyScorer
            grades={currentGrades}
            onGradeChange={handleGradeChange}
            rubric={rubric}
            rubricScores={rubricScores}
            onRubricScoreChange={handleRubricScoreChange}
            onPostToCanvas={handlePostToCanvas}
            isPosting={isPosting}
            canPost={
              Object.keys(currentGrades).length === 9 ||
              (rubric && Object.keys(rubricScores).length === rubric.length)
            }
            onOpenReview={handleOpenReview}
            canReview={
              Object.keys(currentGrades).length === 9 ||
              (rubric && Object.keys(rubricScores).length === rubric.length)
            }
          />
        </div>
      </div>

      {/* Batch Upload Modal */}
      <BatchUploadModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        submissions={submissions}
        onAttachToSubmissions={handleBatchAttachments}
      />

      {/* Feedback Review Overlay */}
      <FeedbackReviewOverlay
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        onSave={handlePostToCanvas}
        rubricScores={rubricScores}
        onRubricScoresChange={setRubricScores}
        summaryFeedback={currentFeedback.text}
        onSummaryFeedbackChange={(text) => setCurrentFeedback(prev => ({ ...prev, text }))}
        rubric={rubric}
        studentName={studentName}
        totalPoints={rubric?.reduce((sum, c) => sum + c.points, 0) || 100}
        isSaving={isPosting}
      />

      {/* XP Summary Modal - shows after successful submission */}
      {showXPSummary && xpBreakdown && (
        <SubmissionXPSummary
          studentName={studentName}
          xpBreakdown={xpBreakdown}
          onContinue={handleXPSummaryContinue}
          isLastSubmission={isLastSubmission}
        />
      )}
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
