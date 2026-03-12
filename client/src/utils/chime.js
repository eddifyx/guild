// Synthesized chime sounds using Web Audio API — no external files needed

let audioCtx = null;

async function getCtx() {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
  return audioCtx;
}

// Activate AudioContext on first user gesture so notification chimes work
// (AudioContext.resume() only succeeds during or after a user interaction)
function activateAudioOnGesture() {
  getCtx();
  document.removeEventListener('click', activateAudioOnGesture);
  document.removeEventListener('keydown', activateAudioOnGesture);
}
document.addEventListener('click', activateAudioOnGesture);
document.addEventListener('keydown', activateAudioOnGesture);

function playTone(freq, startTime, duration, gain, ctx, dest) {
  const osc = ctx.createOscillator();
  const vol = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  vol.gain.setValueAtTime(0, startTime);
  vol.gain.linearRampToValueAtTime(gain, startTime + 0.015);
  vol.gain.linearRampToValueAtTime(0, startTime + duration);
  osc.connect(vol);
  vol.connect(dest);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

// Two-tone ascending (peer join) — dropped an octave, snappier
export async function playJoinChime() {
  try {
    const ctx = await getCtx();
    const now = ctx.currentTime;
    playTone(392, now, 0.07, 0.14, ctx, ctx.destination);         // G4
    playTone(523.25, now + 0.06, 0.09, 0.14, ctx, ctx.destination); // C5
  } catch {}
}

// Two-tone descending (peer leave)
export async function playLeaveChime() {
  try {
    const ctx = await getCtx();
    const now = ctx.currentTime;
    playTone(523.25, now, 0.07, 0.11, ctx, ctx.destination);      // C5
    playTone(392, now + 0.06, 0.09, 0.11, ctx, ctx.destination);  // G4
  } catch {}
}

// Two-tone self-connect — low and quick
export async function playConnectChime() {
  try {
    const ctx = await getCtx();
    const now = ctx.currentTime;
    playTone(329.63, now, 0.07, 0.13, ctx, ctx.destination);      // E4
    playTone(440, now + 0.06, 0.1, 0.13, ctx, ctx.destination);   // A4
  } catch {}
}

function playTriangleTone(freq, startTime, duration, gain, ctx, dest) {
  const osc = ctx.createOscillator();
  const vol = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  vol.gain.setValueAtTime(0, startTime);
  vol.gain.linearRampToValueAtTime(gain, startTime + 0.02);
  vol.gain.linearRampToValueAtTime(0, startTime + duration);
  osc.connect(vol);
  vol.connect(dest);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

// Three-note ascending (stream start) — warm triangle wave, D major arpeggio
export async function playStreamStartChime() {
  try {
    const ctx = await getCtx();
    const now = ctx.currentTime;
    playTriangleTone(293.66, now, 0.1, 0.12, ctx, ctx.destination);         // D4
    playTriangleTone(369.99, now + 0.08, 0.1, 0.12, ctx, ctx.destination);  // F#4
    playTriangleTone(440, now + 0.16, 0.14, 0.14, ctx, ctx.destination);    // A4
  } catch {}
}

// Three-note descending (stream stop) — warm triangle wave
export async function playStreamStopChime() {
  try {
    const ctx = await getCtx();
    const now = ctx.currentTime;
    playTriangleTone(440, now, 0.08, 0.10, ctx, ctx.destination);           // A4
    playTriangleTone(369.99, now + 0.07, 0.08, 0.09, ctx, ctx.destination); // F#4
    playTriangleTone(293.66, now + 0.14, 0.12, 0.08, ctx, ctx.destination); // D4
  } catch {}
}

// Short pop/pluck (incoming message notification) — subtle and distinct
export async function playMessageChime() {
  try {
    const ctx = await getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);        // A5
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.08); // glide down
    vol.gain.setValueAtTime(0, now);
    vol.gain.linearRampToValueAtTime(0.18, now + 0.01);
    vol.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(vol);
    vol.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  } catch {}
}
