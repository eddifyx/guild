// Synthesized chime sounds using Web Audio API — no external files needed

let audioCtx = null;
let chimeDestination = null;
let chimeOutputAudio = null;
let currentSinkId = null;
let chimeBusInput = null;
const CHIME_START_DELAY_SECONDS = 0.045;
const PEER_JOIN_CHIME_GAIN = 0.14;
const PEER_LEAVE_CHIME_GAIN = 0.115;
const SELF_CONNECT_CHIME_GAIN = 0.12;

async function getCtx() {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext();
    chimeDestination = null;
    chimeOutputAudio = null;
    chimeBusInput = null;
    currentSinkId = null;
  }
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
  return audioCtx;
}

async function ensureChimeOutput(ctx) {
  if (!chimeDestination || !chimeOutputAudio) {
    chimeDestination = ctx.createMediaStreamDestination();
    chimeBusInput = ctx.createGain();
    const highShelf = ctx.createBiquadFilter();
    const lowPass = ctx.createBiquadFilter();
    const compressor = ctx.createDynamicsCompressor();
    const masterGain = ctx.createGain();

    highShelf.type = 'highshelf';
    highShelf.frequency.value = 2200;
    highShelf.gain.value = -4.5;

    lowPass.type = 'lowpass';
    lowPass.frequency.value = 5200;
    lowPass.Q.value = 0.707;

    compressor.threshold.value = -24;
    compressor.knee.value = 16;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.12;

    masterGain.gain.value = 0.82;

    chimeBusInput.connect(highShelf);
    highShelf.connect(lowPass);
    lowPass.connect(compressor);
    compressor.connect(masterGain);
    masterGain.connect(chimeDestination);

    chimeOutputAudio = new Audio();
    chimeOutputAudio.srcObject = chimeDestination.stream;
    chimeOutputAudio.autoplay = false;
    chimeOutputAudio.playsInline = true;
    chimeOutputAudio.preload = 'auto';
    chimeOutputAudio.volume = 1;
  }

  const selectedSinkId = localStorage.getItem('voice:outputDeviceId') || 'default';
  if (typeof chimeOutputAudio.setSinkId === 'function' && currentSinkId !== selectedSinkId) {
    try {
      await chimeOutputAudio.setSinkId(selectedSinkId);
      currentSinkId = selectedSinkId;
    } catch {}
  }

  if (chimeOutputAudio.paused) {
    try {
      await chimeOutputAudio.play();
    } catch {}
  }

  return chimeBusInput;
}

async function getChimeBus() {
  const ctx = await getCtx();
  const dest = await ensureChimeOutput(ctx);
  return { ctx, dest };
}

// Activate AudioContext on first user gesture so notification chimes work
// (AudioContext.resume() only succeeds during or after a user interaction)
function activateAudioOnGesture() {
  void getChimeBus();
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
  vol.gain.linearRampToValueAtTime(gain, startTime + 0.022);
  vol.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain * 0.55), startTime + (duration * 0.72));
  vol.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(vol);
  vol.connect(dest);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.025);
}

// Two-tone ascending (peer join) — dropped an octave, snappier
export async function playJoinChime() {
  try {
    const { ctx, dest } = await getChimeBus();
    const now = ctx.currentTime + CHIME_START_DELAY_SECONDS;
    playTone(392, now, 0.09, PEER_JOIN_CHIME_GAIN, ctx, dest);           // G4
    playTone(523.25, now + 0.07, 0.12, PEER_JOIN_CHIME_GAIN, ctx, dest); // C5
  } catch {}
}

// Two-tone descending (peer leave)
export async function playLeaveChime() {
  try {
    const { ctx, dest } = await getChimeBus();
    const now = ctx.currentTime + CHIME_START_DELAY_SECONDS;
    playTone(523.25, now, 0.09, PEER_LEAVE_CHIME_GAIN, ctx, dest);       // C5
    playTone(392, now + 0.07, 0.12, PEER_LEAVE_CHIME_GAIN, ctx, dest);   // G4
  } catch {}
}

// Two-tone self-connect — low and quick
export async function playConnectChime() {
  try {
    const { ctx, dest } = await getChimeBus();
    const now = ctx.currentTime + CHIME_START_DELAY_SECONDS;
    playTone(329.63, now, 0.09, SELF_CONNECT_CHIME_GAIN, ctx, dest);       // E4
    playTone(440, now + 0.07, 0.12, SELF_CONNECT_CHIME_GAIN, ctx, dest);   // A4
  } catch {}
}

function playTriangleTone(freq, startTime, duration, gain, ctx, dest) {
  const osc = ctx.createOscillator();
  const vol = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  vol.gain.setValueAtTime(0, startTime);
  vol.gain.linearRampToValueAtTime(gain, startTime + 0.024);
  vol.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain * 0.55), startTime + (duration * 0.72));
  vol.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(vol);
  vol.connect(dest);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.025);
}

// Three-note ascending (stream start) — warm triangle wave, D major arpeggio
export async function playStreamStartChime() {
  try {
    const { ctx, dest } = await getChimeBus();
    const now = ctx.currentTime + CHIME_START_DELAY_SECONDS;
    playTriangleTone(293.66, now, 0.1, 0.12, ctx, dest);         // D4
    playTriangleTone(369.99, now + 0.08, 0.1, 0.12, ctx, dest);  // F#4
    playTriangleTone(440, now + 0.16, 0.14, 0.14, ctx, dest);    // A4
  } catch {}
}

// Three-note descending (stream stop) — warm triangle wave
export async function playStreamStopChime() {
  try {
    const { ctx, dest } = await getChimeBus();
    const now = ctx.currentTime + CHIME_START_DELAY_SECONDS;
    playTriangleTone(440, now, 0.08, 0.10, ctx, dest);           // A4
    playTriangleTone(369.99, now + 0.07, 0.08, 0.09, ctx, dest); // F#4
    playTriangleTone(293.66, now + 0.14, 0.12, 0.08, ctx, dest); // D4
  } catch {}
}

// Short pop/pluck (incoming message notification) — subtle and distinct
export async function playMessageChime() {
  try {
    const { ctx, dest } = await getChimeBus();
    const now = ctx.currentTime + CHIME_START_DELAY_SECONDS;
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);        // A5
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.08); // glide down
    vol.gain.setValueAtTime(0, now);
    vol.gain.linearRampToValueAtTime(0.14, now + 0.014);
    vol.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(vol);
    vol.connect(dest);
    osc.start(now);
    osc.stop(now + 0.205);
  } catch {}
}
