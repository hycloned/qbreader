// Multiplayer (bee) mode — connects to a QBReader WebSocket room.
//
// The SERVER controls the game: it reads the question word by word,
// manages buzzing, judges answers, and tracks scores. We connect,
// display/speak the words as they arrive, and send buzz/answer messages.
//
// Protocol (confirmed against qbreader/website source):
//   connect: wss://www.qbreader.org/play/mp/<room>?roomName=&userId=&username=
//   send:    {type:'ping'} every 30s, {type:'buzz'}, {type:'give-answer',givenAnswer}, {type:'next'}
//   recv:    start-next-tossup, update-question{word}, buzz{userId,username},
//            lost-buzzer-race, give-tossup-answer{directive,...}, reveal-tossup-answer,
//            end-current-tossup, connection-acknowledged{userId,players}, join, leave, error

import { state, settings, hasMic, dom, app } from './state.js';
import * as tts from './tts.js';
import { startMic, stopMic } from './recognition.js';
import * as ui from './ui.js';

const WS_BASE = 'wss://www.qbreader.org/play/mp/';

let socket = null;
let pingTimer = null;
let myUserId = localStorage.getItem('qb_user_id') || 'unknown';
let myServerId = null;          // assigned by server on connection-acknowledged
let players = {};               // userId -> { username, points }
let roomName = '';
let buzzedInUserId = null;      // who currently holds the buzz
let speakQueue = [];            // words waiting to be spoken
let speaking = false;
let roomIsOwned = false;        // does the local user own this room?
let onReadyCallback = null;     // called once connection-acknowledged arrives

/** Register a callback fired when we're fully connected (host can push settings). */
export function onReady(fn) { onReadyCallback = fn; }

/* ── Public: join / leave ── */
export function joinRoom(name, username) {
  name = (name || '').trim();
  username = (username || '').trim() || 'Player';
  if (!name) { ui.showBanner('prompt', 'Enter a room name first.'); return; }
  if (!/^[A-Za-z0-9_-]+$/.test(name)) {
    ui.showBanner('prompt', 'Room name: letters, numbers, - and _ only.');
    return;
  }

  localStorage.setItem('qb_username', username);
  roomName = name;

  const params = new URLSearchParams({ roomName: name, userId: myUserId, username });
  tts.unlockAudio(); // prime iOS audio on the user gesture

  try {
    socket = new WebSocket(`${WS_BASE}${encodeURIComponent(name)}?${params}`);
  } catch {
    ui.showBanner('prompt', 'Could not connect. Try again.');
    return;
  }

  socket.onopen = () => {
    pingTimer = setInterval(() => send({ type: 'ping' }), 30000);
    showConnectedUI();
  };
  socket.onmessage = (e) => handleMessage(JSON.parse(e.data));
  socket.onclose = () => cleanupConnection();
  socket.onerror = () => ui.showBanner('prompt', 'Connection error.');
}

export function leaveRoom() {
  if (socket) { try { socket.close(3000); } catch {} }
  cleanupConnection();
}

function cleanupConnection() {
  clearInterval(pingTimer);
  tts.stopReading();
  stopMic();
  speakQueue = [];
  speaking = false;
  buzzedInUserId = null;
  players = {};
  socket = null;
  showJoinUI();
  renderPlayers();
}

function send(obj) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(obj));
  }
}

/* ── UI state ── */
function showConnectedUI() {
  dom.roomJoin.classList.add('hidden');
  dom.roomConnected.classList.remove('hidden');
  dom.roomLabel.textContent = roomName;
  // In multiplayer, New Question becomes "Next", Skip is hidden
  dom.btnNew.textContent = 'Next';
  dom.btnSkip.classList.add('hidden');
  dom.btnBuzz.disabled = true;
  ui.setPhase('idle');
  ui.showBanner('prompt', 'Connected! Tap "Next" to start reading.');
}

function showJoinUI() {
  dom.roomJoin.classList.remove('hidden');
  dom.roomConnected.classList.add('hidden');
  dom.btnNew.textContent = 'New Question';
  dom.btnSkip.classList.remove('hidden');
  setFilterControlsEnabled(true); // re-enable for solo / next join
}

// Enable/disable the category & difficulty selectors (host controls only).
export function setFilterControlsEnabled(enabled) {
  dom.selCategory.disabled = !enabled;
  dom.selDiff.disabled = !enabled;
  // subcategory has its own disabled logic (empty list) — only force-disable
  if (!enabled) dom.selSubcat.disabled = true;
}

/* ── Message router ── */
function handleMessage(data) {
  switch (data.type) {
    case 'connection-acknowledged': return onConnAck(data);
    case 'start-next-tossup':       return onStartTossup(data);
    case 'update-question':         return onWord(data);
    case 'buzz':                    return onBuzz(data);
    case 'lost-buzzer-race':        return onLostBuzz(data);
    case 'give-tossup-answer':      return onAnswerJudged(data);
    case 'reveal-tossup-answer':    return onRevealAnswer(data);
    case 'end-current-tossup':      return onEndTossup(data);
    case 'join':                    return onJoin(data);
    case 'leave':                   return onLeave(data);
    case 'set-username':            return onSetUsername(data);
    case 'error':                   return onError(data);
    // ignore chat, settings echoes, votekick, etc. for this lightweight client
  }
}

/* ── Connection acknowledged: capture our id + player list ── */
function onConnAck(data) {
  myServerId = data.userId || myUserId;
  if (data.userId) {
    myUserId = data.userId;
    localStorage.setItem('qb_user_id', myUserId);
  }
  // We own the room if the server says our id is the owner id.
  roomIsOwned = !!data.ownerId && data.ownerId === myUserId;

  players = {};
  const src = data.players || {};
  for (const id in src) {
    players[id] = { username: src[id].username || 'Player', points: src[id].points || 0 };
  }
  renderPlayers();

  // Host controls category & difficulty; everyone else's controls are locked.
  setFilterControlsEnabled(roomIsOwned);

  // Let the host push their current category/difficulty selections.
  if (roomIsOwned && onReadyCallback) onReadyCallback();

  if (!roomIsOwned) {
    ui.showBanner('prompt', 'Joined! The room host controls category & difficulty.');
  }
}

/* ── New tossup starts ── */
function onStartTossup(data) {
  tts.stopReading();
  stopMic();
  speakQueue = [];
  speaking = false;
  buzzedInUserId = null;

  state.tossup = data.tossup || null;
  state.words = [];
  state.wordIdx = -1;

  ui.setPhase('reading');
  ui.showQuestionUI();
  ui.hideBuzzUI();
  ui.hideBanner();
  dom.qText.innerHTML = '';
  dom.btnBuzz.disabled = false;
  renderPlayers();
}

/* ── A word arrives from the server ── */
function onWord({ word }) {
  // Server sends power/buzzpoint markers we shouldn't show or read
  if (word === '(*)' || word === '[*]' || word === '(+)') return;

  // Append to the visible question
  state.words.push(word, ' ');
  const idx = state.words.length - 2; // the word we just pushed
  ui.renderQuestionWords(idx);

  // Queue it for TTS (read aloud in order as words stream in)
  if (app.mode === 'multi') {
    speakQueue.push(word);
    drainSpeakQueue();
  }
}

// Speak queued words one at a time using a short utterance each.
function drainSpeakQueue() {
  if (speaking || !speakQueue.length) return;
  if (state.phase !== 'reading') { speakQueue = []; return; }
  speaking = true;
  const chunk = speakQueue.splice(0, speakQueue.length).join(' ');
  const u = new SpeechSynthesisUtterance(chunk);
  u.rate = tts.getRate();
  u.pitch = 0.97;
  u.lang = 'en-US';
  u.onend = () => { speaking = false; drainSpeakQueue(); };
  u.onerror = () => { speaking = false; drainSpeakQueue(); };
  state.synth.speak(u);
}

/* ── Someone buzzed ── */
function onBuzz({ userId, username }) {
  buzzedInUserId = userId;
  tts.stopReading();
  state.synth.cancel();
  speakQueue = [];
  speaking = false;
  dom.btnBuzz.disabled = true;
  ui.setPhase('buzzed');
  renderPlayers();

  if (userId === myUserId) {
    // It's me — open my answer input
    openAnswerInput();
  } else {
    ui.showBanner('prompt', `🔔 ${username || 'Someone'} buzzed…`);
  }
}

/* ── We lost the buzzer race (someone beat us) ── */
function onLostBuzz({ username }) {
  ui.showBanner('prompt', `${username || 'Someone'} buzzed first.`);
  ui.hideBuzzUI();
  stopMic();
}

/* ── Answer was judged ── */
function onAnswerJudged({ directive, directedPrompt, userId, username, score }) {
  if (directive === 'prompt') {
    if (userId === myUserId) {
      ui.showBanner('prompt', `↩ PROMPT: ${directedPrompt || 'Be more specific'}`);
      openAnswerInput();
    } else {
      ui.showBanner('prompt', `${username || 'Player'} was prompted…`);
    }
    return;
  }

  // accept or reject — update that player's score
  if (userId && players[userId]) {
    players[userId].points = (players[userId].points || 0) + (score || 0);
  }
  renderPlayers();

  const who = userId === myUserId ? 'You' : (username || 'Player');
  if (directive === 'accept') {
    ui.showBanner('correct', `✓ ${who} got it right (+${score})`);
  } else {
    ui.showBanner('wrong', `✗ ${who} missed (${score})`);
  }
  ui.hideBuzzUI();
  stopMic();
  // Reading may resume for others (rebuzz) — server will send more words or reveal.
  if (state.phase === 'buzzed') ui.setPhase('reading');
}

/* ── Full answer revealed (tossup over) ── */
function onRevealAnswer({ answer, question }) {
  tts.stopReading();
  state.synth.cancel();
  ui.setPhase('done');
  dom.btnBuzz.disabled = true;
  stopMic();
  if (question) dom.qText.innerHTML = question.replace(/\(\*\)|\[\*\]|\(\+\)/g, '');
  const clean = (answer || '').replace(/<[^>]+>/g, '').replace(/\[.*?\]/g, '').replace(/\s+/g, ' ').trim();
  dom.answerReveal.style.display = 'block';
  dom.answerReveal.className = '';
  dom.answerReveal.innerHTML = `<div class="label">Answer</div><div class="answer-text">${clean}</div>`;
}

function onEndTossup() {
  dom.btnBuzz.disabled = true;
}

/* ── Roster changes ── */
function onJoin({ userId, username, user }) {
  const name = username || user?.username || 'Player';
  players[userId] = players[userId] || { username: name, points: user?.points || 0 };
  players[userId].username = name;
  renderPlayers();
}
function onLeave({ userId }) {
  delete players[userId];
  renderPlayers();
}
function onSetUsername({ userId, newUsername }) {
  if (players[userId]) players[userId].username = newUsername;
  renderPlayers();
}
function onError({ message }) {
  ui.showBanner('wrong', `⚠ ${message || 'Room error'}`);
  // fatal join errors close the socket; reflect that
  setTimeout(() => { if (!socket || socket.readyState !== WebSocket.OPEN) showJoinUI(); }, 100);
}

/* ── Answer input (mic or type, honoring the answerMode setting) ── */
function openAnswerInput() {
  const useMic = hasMic && settings.answerMode === 'voice-then-type';
  if (useMic) { ui.showMicUI(); listenViaMic(); }
  else        { ui.showTypeUI(); }
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
        ui.showBanner('prompt', 'Mic denied. Type your answer.');
      } else {
        ui.setTranscript(reason === 'no-speech' ? 'No speech detected.' : '');
        setTimeout(ui.showTypeUI, 800);
      }
    },
  });
}

export function submitAnswer(given) {
  given = (given || dom.answerInput.value || '').trim();
  if (!given) return;
  ui.hideBuzzUI();
  ui.showBanner('prompt', `<span class="spinner"></span> Sent: "<em>${given}</em>"`);
  send({ type: 'give-answer', givenAnswer: given });
}

/* ── Buzz / Next (called from main.js button handlers) ── */
export function buzz() {
  if (app.mode !== 'multi' || !socket) return;
  if (state.phase !== 'reading') return;
  send({ type: 'buzz' });
  send({ type: 'give-answer-live-update', givenAnswer: '' });
  // server will echo a 'buzz' message that opens our input
}

export function next() {
  if (app.mode !== 'multi' || !socket) return;
  ui.hideBanner();
  send({ type: 'next' });
}

export function cancelMic() {
  stopMic();
  ui.showTypeUI();
}

/** Send an arbitrary room-settings message (e.g. set-categories, set-difficulties). */
export function sendSettings(obj) {
  send(obj);
}

/** True if the local user owns/created the room (can control settings). */
export function isOwner() {
  return roomIsOwned;
}

export function isConnected() {
  return !!socket && socket.readyState === WebSocket.OPEN;
}

/* ── Players roster rendering ── */
function renderPlayers() {
  const entries = Object.entries(players);
  if (!entries.length) { dom.playersList.innerHTML = ''; return; }
  // sort by points desc
  entries.sort((a, b) => (b[1].points || 0) - (a[1].points || 0));
  dom.playersList.innerHTML = entries.map(([id, p]) => {
    const cls = ['player-chip'];
    if (id === myUserId) cls.push('me');
    if (id === buzzedInUserId) cls.push('buzzed');
    return `<span class="${cls.join(' ')}">${escapeHtml(p.username)}<span class="pscore">${p.points || 0}</span></span>`;
  }).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/* ── Prefill saved username ── */
export function prefillUsername() {
  const saved = localStorage.getItem('qb_username');
  if (saved) dom.usernameInput.value = saved;
}
