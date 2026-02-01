// =============================================================================
// Privacy Module - Student Name Anonymization for LLM Calls
// =============================================================================
// CRITICAL: Student names must NEVER be sent to the LLM.
// This module handles anonymization before LLM calls and de-anonymization after.

export interface StudentIdentity {
  firstName: string;
  lastName: string;
  fullName: string;
  sortableName: string; // "Last, First" format
}

const PLACEHOLDER = '[STUDENT]';

/**
 * Extract student identity components from a display name.
 * Handles both "First Last" and "Last, First" formats.
 */
export function extractStudentIdentity(studentName: string): StudentIdentity {
  if (!studentName || studentName.trim() === '') {
    return {
      firstName: '',
      lastName: '',
      fullName: '',
      sortableName: '',
    };
  }

  const trimmed = studentName.trim();
  let firstName: string;
  let lastName: string;

  // Check if it's in "Last, First" format
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',').map((p) => p.trim());
    lastName = parts[0] || '';
    firstName = parts[1] || '';
  } else {
    // Assume "First Last" or "First Middle Last" format
    const parts = trimmed.split(/\s+/);
    firstName = parts[0] || '';
    lastName = parts.length > 1 ? parts[parts.length - 1] : '';
  }

  return {
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    sortableName: lastName && firstName ? `${lastName}, ${firstName}` : trimmed,
  };
}

/**
 * Create a regex pattern that matches a name (case-insensitive, word boundaries).
 */
function createNamePattern(name: string): RegExp | null {
  if (!name || name.length < 2) return null;
  // Escape special regex characters
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match word boundaries, case-insensitive
  return new RegExp(`\\b${escaped}\\b`, 'gi');
}

/**
 * Anonymize text by replacing all occurrences of student name with [STUDENT].
 * Replaces: first name, last name, full name, and sortable name.
 */
export function anonymizeText(text: string, identity: StudentIdentity): string {
  if (!text) return text;

  let result = text;

  // Order matters: replace longer strings first to avoid partial replacements
  const namesToReplace = [
    identity.fullName,
    identity.sortableName,
    identity.lastName,
    identity.firstName,
  ].filter((name) => name && name.length >= 2);

  // Sort by length descending to replace longer names first
  namesToReplace.sort((a, b) => b.length - a.length);

  for (const name of namesToReplace) {
    const pattern = createNamePattern(name);
    if (pattern) {
      result = result.replace(pattern, PLACEHOLDER);
    }
  }

  return result;
}

/**
 * De-anonymize text by replacing [STUDENT] with the student's first name.
 * Uses first name for natural-sounding feedback.
 */
export function deanonymizeText(text: string, identity: StudentIdentity): string {
  if (!text) return text;

  // We don't actually want to put names back in the feedback
  // The AI should never use [STUDENT] in output since we told it not to use names
  // But if it does slip through, we'll leave it as-is rather than adding names
  // This is a safety measure - we'd rather have [STUDENT] visible than leak a name

  // Check if there are any [STUDENT] artifacts that shouldn't be there
  if (text.includes(PLACEHOLDER)) {
    console.warn('Warning: [STUDENT] placeholder found in AI response. This should not happen.');
    // Remove the placeholder entirely rather than replacing with name
    return text.replace(/\[STUDENT\]/g, '').replace(/\s+/g, ' ').trim();
  }

  return text;
}

/**
 * Anonymize all text fields in an object recursively.
 */
export function anonymizeObject<T>(obj: T, identity: StudentIdentity): T {
  if (!obj || typeof obj !== 'object') {
    if (typeof obj === 'string') {
      return anonymizeText(obj, identity) as T;
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => anonymizeObject(item, identity)) as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = anonymizeObject(value, identity);
  }
  return result as T;
}

/**
 * De-anonymize all text fields in an object recursively.
 */
export function deanonymizeObject<T>(obj: T, identity: StudentIdentity): T {
  if (!obj || typeof obj !== 'object') {
    if (typeof obj === 'string') {
      return deanonymizeText(obj, identity) as T;
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deanonymizeObject(item, identity)) as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = deanonymizeObject(value, identity);
  }
  return result as T;
}

/**
 * Strip HTML tags from text for cleaner LLM input.
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
