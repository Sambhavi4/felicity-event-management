// Lightweight fuzzy matching helper used across the frontend.
// Strategies: substring → word-prefix → tight subsequence → Levenshtein typo tolerance.

function normalize(s) {
  return (s || '').toString().toLowerCase().trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const v0 = new Array(n + 1).fill(0);
  const v1 = new Array(n + 1).fill(0);
  for (let j = 0; j <= n; j++) v0[j] = j;
  for (let i = 0; i < m; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < n; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= n; j++) v0[j] = v1[j];
  }
  return v1[n];
}

/**
 * Tight subsequence: all query chars must appear in order in the target,
 * AND the matched span must not be excessively larger than the query.
 * This avoids "ev" matching "every big competition" loosely.
 */
function tightSubsequence(query, target) {
  if (!query) return true;
  let qi = 0;
  let firstMatch = -1;
  let lastMatch = -1;
  for (let ti = 0; ti < target.length && qi < query.length; ti++) {
    if (query[qi] === target[ti]) {
      if (firstMatch === -1) firstMatch = ti;
      lastMatch = ti;
      qi++;
    }
  }
  if (qi < query.length) return false;
  // The span of matched characters should be at most 2x the query length
  const span = lastMatch - firstMatch + 1;
  return span <= query.length * 2;
}

export function matchesFuzzy(target, rawQuery) {
  const q = normalize(rawQuery);
  const t = normalize(target);
  if (!q) return true;
  if (!t) return false;

  // Fast path: full substring match
  if (t.includes(q)) return true;

  // Tokenized: ALL query tokens must match somewhere in the target
  const tokens = q.split(/\s+/).filter(Boolean);
  const words = t.split(/[^a-z0-9@._]+/).filter(Boolean);

  for (const token of tokens) {
    // 1. Substring in full target
    if (t.includes(token)) continue;

    // 2. Word-prefix: token matches the start of any word in target
    if (words.some(w => w.startsWith(token))) continue;

    // 3. Tight subsequence (characters in order, close together)
    if (token.length >= 3 && tightSubsequence(token, t)) continue;

    // 4. Levenshtein: allow small typos against individual words
    const matched = words.some(w => {
      // Only compare if lengths are somewhat similar
      if (Math.abs(w.length - token.length) > 2) return false;
      // Threshold: 1 edit for words up to 5 chars, 2 edits for longer
      const thresh = token.length <= 5 ? 1 : 2;
      return levenshtein(token, w) <= thresh;
    });
    if (matched) continue;

    // Token failed all strategies
    return false;
  }

  return true;
}

export default { matchesFuzzy };
