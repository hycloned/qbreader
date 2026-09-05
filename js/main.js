// Entry point — wires modules together and handles settings UI.

import { state, settings, saveAnswerMode, dom } from './state.js';
import * as tts from './tts.js';
import * as solo from './solo.js';
import * as ui from './ui.js';

/* ── Voices ── */
tts.populateVoices();
state.synth.onvoiceschanged = tts.populateVoices;
dom.selVoice.addEventListener('change', () => {
  tts.selectVoice(parseInt(dom.selVoice.value, 10));
});

/* ── Answer mode setting ── */
dom.selAnswerMode.value = settings.answerMode;
dom.selAnswerMode.addEventListener('change', () => {
  saveAnswerMode(dom.selAnswerMode.value);
});

/* ── Settings drawer toggle ── */
dom.btnSettings.addEventListener('click', () => {
  const open = dom.settingsDrawer.classList.toggle('open');
  dom.btnSettings.classList.toggle('open', open);
});

/* ── Game controls ── */
dom.btnNew.addEventListener('click', solo.newQuestion);
dom.btnBuzz.addEventListener('click', solo.buzz);
dom.btnSkip.addEventListener('click', solo.skip);
dom.btnCancelMic.addEventListener('click', solo.cancelMic);
dom.btnSubmit.addEventListener('click', () => solo.submitAnswer(dom.answerInput.value));
dom.answerInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') solo.submitAnswer(dom.answerInput.value);
});

/* ── Speed slider ── */
dom.speedSlider.addEventListener('input', () => {
  dom.speedLabel.textContent =
    parseFloat(dom.speedSlider.value).toFixed(2).replace(/\.?0+$/, '') + '×';
  if (state.phase !== 'reading') return;
  tts.changeSpeedWhileReading({
    onWord: (idx) => { ui.renderQuestionWords(idx); ui.updateProgress(idx); },
    onDone: () => {
      ui.setPhase('done');
      dom.btnBuzz.disabled = true;
      ui.revealAnswer(null, 'done');
    },
  });
});

/* ── Pause/resume TTS when app is backgrounded ── */
document.addEventListener('visibilitychange', () => {
  if (state.phase !== 'reading') return;
  if (document.hidden) tts.pauseReading();
  else tts.resumeReading();
});

/* ── iOS: keep speechSynthesis alive ── */
setInterval(() => {
  if (tts.isSpeaking() && state.phase === 'reading') tts.resumeReading();
}, 10000);
