// Single-player game loop.
// Ties together API, TTS, recognition, and UI. Respects the
// answerMode setting: 'voice-then-type' (mic first) or 'type-only'.

import { state, settings, hasMic, dom } from './state.js';
import { fetchRandomTossup, checkAnswer } from './api.js';
import * as tts from './tts.js';
import { startMic, stopMic } from './recognition.js';
import * as ui from './ui.js';

/* ── Load a new question and start reading ── */
export async function newQuestion() {
  tts.stopReading();
  stopMic();
  tts.unlockAudio(); // iOS: prime audio synchronously before await

  ui.setPhase('loading');
  dom.btnNew.disabled = true;
  dom.btnNew.innerHTML = '<span class="spinner"></span>Loading…';
  dom.btnBuzz.disabled = true;
  dom.btnSkip.disabled = true;
  ui.hideAll();

  try {
    const tossup = await fetchRandomTossup({
      category:    dom.selCategory.value,
      subcategory: dom.selSubcat.value,
      difficulty:  dom.selDiff.value,
      minYear:     dom.selYearFrom.value,
      maxYear:     dom.selYearTo.value,
    });
    if (!tossup) throw new Error('no tossup');

    state.tossup = tossup;
    state.promptCount = 0;
    state.words = ui.tokenize(ui.cleanQuestion(tossup.question_sanitized));
    state.wordIdx = -1;

    ui.renderMeta(tossup);
    ui.showQuestionUI();
    ui.renderQuestionWords(-1);

    dom.btnNew.disabled = false;
    dom.btnNew.textContent = 'New Question';
    dom.btnSkip.disabled = false;

    startReading();
  } catch {
    dom.btnNew.disabled = false;
    dom.btnNew.textContent = 'New Question';
    dom.btnSkip.disabled = false;
    ui.showError('Error loading. Check connection and try again.');
    ui.setPhase('idle');
  }
}

function startReading() {
  ui.setPhase('reading');
  dom.btnBuzz.disabled = false;
  tts.startReading({
    onWord: (idx) => { ui.renderQuestionWords(idx); ui.updateProgress(idx); },
    onDone: () => {
      ui.setPhase('done');
      dom.btnBuzz.disabled = true;
      ui.revealAnswer(null, 'done');
    },
  });
}

/* ── Buzz ── */
export function buzz() {
  if (state.phase !== 'reading') return;
  tts.pauseReading();
  state.buzzWordIdx = state.wordIdx;
  ui.setPhase('buzzed');
  dom.btnBuzz.disabled = true;
  openAnswerInput();
}

// Open mic or type input depending on the answer mode setting.
function openAnswerInput() {
  const useMic = hasMic && settings.answerMode === 'voice-then-type';
  if (useMic) {
    ui.showMicUI();
    listenViaMic();
  } else {
    ui.showTypeUI();
  }
}

function listenViaMic() {
  startMic({
    onTranscript: (text, isFinal) => {
      ui.setTranscript(text);
      if (isFinal) { stopMic(); submitAnswer(text.trim()); }
    },
    onFail: (reason) => {
      if (reason === 'denied') {
        ui.showTypeUI();
        ui.showBanner('prompt', 'Mic access denied. Type your answer below.');
      } else if (reason === 'no-speech') {
        ui.setTranscript('No speech detected.');
        setTimeout(ui.showTypeUI, 800);
      } else {
        setTimeout(ui.showTypeUI, 800);
      }
    },
  });
}

/* ── Submit + judge answer ── */
export async function submitAnswer(given) {
  given = (given || dom.answerInput.value || '').trim();
  if (!given) return;

  ui.hideBuzzUI();
  ui.showBanner('prompt', null, `<span class="spinner"></span> Checking: "<em>${given}</em>"`);

  try {
    const { directive, promptString } = await checkAnswer(state.tossup.answer_sanitized, given);
    if (directive === 'accept') {
      finish('correct', given);
    } else if (directive === 'prompt') {
      state.promptCount++;
      if (state.promptCount >= 3) { finish('wrong', given); return; }
      ui.showBanner('prompt', `↩ PROMPT: ${promptString || 'Can you be more specific?'}`);
      openAnswerInput();
    } else {
      finish('wrong', given);
    }
  } catch {
    ui.showBanner('prompt', '⚠ Network error. Try again.');
    openAnswerInput();
  }
}

function finish(result, given) {
  tts.stopReading();
  stopMic();
  ui.setPhase('done');
  ui.hideBuzzUI();
  dom.btnBuzz.disabled = true;
  ui.updateScore(result === 'correct' ? 'correct' : 'wrong');
  ui.showBanner(result,
    result === 'correct' ? `✓ CORRECT — "${given}"` : `✗ WRONG — you said: "${given}"`);
  ui.revealAnswer(result, 'answered');
  ui.revealFullQuestion();
}

/* ── Skip / reveal ── */
export function skip() {
  if (state.phase === 'idle' || state.phase === 'loading') return;
  tts.stopReading();
  stopMic();
  if (state.phase === 'reading' || state.phase === 'buzzed') {
    if (state.phase === 'buzzed') ui.updateScore('wrong');
    ui.setPhase('done');
    ui.hideBuzzUI();
    dom.btnBuzz.disabled = true;
    ui.hideBanner();
    ui.revealAnswer(null, 'done');
    ui.revealFullQuestion();
  }
}

/* ── Cancel mic → switch to typing ── */
export function cancelMic() {
  stopMic();
  ui.showTypeUI();
}
