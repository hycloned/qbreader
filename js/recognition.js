// Microphone / SpeechRecognition wrapper.

import { SpeechRecognitionCtor, hasMic, state } from './state.js';

let recognition = null;
if (hasMic) {
  recognition = new SpeechRecognitionCtor();
  recognition.lang = 'en-US';
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;
}

/**
 * Start listening.
 * @param {object} cb
 * @param {(text:string, isFinal:boolean)=>void} cb.onTranscript  live/final transcript
 * @param {(reason:string)=>void} cb.onFail  called on error/no-speech; reason is
 *        'denied' | 'no-speech' | 'error'
 */
export function startMic({ onTranscript, onFail }) {
  if (!recognition) { onFail('error'); return; }
  state.micActive = true;

  recognition.onresult = (e) => {
    let interim = '', final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += t; else interim += t;
    }
    onTranscript(final || interim, !!final.trim());
  };

  recognition.onerror = (e) => {
    state.micActive = false;
    if (e.error === 'no-speech') onFail('no-speech');
    else if (e.error === 'not-allowed' || e.error === 'service-not-allowed') onFail('denied');
    else onFail('error');
  };

  recognition.onend = () => { state.micActive = false; };

  try {
    recognition.start();
  } catch {
    recognition.stop();
    setTimeout(() => {
      try { recognition.start(); } catch { onFail('error'); }
    }, 300);
  }
}

export function stopMic() {
  state.micActive = false;
  try { recognition?.stop(); } catch {}
}
