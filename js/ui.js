// DOM rendering helpers. Pure view layer — no game logic.

import { state, dom } from './state.js';

/* ── Text helpers ── */
export function cleanQuestion(text) {
  return text.replace(/\(\*\)\s*/g, '').trim();
}
export function tokenize(text) {
  return text.split(/(\s+)/).filter(Boolean);
}

/* ── Phase / card border ── */
export function setPhase(p) {
  state.phase = p;
  dom.qCard.className = (p === 'idle' || p === 'loading') ? '' : p;
}

/* ── Score ── */
export function updateScore(result) {
  state.score.total++;
  if (result === 'correct') state.score.correct++;
  dom.scoreTotal.textContent   = state.score.total;
  dom.scoreCorrect.textContent = state.score.correct;
  dom.scorePct.textContent = state.score.total > 0
    ? Math.round((state.score.correct / state.score.total) * 100) + '%' : '—';
}

/* ── Meta badges ── */
function difficultyLabel(d) {
  const m = { 1:'MS',2:'Easy HS',3:'Easy HS',4:'HS',5:'Reg HS',
              6:'Hard HS',7:'Easy Coll',8:'Coll',9:'Hard Coll',10:'Open' };
  return m[d] ? `Diff ${d} · ${m[d]}` : `Diff ${d}`;
}

export function renderMeta(t) {
  dom.metaStrip.innerHTML = '';
  if (!t) return;
  [{ text: t.category, cls: 'cat' },
   { text: t.subcategory, cls: 'cat' },
   { text: difficultyLabel(t.difficulty), cls: 'diff' },
   { text: t.set?.name, cls: 'set' }]
  .filter(b => b.text).forEach(b => {
    const el = document.createElement('span');
    el.className = `badge ${b.cls}`;
    el.textContent = b.text;
    dom.metaStrip.appendChild(el);
  });
}

/* ── Question words — only reveal up to `upTo` (word-by-word) ── */
export function renderQuestionWords(upTo) {
  dom.qText.innerHTML = state.words.map((w, i) => {
    if (/^\s+$/.test(w)) return i <= upTo ? w : '';
    if (i < upTo)   return `<span class="word">${w}</span>`;
    if (i === upTo) return `<span class="word spoken">${w}</span>`;
    return '';
  }).join('');
  const el = dom.qText.querySelector('.spoken');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export function revealFullQuestion() {
  renderQuestionWords(state.words.length - 1);
  dom.progressBar.style.width = '100%';
}

/* ── Progress bar ── */
export function updateProgress(wordIdx) {
  let spoken = 0, total = 0;
  for (let i = 0; i < state.words.length; i++) {
    if (/^\s+$/.test(state.words[i])) continue;
    total++;
    if (i <= wordIdx) spoken++;
  }
  dom.progressBar.style.width = total > 0
    ? Math.min(100, Math.round((spoken / total) * 100)) + '%' : '0%';
}

/* ── Result banner ── */
export function showBanner(cls, text, html) {
  dom.resultBanner.className = cls;
  dom.resultBanner.style.display = 'block';
  if (html) dom.resultBanner.innerHTML = html;
  else dom.resultBanner.textContent = text;
}
export function hideBanner() {
  dom.resultBanner.style.display = 'none';
}

/* ── Answer reveal ── */
export function revealAnswer(result, reason) {
  const t = state.tossup;
  if (!t) return;
  const clean = t.answer_sanitized.replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trim();
  dom.answerReveal.style.display = 'block';
  dom.answerReveal.className = result || '';
  dom.answerReveal.innerHTML = `
    <div class="label">${reason === 'done' ? "Time's up — Answer" : 'Answer'}</div>
    <div class="answer-text">${clean}</div>`;
}

/* ── Buzz / answer input UI ── */
export function showMicUI() {
  dom.answerRow.style.display = 'flex';
  dom.micStatus.style.display = 'flex';
  dom.micTranscript.textContent = '';
  dom.btnCancelMic.style.display = 'block';
  dom.fallbackRow.style.display = 'none';
}
export function showTypeUI() {
  dom.answerRow.style.display = 'flex';
  dom.micStatus.style.display = 'none';
  dom.btnCancelMic.style.display = 'none';
  dom.fallbackRow.style.display = 'flex';
  dom.answerInput.value = '';
  dom.answerInput.focus();
}
export function setTranscript(text) {
  dom.micTranscript.textContent = text;
}
export function hideBuzzUI() {
  dom.answerRow.style.display = 'none';
  dom.micStatus.style.display = 'none';
  dom.btnCancelMic.style.display = 'none';
  dom.fallbackRow.style.display = 'none';
  dom.micTranscript.textContent = '';
}

/* ── Whole-view reset for a fresh question ── */
export function hideAll() {
  dom.emptyState.classList.add('hidden');
  dom.qText.classList.add('hidden');
  dom.progressWrap.classList.add('hidden');
  dom.answerReveal.style.display = 'none';
  hideBuzzUI();
  hideBanner();
  dom.metaStrip.innerHTML = '';
}

export function showQuestionUI() {
  dom.emptyState.classList.add('hidden');
  dom.qText.classList.remove('hidden');
  dom.progressWrap.classList.remove('hidden');
  dom.progressBar.style.width = '0%';
  dom.answerReveal.style.display = 'none';
  dom.answerReveal.className = '';
}

export function showError(msg) {
  dom.qText.innerHTML = `<span style="color:var(--red)">${msg}</span>`;
  dom.qText.classList.remove('hidden');
}
