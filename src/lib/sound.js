// Bruitages synthétisés avec Web Audio : aucun fichier son à charger.
const KEY = 'wp-sound';
let ctx = null;
let enabled = (() => {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
})();

export const soundOn = () => enabled;
export function setSound(on) {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* stockage indisponible : le réglage vaut pour la session */
  }
}

function audio() {
  if (!enabled) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(a, { freq, to, type = 'sine', at = 0, dur = 0.2, vol = 0.15 }) {
  const t = a.currentTime + at;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise(a, { at = 0, dur = 0.3, from = 800, to = 4000, vol = 0.25, q = 1.2 }) {
  const t = a.currentTime + at;
  const len = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  const gain = a.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(a.destination);
  src.start(t);
}

const NOTES = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 2093];

export const sfx = {
  cut(progress) {
    const a = audio();
    if (!a) return;
    noise(a, { dur: 0.05, from: 1800 + progress * 3000, to: 2600 + progress * 3000, vol: 0.06, q: 4 });
  },
  tear() {
    const a = audio();
    if (!a) return;
    noise(a, { dur: 0.45, from: 600, to: 5200, vol: 0.32, q: 0.9 });
    tone(a, { freq: 240, to: 90, type: 'triangle', dur: 0.25, vol: 0.08 });
  },
  whoosh() {
    const a = audio();
    if (!a) return;
    noise(a, { dur: 0.35, from: 300, to: 1800, vol: 0.12, q: 0.7 });
  },
  flip() {
    const a = audio();
    if (!a) return;
    tone(a, { freq: 1100, to: 420, type: 'triangle', dur: 0.07, vol: 0.09 });
  },
  tease(rarity) {
    const a = audio();
    if (!a) return;
    tone(a, { freq: 110, to: rarity >= 5 ? 360 : 220, type: 'sawtooth', dur: rarity >= 5 ? 1.2 : 0.8, vol: 0.05 });
  },
  reveal(rarity, shiny = false) {
    const a = audio();
    if (!a) return;
    const n = Math.min(rarity + 2, NOTES.length);
    for (let i = 0; i < n; i++) {
      tone(a, { freq: NOTES[i], type: 'triangle', at: i * 0.075, dur: 0.35 + rarity * 0.07, vol: 0.09 });
      if (rarity >= 3) tone(a, { freq: NOTES[i] * 2, type: 'sine', at: i * 0.075 + 0.02, dur: 0.5, vol: 0.035 });
    }
    if (rarity >= 4 || shiny) {
      for (let i = 0; i < 12; i++) tone(a, { freq: 2000 + Math.random() * 2600, at: 0.4 + i * 0.055, dur: 0.18, vol: 0.022 });
    }
  },
  pop() {
    const a = audio();
    if (!a) return;
    tone(a, { freq: 660, to: 990, type: 'sine', dur: 0.09, vol: 0.06 });
  },
  tick() {
    const a = audio();
    if (!a) return;
    tone(a, { freq: 1600, type: 'square', dur: 0.025, vol: 0.02 });
  },
};
