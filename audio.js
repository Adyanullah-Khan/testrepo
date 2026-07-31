// ---------- sound (Web Audio, no assets) ----------
let actx = null;
function ensureAudio() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function beep(freq, dur, type = 'square', vol = 0.15) {
  const a = ensureAudio();
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq;
  o.connect(g); g.connect(a.destination);
  const now = a.currentTime;
  g.gain.setValueAtTime(vol, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + dur);
  o.start(now); o.stop(now + dur);
}
const sfx = {
  shoot: () => beep(880, 0.07, 'square', 0.1),
  alienShoot: () => beep(220, 0.08, 'sawtooth', 0.07),
  explosion: () => beep(140, 0.15, 'square', 0.14),
  hit: () => beep(90, 0.25, 'sawtooth', 0.2),
  round: () => { beep(440, 0.1, 'triangle', 0.15); setTimeout(() => beep(660, 0.15, 'triangle', 0.15), 100); },
  gameOver: () => { beep(200, 0.3, 'sawtooth', 0.2); setTimeout(() => beep(110, 0.4, 'sawtooth', 0.2), 150); },
};
