// Entry point — wires modules together and handles settings UI.

import { state, settings, saveAnswerMode, dom, app } from './state.js';
import { SUBCATEGORIES, yearOptions, buildCategoriesPayload } from './categories.js';
import * as tts from './tts.js';
import * as solo from './solo.js';
import * as multi from './multiplayer.js';
import * as ui from './ui.js';

/* ── Filters: populate year dropdowns ── */
for (const y of yearOptions()) {
  const a = document.createElement('option'); a.value = y; a.textContent = y;
  const b = document.createElement('option'); b.value = y; b.textContent = y;
  dom.selYearFrom.appendChild(a);
  dom.selYearTo.appendChild(b);
}

/* ── Filters: subcategory depends on category ── */
function refreshSubcategories() {
  const subs = SUBCATEGORIES[dom.selCategory.value] || [];
  dom.selSubcat.innerHTML = '<option value="">All Topics</option>';
  subs.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    dom.selSubcat.appendChild(opt);
  });
  // Disable when no subcategories available (e.g. "All Categories" or Geography)
  dom.selSubcat.disabled = subs.length === 0;
}
dom.selCategory.addEventListener('change', () => {
  refreshSubcategories();
  pushRoomCategories();
});
refreshSubcategories();

// Push category/difficulty to the multiplayer room (host controls the game).
function pushRoomCategories() {
  if (app.mode !== 'multi' || !multi.isConnected()) return;
  multi.sendSettings(buildCategoriesPayload(dom.selCategory.value, dom.selSubcat.value));
}
function pushRoomDifficulty() {
  if (app.mode !== 'multi' || !multi.isConnected()) return;
  const d = parseInt(dom.selDiff.value, 10);
  multi.sendSettings({ type: 'set-difficulties', difficulties: isNaN(d) ? [] : [d] });
}
dom.selSubcat.addEventListener('change', pushRoomCategories);
dom.selDiff.addEventListener('change', pushRoomDifficulty);

/* ── Filters: keep year range sane (from <= to) ── */
dom.selYearFrom.addEventListener('change', () => {
  const from = parseInt(dom.selYearFrom.value, 10);
  const to   = parseInt(dom.selYearTo.value, 10);
  if (from && to && from > to) dom.selYearTo.value = dom.selYearFrom.value;
});
dom.selYearTo.addEventListener('change', () => {
  const from = parseInt(dom.selYearFrom.value, 10);
  const to   = parseInt(dom.selYearTo.value, 10);
  if (from && to && to < from) dom.selYearFrom.value = dom.selYearTo.value;
});

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

/* ── Mode switching ── */
function setMode(mode) {
  if (app.mode === mode) return;
  // Tearing down the current mode
  if (app.mode === 'multi') multi.leaveRoom();
  else { tts.stopReading(); }

  app.mode = mode;
  dom.tabSolo.classList.toggle('active', mode === 'solo');
  dom.tabMulti.classList.toggle('active', mode === 'multi');

  const isMulti = mode === 'multi';
  dom.roomBar.classList.toggle('hidden', !isMulti);
  // Category/difficulty/topic filters apply to both modes. The year filters
  // are solo-only (multiplayer year range is a separate room setting we skip).
  dom.filtersRow2.classList.toggle('hidden', isMulti);

  // Reset the board
  ui.setPhase('idle');
  ui.hideAll();
  dom.btnBuzz.disabled = true;
  dom.emptyState.classList.remove('hidden');

  if (isMulti) {
    multi.prefillUsername();
    dom.btnSkip.classList.add('hidden');
    dom.btnNew.textContent = 'New Question'; // becomes "Next" once connected
    dom.emptyState.querySelector('p').innerHTML = 'Join a room to play with friends';
  } else {
    dom.btnSkip.classList.remove('hidden');
    dom.btnNew.textContent = 'New Question';
    dom.emptyState.querySelector('p').innerHTML = 'Tap <strong>New Question</strong> to start';
    // Restore full filter control for solo play
    multi.setFilterControlsEnabled(true);
    refreshSubcategories();
  }
}
dom.tabSolo.addEventListener('click', () => setMode('solo'));
dom.tabMulti.addEventListener('click', () => setMode('multi'));

/* ── Room join / leave ── */
dom.btnJoinRoom.addEventListener('click', () => {
  multi.joinRoom(dom.roomNameInput.value, dom.usernameInput.value);
});
dom.roomNameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') multi.joinRoom(dom.roomNameInput.value, dom.usernameInput.value);
});
dom.btnLeaveRoom.addEventListener('click', () => multi.leaveRoom());

// When we connect as host, push our current category & difficulty to the room.
// Non-hosts get their category/difficulty controls disabled.
multi.onReady(() => {
  pushRoomCategories();
  pushRoomDifficulty();
});

/* ── Game controls — routed by mode ── */
dom.btnNew.addEventListener('click', () => {
  if (app.mode === 'multi') multi.next();
  else solo.newQuestion();
});
dom.btnBuzz.addEventListener('click', () => {
  if (app.mode === 'multi') multi.buzz();
  else solo.buzz();
});
dom.btnSkip.addEventListener('click', () => {
  if (app.mode === 'solo') solo.skip();
});
dom.btnCancelMic.addEventListener('click', () => {
  if (app.mode === 'multi') multi.cancelMic();
  else solo.cancelMic();
});
dom.btnSubmit.addEventListener('click', () => submitAnswer(dom.answerInput.value));
dom.answerInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') submitAnswer(dom.answerInput.value);
});
function submitAnswer(val) {
  if (app.mode === 'multi') multi.submitAnswer(val);
  else solo.submitAnswer(val);
}

/* ── Speed slider ── */
dom.speedSlider.addEventListener('input', () => {
  dom.speedLabel.textContent =
    parseFloat(dom.speedSlider.value).toFixed(2).replace(/\.?0+$/, '') + '×';
  // Multiplayer TTS reads word-by-word as they stream; the new rate applies
  // automatically to the next queued word, so nothing to rebuild here.
  if (app.mode === 'multi') return;
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
