/**
 * Pure helpers for normalizing and comparing participant identities.
 * Used for roster matching and mapping keys.
 */

/** Removes diacritics: 'José' → 'Jose'. */
export function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/**
 * Canonical display-name form: lowercase, accent-free, punctuation removed,
 * whitespace collapsed. Used for fuzzy matching and mapping keys.
 */
export function normalizeName(name: string): string {
  return stripAccents(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Canonical email form: trimmed and lowercased. */
export function normalizeEmail(email: string): string {
  return stripAccents(email).trim().toLowerCase();
}

export function localPartOfEmail(email: string): string {
  return normalizeEmail(email).split('@')[0] ?? '';
}

function jaro(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0;

  const matchWindow = Math.max(0, Math.floor(Math.max(len1, len2) / 2) - 1);
  const s1Matches = new Array<boolean>(len1).fill(false);
  const s2Matches = new Array<boolean>(len2).fill(false);
  let matches = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1.charAt(i) !== s2.charAt(j)) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (k < len2 && !s2Matches[k]) k++;
    if (k < len2 && s1.charAt(i) !== s2.charAt(k)) transpositions++;
    k++;
  }
  transpositions /= 2;

  return (matches / len1 + matches / len2 + (matches - transpositions) / matches) / 3;
}

/** Jaro-Winkler similarity in [0, 1]. */
export function jaroWinkler(a: string, b: string): number {
  const base = jaro(a, b);
  if (base === 0) return 0;
  let prefix = 0;
  const max = Math.min(4, a.length, b.length);
  while (prefix < max && a.charAt(prefix) === b.charAt(prefix)) prefix++;
  return base + prefix * 0.1 * (1 - base);
}

function reorderTokens(name: string): string {
  const tokens = name.split(' ').filter(Boolean);
  if (tokens.length < 2) return name;
  return `${tokens.slice(1).join(' ')} ${tokens[0]}`;
}

/**
 * Similarity between two display names, tolerant of case, accents,
 * punctuation, and "Last, First" ordering. Returns a score in [0, 1].
 */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return 1;
  if (na.length === 0 || nb.length === 0) return 0;

  // normalizeName strips commas, so "Smith, Jon" and "Smith Jon" are the same
  // string; comparing against reordered tokens handles "Last First" ordering.
  let best = jaroWinkler(na, nb);
  const reordered = reorderTokens(nb);
  if (reordered !== nb) {
    best = Math.max(best, jaroWinkler(na, reordered));
  }
  return best;
}
