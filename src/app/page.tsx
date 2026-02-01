'use client';

// =============================================================================
// Boss Battle Grader - Main Application
// =============================================================================

import { useReducer, useState, useEffect } from 'react';
import { HubScreen } from '@/components/HubScreen';
import { LevelSelect } from '@/components/LevelSelect';
import { BattleScreen } from '@/components/BattleScreen';
import { ResultsScreen } from '@/components/ResultsScreen';
import { createInitialGameState, gameReducer } from '@/lib/game';
import type { CanvasCourse, CanvasAssignment, CanvasSubmission, CanvasRubric } from '@/types';

// =============================================================================
// Demo Data for Testing
// =============================================================================

function getDemoSubmissions(): CanvasSubmission[] {
  const makeUser = (id: number, name: string) => ({
    id,
    name,
    sortable_name: name.split(' ').reverse().join(', '),
    short_name: name.split(' ')[0],
  });

  return [
    {
      id: 1001,
      assignment_id: 1,
      user_id: 101,
      user: makeUser(101, 'Alex Chen'),
      submitted_at: '2026-01-28T14:30:00Z',
      attempt: 1,
      late: false,
      score: null,
      grade: null,
      url: null,
      submission_type: 'online_text_entry',
      body: '<p>For my Design Thinking project, I explored the problem of food waste in school cafeterias.</p>',
      attachments: [],
    },
    {
      id: 1002,
      assignment_id: 1,
      user_id: 102,
      user: makeUser(102, 'Jordan Rivera'),
      submitted_at: '2026-01-29T09:15:00Z',
      attempt: 2,
      late: false,
      score: null,
      grade: null,
      url: null,
      submission_type: 'online_upload',
      body: '<p>My project focuses on improving accessibility in our school building.</p>',
      attachments: [
        {
          id: 2001,
          filename: 'Design_Thinking_Presentation.pdf',
          url: 'https://example.com/sample.pdf',
          content_type: 'application/pdf',
          size: 150000,
        },
      ],
    },
    {
      id: 1003,
      assignment_id: 1,
      user_id: 103,
      user: makeUser(103, 'Sam Patel'),
      submitted_at: '2026-01-30T23:58:00Z',
      attempt: 1,
      late: true,
      score: null,
      grade: null,
      url: null,
      submission_type: 'online_text_entry',
      body: '<p>I designed a study buddy matching system.</p>',
      attachments: [],
    },
    {
      id: 1004,
      assignment_id: 1,
      user_id: 104,
      user: makeUser(104, 'Morgan Kim'),
      submitted_at: null,
      attempt: 0,
      late: false,
      score: null,
      grade: null,
      url: null,
      submission_type: null,
      body: null,
      attachments: [],
    },
    {
      id: 1005,
      assignment_id: 1,
      user_id: 105,
      user: makeUser(105, 'Taylor Brooks'),
      submitted_at: '2026-01-27T16:45:00Z',
      attempt: 1,
      late: false,
      score: 85,
      grade: 'B',
      url: null,
      submission_type: 'online_text_entry',
      body: '<p>My Design Thinking project addressed mental health support for teenagers.</p>',
      attachments: [],
      rubric_assessment: {
        criterion_1: { points: 20, rating_id: 'r1_2', comments: '' },
        criterion_2: { points: 25, rating_id: 'r2_1', comments: '' },
        criterion_3: { points: 20, rating_id: 'r3_2', comments: '' },
        criterion_4: { points: 20, rating_id: 'r4_2', comments: '' },
      },
      submission_comments: [
        {
          id: 5001,
          author_id: 1,
          author_name: 'Jaymes Dec',
          comment: 'Great work on the mental health app concept!',
          created_at: '2026-01-28T10:30:00Z',
        },
      ],
    },
  ];
}

function getDemoRubric(): CanvasRubric[] {
  return [
    {
      id: 'criterion_1',
      description: 'Research & Problem Definition',
      long_description: 'How well did the student identify and define the problem?',
      points: 25,
      ratings: [
        { id: 'r1_1', description: 'Exceptional', long_description: 'Deep research', points: 25 },
        { id: 'r1_2', description: 'Proficient', long_description: 'Solid research', points: 20 },
        { id: 'r1_3', description: 'Developing', long_description: 'Basic research', points: 15 },
        { id: 'r1_4', description: 'Beginning', long_description: 'Limited research', points: 10 },
      ],
    },
    {
      id: 'criterion_2',
      description: 'Design Process',
      long_description: 'Evidence of iterative design thinking',
      points: 25,
      ratings: [
        { id: 'r2_1', description: 'Exceptional', long_description: 'Multiple iterations', points: 25 },
        { id: 'r2_2', description: 'Proficient', long_description: 'Good iteration', points: 20 },
        { id: 'r2_3', description: 'Developing', long_description: 'Some iteration', points: 15 },
        { id: 'r2_4', description: 'Beginning', long_description: 'Minimal iteration', points: 10 },
      ],
    },
    {
      id: 'criterion_3',
      description: 'Final Solution',
      long_description: 'Quality and feasibility of the proposed solution',
      points: 25,
      ratings: [
        { id: 'r3_1', description: 'Exceptional', long_description: 'Innovative, feasible', points: 25 },
        { id: 'r3_2', description: 'Proficient', long_description: 'Solid solution', points: 20 },
        { id: 'r3_3', description: 'Developing', long_description: 'Basic solution', points: 15 },
        { id: 'r3_4', description: 'Beginning', long_description: 'Incomplete', points: 10 },
      ],
    },
    {
      id: 'criterion_4',
      description: 'Presentation & Communication',
      long_description: 'Clarity of presentation',
      points: 25,
      ratings: [
        { id: 'r4_1', description: 'Exceptional', long_description: 'Clear, engaging', points: 25 },
        { id: 'r4_2', description: 'Proficient', long_description: 'Good presentation', points: 20 },
        { id: 'r4_3', description: 'Developing', long_description: 'Adequate', points: 15 },
        { id: 'r4_4', description: 'Beginning', long_description: 'Unclear', points: 10 },
      ],
    },
  ];
}

function getDemoCourse(): CanvasCourse {
  return {
    id: 0,
    name: 'Demo Course: Design & Technology',
    course_code: 'DEMO-101',
    enrollment_term_id: 0,
    total_students: 25,
  };
}

function getDemoAssignments(): CanvasAssignment[] {
  return [
    {
      id: 1,
      name: 'Design Thinking Project',
      description: '<h2>Design Thinking Project</h2><p>Apply Design Thinking methodology.</p>',
      points_possible: 100,
      due_at: '2026-01-31T23:59:00Z',
      course_id: 0,
      submission_types: ['online_upload'],
      submission_summary: { graded: 1, ungraded: 3, not_submitted: 1 },
    },
    {
      id: 2,
      name: 'Systems Analysis Report',
      description: '<p>Analyze a complex system.</p>',
      points_possible: 100,
      due_at: null,
      course_id: 0,
      submission_types: ['online_upload'],
      submission_summary: { graded: 0, ungraded: 0, not_submitted: 25 },
    },
    {
      id: 3,
      name: 'Future Scenario Prototype',
      description: '<p>Design a product for a speculative future.</p>',
      points_possible: 100,
      due_at: null,
      course_id: 0,
      submission_types: ['online_upload'],
      submission_summary: { graded: 5, ungraded: 10, not_submitted: 10 },
    },
  ];
}

// =============================================================================
// Main Component
// =============================================================================

type Screen = 'hub' | 'level' | 'battle' | 'results';

export default function Home() {
  // Game state with reducer
  const [gameState, dispatch] = useReducer(gameReducer, undefined, createInitialGameState);

  // Screen navigation
  const [screen, setScreen] = useState<Screen>('hub');

  // Data state
  const [courses, setCourses] = useState<CanvasCourse[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CanvasCourse | null>(null);
  const [assignments, setAssignments] = useState<CanvasAssignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<CanvasAssignment | null>(null);
  const [submissions, setSubmissions] = useState<CanvasSubmission[]>([]);
  const [rubric, setRubric] = useState<CanvasRubric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Session stats for results screen
  const [sessionStats, setSessionStats] = useState({
    totalGraded: 0,
    totalTimeSeconds: 0,
    avgTimeSeconds: 0,
    fastestTimeSeconds: 0,
    allCompetenciesScored: false,
    allHaveFeedback: false,
    allPosted: false,
  });

  // Fetch courses on mount
  useEffect(() => {
    async function fetchCourses() {
      try {
        const response = await fetch('/api/courses');
        if (!response.ok) throw new Error('Failed to fetch courses');
        const data = await response.json();
        setCourses(Array.isArray(data) ? data : (data.courses || []));
      } catch {
        // Fall back to empty array - user can use demo mode
        setCourses([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchCourses();
  }, []);

  // Check for idle combo reset
  useEffect(() => {
    const interval = setInterval(() => {
      dispatch({ type: 'CHECK_IDLE' });
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Navigation Handlers
  const handleSelectCourse = async (course: CanvasCourse) => {
    setSelectedCourse(course);
    setScreen('level');
    dispatch({ type: 'SELECT_COURSE', courseId: course.id });
    setIsLoading(true);
    setError(null);

    if (course.id === 0) {
      setAssignments(getDemoAssignments());
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/courses/${course.id}/assignments`);
      if (!response.ok) throw new Error('Failed to fetch assignments');
      const data = await response.json();
      setAssignments(Array.isArray(data) ? data : (data.assignments || []));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assignments');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAssignment = async (assignment: CanvasAssignment) => {
    if (!selectedCourse) return;

    setSelectedAssignment(assignment);
    setScreen('battle');
    dispatch({ type: 'SELECT_ASSIGNMENT', assignmentId: assignment.id });

    if (selectedCourse.id === 0) {
      setSubmissions(getDemoSubmissions());
      setRubric(getDemoRubric());
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/courses/${selectedCourse.id}/assignments/${assignment.id}/submissions`
      );
      if (!response.ok) throw new Error('Failed to fetch submissions');
      const data = await response.json();
      setSubmissions(Array.isArray(data) ? data : (data.submissions || []));
      setRubric(assignment.rubric || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submissions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartDemo = () => {
    const demoCourse = getDemoCourse();
    setSelectedCourse(demoCourse);
    setAssignments(getDemoAssignments());
    setScreen('level');
    dispatch({ type: 'SELECT_COURSE', courseId: 0 });
  };

  const handleBack = () => {
    if (screen === 'battle') {
      setScreen('level');
      setSelectedAssignment(null);
      setSubmissions([]);
    } else if (screen === 'level') {
      setScreen('hub');
      setSelectedCourse(null);
      setAssignments([]);
    } else if (screen === 'results') {
      setScreen('level');
    }
  };

  const handleShowResults = () => {
    const totalTimeSeconds = Math.floor((Date.now() - gameState.sessionStartTime) / 1000);
    const totalGraded = gameState.gradedSubmissionIds.length;

    setSessionStats({
      totalGraded,
      totalTimeSeconds,
      avgTimeSeconds: totalGraded > 0 ? Math.floor(totalTimeSeconds / totalGraded) : 0,
      fastestTimeSeconds: 90,
      allCompetenciesScored: true,
      allHaveFeedback: true,
      allPosted: true,
    });

    setScreen('results');
  };

  const handleContinue = () => {
    setScreen('battle');
  };

  const handleNewSession = () => {
    dispatch({ type: 'RESET_SESSION' });
    setScreen('hub');
    setSelectedCourse(null);
    setSelectedAssignment(null);
    setAssignments([]);
    setSubmissions([]);
  };

  // Render
  if (screen === 'results') {
    return (
      <ResultsScreen
        gameState={gameState}
        sessionStats={sessionStats}
        onContinue={handleContinue}
        onNewSession={handleNewSession}
      />
    );
  }

  if (screen === 'battle' && selectedCourse && selectedAssignment) {
    return (
      <BattleScreen
        courseId={selectedCourse.id}
        courseName={selectedCourse.name}
        assignmentId={selectedAssignment.id}
        assignmentName={selectedAssignment.name}
        assignmentDescription={selectedAssignment.description}
        submissions={submissions}
        rubric={rubric}
        onBack={handleBack}
      />
    );
  }

  if (screen === 'level' && selectedCourse) {
    return (
      <LevelSelect
        course={selectedCourse}
        assignments={assignments}
        gameState={gameState}
        isLoading={isLoading}
        onSelectAssignment={handleSelectAssignment}
        onBack={handleBack}
      />
    );
  }

  return (
    <HubScreen
      courses={courses}
      gameState={gameState}
      isLoading={isLoading}
      error={error}
      onSelectCourse={handleSelectCourse}
      onStartDemo={handleStartDemo}
    />
  );
}
