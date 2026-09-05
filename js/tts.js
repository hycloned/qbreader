// Web Speech TTS engine + voice selection.
// Reads a tokenized question word by word, invoking callbacks for
// word-highlight ticks and completion. Keeps the game loop decoupled.

import { state, dom } from './state.js';

let wsVoices = [];
let chosenVoice = null;
let ttsChunks = [];

/* ── Voice scoring — Samantha ranked highest ── */
function scoreVoice(v) {
  if (!v.lang.startsWith('en')) return -1;
  let s = 0;
  const n = v.name.toLowerCase();
  if (n.includes('samantha')) s += 100; // best default on iOS
  if (n.includes('premium'))  s += 90;
  if (n.includes('enhanced')) s += 85;
  if (n.includes('neural'))   s += 85;
  if (n.includes('wavenet'))  s += 85;
  if (n.includes('siri'))     s += 80;
  if (n.includes('daniel'))   s += 60;
  if (n.includes('karen'))    s += 60;
  if (n.includes('google'))   s += 50;
  if (n.includes('microsoft'))s += 45;
  if (n.includes('compact'))  s -= 30;
  if (v.lang === 'en-US')     s += 10;
  else if (v.lang === 'en-GB')s += 5;
  return s;
}

/** Populate the voice <select> and auto-pick the best voice. */
export function populateVoices() {
  wsVoices = state.synth.getVoices().filter(v => v.lang.startsWith('en'));
  if (!wsVoices.length) return;
  wsVoices.sort((a, b) => scoreVoice(b) - scoreVoice(a));

  dom.selVoice.innerHTML = '';
  wsVoices.forEach((v, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    const score = scoreVoice(v);
    const tier  = score >= 80 ? '★★★ ' : score >= 50 ? '★★ ' : score >= 20 ? '★ ' : '';
    opt.textContent = `${tier}${v.name} (${v.lang})`;
    dom.selVoice.appendChild(opt);
  });

  chosenVoice = wsVoices[0];
  dom.selVoice.value = '0';
}

export function selectVoice(index) {
  chosenVoice = wsVoices[index] || null;
}

/** iOS unlock: fire a silent utterance synchronously on a user gesture. */
export function unlockAudio() {
  const u = new SpeechSynthesisUtterance('');
  u.volume = 0;
  state.synth.speak(u);
}

export function getRate() {
  return parseFloat(dom.speedSlider.value);
}

/* ── Chunking — split only on sentence-ending punctuation ── */
function pauseAfter(w) {
  if (/[.!?]$/.test(w)) return 250;
  if (/[;:]$/.test(w))  return 140;
  if (/,$/.test(w))     return 80;
  return 40;
}

function buildChunks(words) {
  const chunks = [];
  let buf = [];
  const flush = () => {
    if (!buf.length) return;
    const last = buf[buf.length - 1].word;
    chunks.push({
      words: [...buf],
      startIdx: buf[0].idx,
      endIdx: buf[buf.length - 1].idx,
      pause: pauseAfter(last),
    });
    buf = [];
  };
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (/^\s+$/.test(w)) continue;
    buf.push({ word: w, idx: i });
    if (/[.!?]$/.test(w) || buf.length >= 25) flush();
  }
  flush();
  return chunks;
}

/**
 * Start reading the question aloud.
 * @param {object} cb
 * @param {(wordIdx:number)=>void} cb.onWord  called as each word is spoken
 * @param {()=>void} cb.onDone                called when whole question finishes
 */
export function startReading({ onWord, onDone }) {
  state.synth.cancel();
  clearTimeout(state.readingTimer);
  ttsChunks = buildChunks(state.words);
  state.wordIdx = -1;
  state.readingTimer = setTimeout(() => speakChunk(0, { onWord, onDone }), 350);
}

function speakChunk(chunkI, cb) {
  if (state.phase !== 'reading') return;
  if (chunkI >= ttsChunks.length) { cb.onDone(); return; }

  const chunk = ttsChunks[chunkI];
  const rate  = getRate();
  const text  = chunk.words.map(w => w.word).join(' ');
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate  = rate;
  utter.pitch = 0.97;
  utter.lang  = 'en-US';
  if (chosenVoice) utter.voice = chosenVoice;
  state.utterance = utter;

  const msPerWord = (60 / (150 * rate)) * 1000;
  let localWordPos = 0;
  let boundaryFired = false;

  utter.onboundary = (e) => {
    if (e.name !== 'word' || state.phase !== 'reading') return;
    boundaryFired = true;
    let cc = 0;
    for (let wi = 0; wi < chunk.words.length; wi++) {
      cc += chunk.words[wi].word.length + (wi > 0 ? 1 : 0);
      if (cc >= e.charIndex + 1) { localWordPos = wi; break; }
    }
    const idx = chunk.words[localWordPos]?.idx ?? chunk.startIdx;
    state.wordIdx = idx;
    cb.onWord(idx);
  };

  let timerWordPos = 0;
  const timer = setInterval(() => {
    if (state.phase !== 'reading') { clearInterval(timer); return; }
    if (!boundaryFired) {
      const idx = chunk.words[timerWordPos]?.idx ?? chunk.startIdx;
      state.wordIdx = idx;
      cb.onWord(idx);
      timerWordPos = Math.min(timerWordPos + 1, chunk.words.length - 1);
    }
  }, msPerWord);

  utter.onend = () => {
    clearInterval(timer);
    if (state.phase !== 'reading') return;
    state.wordIdx = chunk.endIdx;
    cb.onWord(chunk.endIdx);
    setTimeout(() => speakChunk(chunkI + 1, cb), chunk.pause);
  };
  utter.onerror = () => {
    clearInterval(timer);
    if (state.phase === 'reading') speakChunk(chunkI + 1, cb);
  };

  state.synth.speak(utter);
}

/** Change speed mid-reading — rebuild chunks from current word. */
export function changeSpeedWhileReading(cb) {
  const resumeFrom = state.wordIdx;
  state.synth.cancel();
  clearTimeout(state.readingTimer);
  const offset = resumeFrom >= 0 ? resumeFrom : 0;
  const partial = buildChunks(state.words.slice(offset));
  ttsChunks = partial.map(c => ({
    ...c,
    words: c.words.map(w => ({ ...w, idx: w.idx + offset })),
    startIdx: c.startIdx + offset,
    endIdx: c.endIdx + offset,
  }));
  state.readingTimer = setTimeout(() => speakChunk(0, cb), 100);
}

export function pauseReading()  { state.synth.pause(); }
export function resumeReading() { state.synth.resume(); }
export function stopReading()   { state.synth.cancel(); clearTimeout(state.readingTimer); }
export function isSpeaking()    { return state.synth.speaking; }
