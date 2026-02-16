// Lightweight fuzzy matching helper used across the frontend.
// It supports: case-insensitive substring, simple subsequence match (characters in order),
// and a small edit-distance tolerance for short typos using Levenshtein distance.

function normalize(s) {
  return (s || '').toString().toLowerCase().trim();
}

function levenshtein(a, b) {
  // simple iterative DP Levenshtein
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

function isSubsequence(query, target) {
  // returns true if all chars in query appear in order inside target
  if (!query) return true;
  let i = 0, j = 0;
  while (i < query.length && j < target.length) {
    if (query[i] === target[j]) i++;
    j++;
  }
  return i === query.length;
}

export function matchesFuzzy(target, rawQuery) {
  const q = normalize(rawQuery);
  const t = normalize(target);
  if (!q) return true;
  if (!t) return false;

  // fast path: substring
  if (t.includes(q)) return true;

  // tokenized: all query tokens must match somewhere in target (subsequence or fuzzy)
  const tokens = q.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (t.includes(token)) continue;
    // subsequence check (handles characters out-of-order slightly)
    if (isSubsequence(token, t)) continue;
    // fuzzy by word: split target into words and allow small edit distance
    const words = t.split(/[^a-z0-9]+/).filter(Boolean);
    const matched = words.some(w => {
      // threshold: small absolute or proportional threshold
      const thresh = Math.max(1, Math.floor(Math.min(w.length, token.length) * 0.34));
      return levenshtein(token, w) <= thresh;
    });
    if (matched) continue;
    // token failed to match any strategy => overall no match
    return false;
  }

  return true;
}

export default { matchesFuzzy };
