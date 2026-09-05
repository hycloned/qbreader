// Shared application state and DOM references.

/* ── Feature detection ── */
export const SpeechRecognitionCtor =
  window.SpeechRecognition || window.webkitSpeechRecognition;
export const hasMic = !!SpeechRecognitionCtor;

/* ── App state ── */
export const state = {
  tossup: null,
  words: [],          // tokenized question (words + whitespace tokens)
  wordIdx: -1,        // index of last-revealed token
  phase: 'idle',      // idle | loading | reading | buzzed | done
  utterance: null,
  synth: window.speechSynthesis,
  score: { correct: 0, total: 0 },
  readingTimer: null,
  buzzWordIdx: 0,
  promptCount: 0,
  micActive: false,
};

/* ── Settings (persisted in localStorage) ── */
export const settings = {
  // 'voice-then-type' = mic first, fall back to typing
  // 'type-only'       = always type (for noisy environments)
  answerMode: localStorage.getItem('answerMode') || 'voice-then-type',
};

export function saveAnswerMode(mode) {
  settings.answerMode = mode;
  localStorage.setItem('answerMode', mode);
}

/* ── DOM refs ── */
const $ = id => document.getElementById(id);

export const dom = {
  qCard:         $('question-card'),
  qText:         $('question-text'),
  emptyState:    $('empty-state'),
  progressBar:   $('progress-bar'),
  progressWrap:  $('progress-bar-wrap'),
  answerReveal:  $('answer-reveal'),
  metaStrip:     $('meta-strip'),
  btnBuzz:       $('btn-buzz'),
  btnSkip:       $('btn-skip'),
  btnNew:        $('btn-new'),
  answerRow:     $('answer-input-row'),
  micStatus:     $('mic-status'),
  micTranscript: $('mic-transcript'),
  btnCancelMic:  $('btn-cancel-mic'),
  fallbackRow:   $('fallback-row'),
  answerInput:   $('answer-input'),
  btnSubmit:     $('btn-submit'),
  resultBanner:  $('result-banner'),
  speedSlider:   $('speed-slider'),
  speedLabel:    $('speed-label'),
  scoreCorrect:  $('score-correct'),
  scoreTotal:    $('score-total'),
  scorePct:      $('score-pct'),
  selCategory:   $('sel-category'),
  selDiff:       $('sel-difficulty'),
  selSubcat:     $('sel-subcategory'),
  selYearFrom:   $('sel-year-from'),
  selYearTo:     $('sel-year-to'),
  selVoice:      $('sel-voice'),
  selAnswerMode: $('sel-answer-mode'),
  btnSettings:   $('btn-settings'),
  settingsDrawer:$('settings-drawer'),
};
