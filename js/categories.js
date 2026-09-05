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
