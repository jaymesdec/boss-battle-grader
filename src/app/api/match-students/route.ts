// =============================================================================
// Match Students API - Fuzzy match PDF filenames to student names
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { matchFilesToStudents, type StudentInfo } from '@/lib/matching';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface MatchRequest {
  files: Array<{ id: string; name: string }>;
  students: StudentInfo[];
}

// -----------------------------------------------------------------------------
// POST Handler - Match files to students
// -----------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body: MatchRequest = await request.json();

    // Validate request
    if (!body.files || !Array.isArray(body.files)) {
      return NextResponse.json(
        { error: 'Missing required field: files (array)' },
        { status: 400 }
      );
    }

    if (!body.students || !Array.isArray(body.students)) {
      return NextResponse.json(
        { error: 'Missing required field: students (array)' },
        { status: 400 }
      );
    }

    // Perform matching
    const matches = matchFilesToStudents(body.files, body.students);

    // Calculate stats
    const stats = {
      total: matches.length,
      matched: matches.filter((m) => m.matchedStudent !== null).length,
      highConfidence: matches.filter((m) => m.confidence >= 0.8).length,
      mediumConfidence: matches.filter((m) => m.confidence >= 0.5 && m.confidence < 0.8).length,
      unmatched: matches.filter((m) => m.matchedStudent === null).length,
    };

    return NextResponse.json({
      success: true,
      matches,
      stats,
    });
  } catch (error) {
    console.error('Match students API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
