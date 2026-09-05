// QBReader REST API calls.

const BASE = 'https://www.qbreader.org/api';

/**
 * Fetch a single random tossup with optional filters.
 * @param {object} opts
 * @param {string} [opts.category]     e.g. "History"
 * @param {string} [opts.subcategory]  e.g. "European History"
 * @param {string} [opts.difficulty]   1..10
 * @param {number} [opts.minYear]      earliest set year
 * @param {number} [opts.maxYear]      latest set year
 * @returns {Promise<object|null>} the tossup object, or null if none found
 */
export async function fetchRandomTossup({ category, subcategory, difficulty, minYear, maxYear } = {}) {
  const params = new URLSearchParams({ number: 1 });
  if (category)    params.set('categories', category);
  if (subcategory) params.set('subcategories', subcategory);
  if (difficulty)  params.set('difficulties', difficulty);
  if (minYear)     params.set('minYear', minYear);
  if (maxYear)     params.set('maxYear', maxYear);

  const res = await fetch(`${BASE}/random-tossup?${params}`);
  if (!res.ok) throw new Error(`random-tossup failed: ${res.status}`);
  const data = await res.json();
  return data.tossups?.[0] ?? null;
}

/**
 * Judge an answer against an answerline.
 * @returns {Promise<{directive: 'accept'|'reject'|'prompt', promptString?: string}>}
 */
export async function checkAnswer(answerline, givenAnswer) {
  const params = new URLSearchParams({ answerline, givenAnswer });
  const res = await fetch(`${BASE}/check-answer?${params}`);
  if (!res.ok) throw new Error(`check-answer failed: ${res.status}`);
  return res.json();
}
