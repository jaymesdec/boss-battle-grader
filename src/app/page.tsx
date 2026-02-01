'use client';

import { useState, useEffect } from 'react';
import { BattleScreen } from '@/components/BattleScreen';
import type { CanvasCourse, CanvasAssignment, CanvasSubmission } from '@/types';

type Screen = 'hub' | 'level' | 'battle';

// Demo data for testing
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
      body: '<p>For my Design Thinking project, I explored the problem of food waste in school cafeterias. I conducted user research with 15 students and 3 cafeteria staff members.</p><p>Key insights:</p><ul><li>Students often take more food than they can eat</li><li>Portion sizes are standardized but appetites vary</li><li>There is no feedback mechanism for students</li></ul><p>My proposed solution is a "smart tray" system that weighs food waste and gamifies reduction through class competitions.</p>',
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
      submission_type: 'online_text_entry',
      body: '<p>My project focuses on improving accessibility in our school building for students with mobility challenges.</p><p>Through empathy mapping and interviews, I discovered several pain points in daily navigation. The prototype I created is a digital wayfinding app with AR features.</p>',
      attachments: [],
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
      body: '<p>I designed a study buddy matching system. The idea came from my own struggles finding good study partners.</p>',
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
      body: '<p>My Design Thinking project addressed mental health support for teenagers. I created a peer support app concept with anonymous check-ins and resource matching.</p><p>The iterative design process included three rounds of user testing with real students, leading to significant improvements in the UI and feature set.</p>',
      attachments: [],
    },
  ];
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>('hub');
  const [courses, setCourses] = useState<CanvasCourse[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CanvasCourse | null>(null);
  const [assignments, setAssignments] = useState<CanvasAssignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<CanvasAssignment | null>(null);
  const [submissions, setSubmissions] = useState<CanvasSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch courses on mount
  useEffect(() => {
    async function fetchCourses() {
      try {
        const response = await fetch('/api/agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task: 'custom',
            prompt: 'List all available Canvas courses. Return as JSON with a "courses" array.',
          }),
        });

        if (!response.ok) throw new Error('Failed to fetch courses');
        const data = await response.json();
        setCourses(data.courses || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load courses');
      } finally {
        setIsLoading(false);
      }
    }

    fetchCourses();
  }, []);

  // Fetch assignments when course selected
  const handleSelectCourse = async (course: CanvasCourse) => {
    setSelectedCourse(course);
    setScreen('level');
    setIsLoading(true);

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'custom',
          prompt: `List all assignments for course ${course.id}. Return as JSON with an "assignments" array.`,
        }),
      });

      if (!response.ok) throw new Error('Failed to fetch assignments');
      const data = await response.json();
      setAssignments(data.assignments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assignments');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch submissions when assignment selected
  const handleSelectAssignment = async (assignment: CanvasAssignment) => {
    if (!selectedCourse) return;

    setSelectedAssignment(assignment);
    setScreen('battle');

    // Use demo data if in demo mode
    if (selectedCourse.id === 0) {
      setSubmissions(getDemoSubmissions());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'custom',
          prompt: `Get all submissions for course ${selectedCourse.id} assignment ${assignment.id}. Return as JSON with a "submissions" array.`,
        }),
      });

      if (!response.ok) throw new Error('Failed to fetch submissions');
      const data = await response.json();
      setSubmissions(data.submissions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submissions');
    } finally {
      setIsLoading(false);
    }
  };

  // Navigate back
  const handleBack = () => {
    if (screen === 'battle') {
      setScreen('level');
      setSelectedAssignment(null);
      setSubmissions([]);
    } else if (screen === 'level') {
      setScreen('hub');
      setSelectedCourse(null);
      setAssignments([]);
    }
  };

  // Show Battle Screen
  if (screen === 'battle' && selectedCourse && selectedAssignment) {
    return (
      <BattleScreen
        courseId={selectedCourse.id}
        courseName={selectedCourse.name}
        assignmentId={selectedAssignment.id}
        assignmentName={selectedAssignment.name}
        submissions={submissions}
        onBack={handleBack}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background text-text-primary">
      {/* Header */}
      <header className="border-b border-surface">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚔️</span>
            <h1 className="font-display text-xl">BOSS BATTLE GRADER</h1>
          </div>
          {screen !== 'hub' && (
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-4 py-2 bg-surface rounded-lg hover:bg-surface/80 transition-colors"
            >
              <span>←</span>
              <span>Back</span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Hub Screen - Course Selection */}
        {screen === 'hub' && (
          <div>
            <h2 className="font-display text-2xl mb-6">
              SELECT YOUR LEVEL <span className="text-text-muted">(Course)</span>
            </h2>

            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <span className="text-4xl animate-bounce block mb-4">🎮</span>
                  <p className="text-text-muted">Loading courses...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-accent-danger/20 border border-accent-danger rounded-lg p-4 mb-6">
                <p className="text-accent-danger">{error}</p>
              </div>
            )}

            {!isLoading && courses.length === 0 && !error && (
              <div className="text-center py-12">
                <span className="text-6xl block mb-4">📚</span>
                <p className="text-text-muted mb-4">No courses found</p>
                <p className="text-sm text-text-muted">
                  Make sure your Canvas API token is configured in .env.local
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {courses.map((course) => (
                <button
                  key={course.id}
                  onClick={() => handleSelectCourse(course)}
                  className="p-6 bg-surface/50 rounded-xl border border-surface hover:border-accent-primary transition-all text-left group"
                >
                  <div className="flex items-start gap-4">
                    <span className="text-4xl">📖</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-lg text-text-primary group-hover:text-accent-primary transition-colors truncate">
                        {course.name}
                      </h3>
                      <p className="text-sm text-text-muted mt-1">
                        {course.course_code || 'No code'}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Demo Mode */}
            <div className="mt-12 border-t border-surface pt-8">
              <h3 className="font-display text-lg mb-4 text-text-muted">
                OR TRY DEMO MODE
              </h3>
              <button
                onClick={() => {
                  setSelectedCourse({
                    id: 0,
                    name: 'Demo Course: Design & Technology',
                    course_code: 'DEMO-101',
                    enrollment_term_id: 0,
                    total_students: 25,
                  });
                  setAssignments([
                    { id: 1, name: 'Design Thinking Project', description: '', points_possible: 100, due_at: null, course_id: 0, submission_types: ['online_upload'] },
                    { id: 2, name: 'Systems Analysis Report', description: '', points_possible: 100, due_at: null, course_id: 0, submission_types: ['online_upload'] },
                    { id: 3, name: 'Future Scenario Prototype', description: '', points_possible: 100, due_at: null, course_id: 0, submission_types: ['online_upload'] },
                  ]);
                  // Set demo submissions for testing
                  setSubmissions(getDemoSubmissions());
                  setScreen('level');
                }}
                className="px-6 py-3 bg-gradient-to-r from-accent-secondary to-accent-primary text-background rounded-lg font-display hover:opacity-90 transition-opacity"
              >
                🎮 START DEMO
              </button>
            </div>
          </div>
        )}

        {/* Level Screen - Assignment Selection */}
        {screen === 'level' && selectedCourse && (
          <div>
            <div className="mb-6">
              <p className="text-text-muted text-sm">COURSE</p>
              <h2 className="font-display text-2xl">{selectedCourse.name}</h2>
            </div>

            <h3 className="font-display text-lg mb-4">
              SELECT YOUR DUNGEON <span className="text-text-muted">(Assignment)</span>
            </h3>

            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <span className="text-4xl animate-bounce block mb-4">⚔️</span>
                  <p className="text-text-muted">Loading assignments...</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignments.map((assignment) => (
                <button
                  key={assignment.id}
                  onClick={() => handleSelectAssignment(assignment)}
                  className="p-6 bg-surface/50 rounded-xl border border-surface hover:border-accent-gold transition-all text-left group"
                >
                  <div className="flex items-start gap-4">
                    <span className="text-4xl">🏰</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display text-lg text-text-primary group-hover:text-accent-gold transition-colors">
                        {assignment.name}
                      </h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-text-muted">
                        <span>💎 {assignment.points_possible || 100} pts</span>
                        {assignment.due_at && (
                          <span>
                            📅 {new Date(assignment.due_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-text-muted group-hover:text-accent-gold transition-colors">
                      →
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {!isLoading && assignments.length === 0 && (
              <div className="text-center py-12">
                <span className="text-6xl block mb-4">🏰</span>
                <p className="text-text-muted">No assignments found for this course</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-surface bg-background/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between text-sm text-text-muted">
          <span>Boss Battle Grader v0.1</span>
          <span>Franklin School D&T Department</span>
        </div>
      </footer>
    </div>
  );
}
