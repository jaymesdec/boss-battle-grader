// =============================================================================
// Canvas API Client - LMS Integration with Pagination
// =============================================================================

import type {
  CanvasCourse,
  CanvasAssignment,
  CanvasSubmission,
  ApiResponse,
} from '@/types';

const CANVAS_BASE_URL = process.env.CANVAS_BASE_URL;
const CANVAS_API_TOKEN = process.env.CANVAS_API_TOKEN;

if (!CANVAS_BASE_URL) {
  console.warn('CANVAS_BASE_URL environment variable is not set');
}

if (!CANVAS_API_TOKEN) {
  console.warn('CANVAS_API_TOKEN environment variable is not set');
}

// -----------------------------------------------------------------------------
// Pagination Helper
// -----------------------------------------------------------------------------

interface LinkHeader {
  url: string;
  rel: string;
}

function parseLinkHeader(header: string | null): LinkHeader[] {
  if (!header) return [];

  const links: LinkHeader[] = [];
  const parts = header.split(',');

  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match) {
      links.push({ url: match[1], rel: match[2] });
    }
  }

  return links;
}

function getNextPageUrl(linkHeader: string | null): string | null {
  const links = parseLinkHeader(linkHeader);
  const nextLink = links.find((link) => link.rel === 'next');
  return nextLink?.url ?? null;
}

// -----------------------------------------------------------------------------
// Canvas API Client
// -----------------------------------------------------------------------------

class CanvasClient {
  private baseUrl: string;
  private token: string;

  constructor() {
    this.baseUrl = CANVAS_BASE_URL || '';
    this.token = CANVAS_API_TOKEN || '';
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data: T; linkHeader: string | null }> {
    const url = endpoint.startsWith('http')
      ? endpoint
      : `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Canvas API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const linkHeader = response.headers.get('Link');

    return { data, linkHeader };
  }

  async fetchAllPages<T>(endpoint: string, params: Record<string, string> = {}): Promise<T[]> {
    const allData: T[] = [];
    const queryParams = new URLSearchParams({ per_page: '100', ...params });
    let url: string | null = `${endpoint}?${queryParams}`;

    while (url) {
      const { data, linkHeader } = await this.fetch<T[]>(url);
      allData.push(...data);
      url = getNextPageUrl(linkHeader);
    }

    return allData;
  }

  async get<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const queryParams = new URLSearchParams(params);
    const url = `${endpoint}?${queryParams}`;
    const { data } = await this.fetch<T>(url);
    return data;
  }

  async post<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    const { data } = await this.fetch<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return data;
  }

  async put<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    const { data } = await this.fetch<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    return data;
  }
}

export const canvasClient = new CanvasClient();

// -----------------------------------------------------------------------------
// Canvas API Functions
// -----------------------------------------------------------------------------

export async function fetchCourses(): Promise<ApiResponse<CanvasCourse[]>> {
  try {
    const courses = await canvasClient.fetchAllPages<CanvasCourse>(
      '/api/v1/courses',
      {
        'include[]': 'total_students,teachers,term',
        'state[]': 'available',
        enrollment_type: 'teacher',
      }
    );
    return { success: true, data: courses };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch courses',
    };
  }
}

export async function fetchAssignments(
  courseId: number
): Promise<ApiResponse<CanvasAssignment[]>> {
  try {
    const assignments = await canvasClient.fetchAllPages<CanvasAssignment>(
      `/api/v1/courses/${courseId}/assignments`,
      {
        'include[]': 'submission_summary',
      }
    );
    return { success: true, data: assignments };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch assignments',
    };
  }
}

export async function fetchSubmissions(
  courseId: number,
  assignmentId: number
): Promise<ApiResponse<CanvasSubmission[]>> {
  try {
    const submissions = await canvasClient.fetchAllPages<CanvasSubmission>(
      `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`,
      {
        'include[]': 'user,submission_comments,rubric_assessment',
      }
    );
    return { success: true, data: submissions };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch submissions',
    };
  }
}

export async function postGrade(
  courseId: number,
  assignmentId: number,
  userId: number,
  grade: string,
  rubricAssessment?: Record<string, { points: number; comments?: string }>
): Promise<ApiResponse<CanvasSubmission>> {
  try {
    const body: Record<string, unknown> = {
      submission: {
        posted_grade: grade,
      },
    };

    if (rubricAssessment) {
      body.rubric_assessment = rubricAssessment;
    }

    const submission = await canvasClient.put<CanvasSubmission>(
      `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`,
      body
    );
    return { success: true, data: submission };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to post grade',
    };
  }
}

export async function postComment(
  courseId: number,
  assignmentId: number,
  userId: number,
  commentText: string
): Promise<ApiResponse<CanvasSubmission>> {
  try {
    const submission = await canvasClient.put<CanvasSubmission>(
      `/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`,
      {
        comment: {
          text_comment: commentText,
        },
      }
    );
    return { success: true, data: submission };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to post comment',
    };
  }
}

export async function fetchSubmissionFiles(
  fileUrl: string
): Promise<ApiResponse<ArrayBuffer>> {
  try {
    const response = await fetch(fileUrl, {
      headers: {
        Authorization: `Bearer ${CANVAS_API_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status}`);
    }

    const data = await response.arrayBuffer();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch file',
    };
  }
}
