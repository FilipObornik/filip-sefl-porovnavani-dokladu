/**
 * Compute the Levenshtein (edit) distance between two strings.
 * Standard dynamic-programming approach, O(n*m) time and O(min(n,m)) space.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Ensure a is the shorter string for space optimization
  if (a.length > b.length) {
    [a, b] = [b, a];
  }

  const aLen = a.length;
  const bLen = b.length;

  // Single row DP
  let prev = new Array<number>(aLen + 1);
  let curr = new Array<number>(aLen + 1);

  for (let i = 0; i <= aLen; i++) {
    prev[i] = i;
  }

  for (let j = 1; j <= bLen; j++) {
    curr[0] = j;
    for (let i = 1; i <= aLen; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        curr[i - 1] + 1,       // insertion
        prev[i] + 1,           // deletion
        prev[i - 1] + cost     // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[aLen];
}

/**
 * Compute the similarity ratio between two strings based on Levenshtein distance.
 * Returns a value between 0 (completely different) and 1 (identical).
 */
export function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1; // both empty strings are identical
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}
