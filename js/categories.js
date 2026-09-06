// QBReader category → subcategory mapping.
// Used to populate the subcategory dropdown based on the selected category.
// Subcategory names must match QBReader's taxonomy exactly.

export const SUBCATEGORIES = {
  'Literature': [
    'American Literature',
    'British Literature',
    'Classical Literature',
    'European Literature',
    'World Literature',
    'Other Literature',
  ],
  'History': [
    'American History',
    'Ancient History',
    'European History',
    'World History',
    'Other History',
  ],
  'Science': [
    'Biology',
    'Chemistry',
    'Physics',
    'Math',
    'Other Science',
  ],
  'Fine Arts': [
    'Visual Fine Arts',
    'Auditory Fine Arts',
    'Other Fine Arts',
  ],
  'Religion':        [],
  'Mythology':       [],
  'Philosophy':      [],
  'Social Science':  [],
  'Current Events':  [],
  'Geography':       [],
  'Other Academic':  [],
  'Trash':           [],
};

/** All set years descending — QBReader has sets from 2000 to the current year. */
export function yearOptions() {
  const current = new Date().getFullYear();
  const years = [];
  for (let y = current; y >= 2000; y--) years.push(y);
  return years;
}

// ── Multiplayer: official QBReader category taxonomy ──
// The order MUST match the server's CATEGORIES array exactly, because the
// server validates that categoryPercents.length === CATEGORIES.length.
export const MP_CATEGORIES = [
  'Literature',
  'History',
  'Science',
  'Fine Arts',
  'Religion',
  'Mythology',
  'Philosophy',
  'Social Science',
  'Current Events',
  'Geography',
  'Other Academic',
  'Pop Culture',
];

// Regular subcategories per category (matches server CATEGORY_TO_SUBCATEGORY).
export const MP_SUBCATEGORIES = {
  'Literature':      ['American Literature', 'British Literature', 'Classical Literature', 'European Literature', 'World Literature', 'Other Literature'],
  'History':         ['American History', 'Ancient History', 'European History', 'World History', 'Other History'],
  'Science':         ['Biology', 'Chemistry', 'Physics', 'Other Science'],
  'Fine Arts':       ['Visual Fine Arts', 'Auditory Fine Arts', 'Other Fine Arts'],
  'Religion':        [],
  'Mythology':       [],
  'Philosophy':      [],
  'Social Science':  [],
  'Current Events':  [],
  'Geography':       [],
  'Other Academic':  [],
  'Pop Culture':     ['Movies', 'Music', 'Sports', 'Television', 'Video Games', 'Other Pop Culture'],
};

/**
 * Build a valid `set-categories` payload for the multiplayer server.
 * @param {string} category     one category name, or '' for all
 * @param {string} subcategory  one subcategory name, or '' for all in category
 */
export function buildCategoriesPayload(category, subcategory) {
  const categories = category ? [category] : [];
  const subcategories = subcategory ? [subcategory] : [];
  return {
    type: 'set-categories',
    categories,
    subcategories,
    alternateSubcategories: [],
    percentView: false,
    categoryPercents: MP_CATEGORIES.map(() => 0), // length must equal CATEGORIES.length
  };
}
