// =============================================================================
// Student Name Matching - Fuzzy matching for batch PDF uploads
// =============================================================================

// -----------------------------------------------------------------------------
// Levenshtein Distance
// -----------------------------------------------------------------------------

export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  // Create a matrix of distances
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill in the rest of the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }

  return dp[m][n];
}

// -----------------------------------------------------------------------------
// Similarity Score (0-1, where 1 = identical)
// -----------------------------------------------------------------------------

export function calculateSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  return 1 - (distance / maxLen);
}

// -----------------------------------------------------------------------------
// Filename Normalization
// -----------------------------------------------------------------------------

const SUFFIXES_TO_REMOVE = [
  '_submission', '_final', '_draft',
  '_v1', '_v2', '_v3',
  '-submission', '-final', '-draft',
  '(1)', '(2)', '(3)',
  '_copy', '-copy', 'copy of',
];

export function normalizeFilename(filename: string): string {
  // Remove file extension
  let normalized = filename.replace(/\.pdf$/i, '');

  // Remove common suffixes
  for (const suffix of SUFFIXES_TO_REMOVE) {
    normalized = normalized.replace(new RegExp(suffix, 'gi'), '');
  }

  // Convert underscores, hyphens, dots to spaces
  normalized = normalized.replace(/[_\-\.]+/g, ' ');

  // Remove extra whitespace and trim
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // Lowercase for comparison
  return normalized.toLowerCase();
}

// -----------------------------------------------------------------------------
// Name Variants Generation
// -----------------------------------------------------------------------------

export function getNameVariants(name: string, sortableName?: string): string[] {
  const variants: Set<string> = new Set();
  const lowerName = name.toLowerCase().trim();

  // Full name as-is
  variants.add(lowerName);

  // Sortable name (e.g., "Smith, John")
  if (sortableName) {
    variants.add(sortableName.toLowerCase().trim());
    // Also without comma
    variants.add(sortableName.toLowerCase().replace(',', '').trim());
  }

  // Split into parts
  const parts = lowerName.split(/\s+/);

  if (parts.length >= 2) {
    const firstName = parts[0];
    const lastName = parts[parts.length - 1];

    // First name only
    variants.add(firstName);

    // Last name only
    variants.add(lastName);

    // Reversed (last first)
    variants.add(`${lastName} ${firstName}`);

    // With comma
    variants.add(`${lastName}, ${firstName}`);

    // First + last initial
    variants.add(`${firstName} ${lastName[0]}`);

    // First initial + last
    variants.add(`${firstName[0]} ${lastName}`);

    // Just initials
    variants.add(`${firstName[0]}${lastName[0]}`);
  }

  return Array.from(variants);
}

// -----------------------------------------------------------------------------
// Match Score Calculation
// -----------------------------------------------------------------------------

export interface StudentInfo {
  id: number;
  name: string;
  sortableName?: string;
}

export interface MatchResult {
  student: StudentInfo;
  score: number;
  matchedVariant: string;
}

export function calculateMatchScore(
  normalizedFilename: string,
  student: StudentInfo
): MatchResult | null {
  const variants = getNameVariants(student.name, student.sortableName);

  let bestScore = 0;
  let bestVariant = '';

  for (const variant of variants) {
    let score = 0;

    // Check if filename starts with the variant (strongest signal)
    if (normalizedFilename.startsWith(variant)) {
      score = 0.9;
    }
    // Check if filename contains the variant
    else if (normalizedFilename.includes(variant)) {
      const lengthRatio = variant.length / normalizedFilename.length;
      score = 0.7 + (lengthRatio * 0.3);
    }
    // Fall back to Levenshtein similarity
    else {
      score = calculateSimilarity(normalizedFilename, variant);
    }

    if (score > bestScore) {
      bestScore = score;
      bestVariant = variant;
    }
  }

  if (bestScore > 0) {
    return {
      student,
      score: bestScore,
      matchedVariant: bestVariant,
    };
  }

  return null;
}

// -----------------------------------------------------------------------------
// Batch Matching
// -----------------------------------------------------------------------------

export interface FileMatch {
  fileId: string;
  filename: string;
  normalizedName: string;
  matchedStudent: StudentInfo | null;
  confidence: number;
  alternatives: MatchResult[];
}

export function matchFilesToStudents(
  files: Array<{ id: string; name: string }>,
  students: StudentInfo[]
): FileMatch[] {
  const results: FileMatch[] = [];

  for (const file of files) {
    const normalizedName = normalizeFilename(file.name);

    // Calculate scores for all students
    const scores: MatchResult[] = [];
    for (const student of students) {
      const result = calculateMatchScore(normalizedName, student);
      if (result) {
        scores.push(result);
      }
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Get top match if above threshold
    const topMatch = scores[0];
    const matchThreshold = 0.5;

    if (topMatch && topMatch.score >= matchThreshold) {
      results.push({
        fileId: file.id,
        filename: file.name,
        normalizedName,
        matchedStudent: topMatch.student,
        confidence: topMatch.score,
        alternatives: scores.slice(1, 5), // Top 4 alternatives
      });
    } else {
      results.push({
        fileId: file.id,
        filename: file.name,
        normalizedName,
        matchedStudent: null,
        confidence: 0,
        alternatives: scores.slice(0, 4), // Top 4 suggestions
      });
    }
  }

  return results;
}

// -----------------------------------------------------------------------------
// Confidence Badge Helper
// -----------------------------------------------------------------------------

export function getConfidenceBadge(confidence: number): {
  text: string;
  color: 'green' | 'yellow' | 'red';
} {
  if (confidence >= 0.8) return { text: 'High', color: 'green' };
  if (confidence >= 0.5) return { text: 'Medium', color: 'yellow' };
  return { text: 'Low', color: 'red' };
}
