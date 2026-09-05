// QBReader REST API calls.

const BASE = 'https://www.qbreader.org/api';

/**
 * Fetch a single random tossup, optionally filtered by category/difficulty.
 * @returns {Promise<object|null>} the tossup object, or null if none found
 */
export async function fetchRandomTossup({ category, difficulty } = {}) {
  const params = new URLSearchParams({ number: 1 });
  if (category)   params.set('categories', category);
  if (difficulty) params.set('difficulties', difficulty);

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
