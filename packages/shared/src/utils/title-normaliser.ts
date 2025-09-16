const ARTICLES = ['the', 'a', 'an'];
const COMMON_WORDS = [
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
];

export function normaliseTitle(title: string): string {
  if (!title) {
    return '';
  }

  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalise whitespace
    .trim();
}

export function createSearchVariants(title: string): string[] {
  const variants = new Set<string>();
  const normalised = normaliseTitle(title);

  variants.add(normalised);

  // Remove leading articles
  const words = normalised.split(' ');
  if (words.length > 1 && ARTICLES.includes(words[0]!)) {
    variants.add(words.slice(1).join(' '));
  }

  // Add variant with article moved to end
  if (words.length > 1 && ARTICLES.includes(words[0]!)) {
    const withoutArticle = words.slice(1).join(' ');
    variants.add(`${withoutArticle}, ${words[0]}`);
  }

  // Remove common words for broader matching
  const significantWords = words.filter(
    (word) =>
      word.length > 2 &&
      !ARTICLES.includes(word) &&
      !COMMON_WORDS.includes(word)
  );

  if (significantWords.length > 1) {
    variants.add(significantWords.join(' '));
  }

  // Remove year suffixes
  const withoutYear = normalised.replace(/\s+\d{4}$/, '');
  if (withoutYear !== normalised) {
    variants.add(withoutYear);
  }

  // Remove country/language suffixes in parentheses
  const withoutCountry = normalised.replace(/\s+\([^)]*\)$/, '');
  if (withoutCountry !== normalised) {
    variants.add(withoutCountry);
  }

  return Array.from(variants).filter((variant) => variant.length > 0);
}

export function calculateTitleSimilarity(
  title1: string,
  title2: string
): number {
  const norm1 = normaliseTitle(title1);
  const norm2 = normaliseTitle(title2);

  if (norm1 === norm2) {
    return 1.0;
  }

  // Exact match after normalisation gets high score
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return 0.9;
  }

  // Calculate Jaccard similarity on word sets
  const words1 = new Set(norm1.split(' '));
  const words2 = new Set(norm2.split(' '));

  const intersection = new Set([...words1].filter((word) => words2.has(word)));
  const union = new Set([...words1, ...words2]);

  const jaccard = intersection.size / union.size;

  // Boost score for significant word overlap
  const significantWords1 = [...words1].filter((word) => word.length > 2);
  const significantWords2 = [...words2].filter((word) => word.length > 2);

  const significantOverlap = significantWords1.filter((word) =>
    significantWords2.includes(word)
  ).length;

  const significantBoost =
    significantOverlap /
    Math.max(significantWords1.length, significantWords2.length);

  return Math.min(1.0, jaccard + significantBoost * 0.3);
}

export function extractYear(title: string): number | undefined {
  const yearMatch = title.match(/\b(19|20)\d{2}\b/);
  return yearMatch ? parseInt(yearMatch[0], 10) : undefined;
}

export function removeYear(title: string): string {
  return title.replace(/\s*\b(19|20)\d{2}\b\s*/g, ' ').trim();
}
