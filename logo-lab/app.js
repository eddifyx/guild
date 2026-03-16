const BASE_MARK_SIZE = 130;
const STORAGE_KEY = "guild-logo-lab-state-v1";
const CONFIG_KEYS = [
  "outerStroke",
  "middleStroke",
  "middleInset",
  "innerInset",
  "coreCut",
  "depth",
  "tilt",
  "motion",
];

const presets = [
  {
    id: "current",
    name: "Current reference",
    note: "Flat and balanced. This tracks the existing box proportions and makes a good baseline before we push weight or depth.",
    outerStroke: 1.5,
    middleStroke: 1.5,
    middleInset: 23,
    innerInset: 43,
    coreCut: 0,
    depth: 0,
    tilt: 0,
    motion: "still",
  },
  {
    id: "outer-lead",
    name: "Outer lead",
    note: "The heavier outside frame gives the silhouette more presence, while the inner frame stays quiet and precise.",
    outerStroke: 3.3,
    middleStroke: 1.6,
    middleInset: 21,
    innerInset: 45,
    coreCut: 4,
    depth: 6,
    tilt: 6,
    motion: "still",
  },
  {
    id: "inner-lead",
    name: "Inner lead",
    note: "This pushes visual weight inward. It feels more mechanical, but the outer shape loses some authority.",
    outerStroke: 1.8,
    middleStroke: 3.1,
    middleInset: 23,
    innerInset: 45,
    coreCut: 5,
    depth: 7,
    tilt: 7,
    motion: "still",
  },
  {
    id: "split-weight",
    name: "Split-weight bevel",
    note: "This is the strongest direction so far: the outer frame leads, the inner frame is still visible, and the core now tucks inward so the lock motion stays clean.",
    outerStroke: 2.8,
    middleStroke: 1.9,
    middleInset: 21,
    innerInset: 46,
    coreCut: 6,
    depth: 12,
    tilt: 10,
    motion: "lock",
    featured: true,
  },
];

const elements = {
  gallery: document.getElementById("gallery-grid"),
  title: document.getElementById("candidate-title"),
  note: document.getElementById("candidate-note"),
  summary: document.getElementById("candidate-summary"),
  exportBox: document.getElementById("config-export"),
  shareStatus: document.getElementById("share-status"),
  motionButtons: [...document.querySelectorAll(".motion-chip")],
  buttons: {
    copyConfig: document.getElementById("copy-config"),
    copyLink: document.getElementById("copy-link"),
  },
  inputs: {
    outerStroke: document.getElementById("outer-stroke"),
    middleStroke: document.getElementById("middle-stroke"),
    middleInset: document.getElementById("middle-inset"),
    innerInset: document.getElementById("inner-inset"),
    coreCut: document.getElementById("core-cut"),
    depth: document.getElementById("depth"),
    tilt: document.getElementById("tilt"),
  },
  outputs: {
    outerStroke: document.getElementById("outer-stroke-value"),
    middleStroke: document.getElementById("middle-stroke-value"),
    middleInset: document.getElementById("middle-inset-value"),
    innerInset: document.getElementById("inner-inset-value"),
    coreCut: document.getElementById("core-cut-value"),
    depth: document.getElementById("depth-value"),
    tilt: document.getElementById("tilt-value"),
  },
};

const live = createMark(true);
document.getElementById("live-mark-slot").appendChild(live.scene);

const defaultPreset = presets.find((preset) => preset.featured);
const state = { ...defaultPreset };
let rafId = 0;
let motionStart = performance.now();
let currentMotion = state.motion;
let shareStatusTimer = 0;

renderGallery();
bindControls();
bindShareTools();
loadInitialState();
window.addEventListener("resize", handleResize);

function createMark(isLarge = false) {
  const scene = document.createElement("div");
  scene.className = `mark-scene${isLarge ? " is-large" : ""}`;
  scene.innerHTML = `
    <div class="mark-rig">
      <div class="guild-mark">
        <div class="ring outer"></div>
        <div class="ring middle"></div>
        <div class="core"></div>
      </div>
    </div>
  `;

  const rig = scene.querySelector(".mark-rig");
  const mark = scene.querySelector(".guild-mark");
  const outer = scene.querySelector(".outer");
  const middle = scene.querySelector(".middle");
  const core = scene.querySelector(".core");

  return { scene, rig, mark, outer, middle, core };
}

function renderGallery() {
  const cards = presets.map((preset) => {
    const card = document.createElement("article");
    card.className = `study-card${preset.featured ? " is-featured" : ""}`;

    const stage = document.createElement("div");
    stage.className = "study-stage";
    const mark = createMark(false);
    applyVisualState(mark, preset);
    applyMotionFrame(mark, preset, 0);
    stage.appendChild(mark.scene);

    const heading = document.createElement("h3");
    heading.textContent = preset.name;

    const copy = document.createElement("p");
    copy.textContent = preset.note;

    const meta = document.createElement("div");
    meta.className = "meta-line";
    meta.innerHTML = `<span>Outer ${preset.outerStroke.toFixed(1)}px</span><span>Gap ${coreGap(preset)}px</span>`;

    const action = document.createElement("button");
    action.className = "study-action";
    action.type = "button";
    action.textContent = "Load preset";
    action.addEventListener("click", () => loadPreset(preset));

    card.append(stage, heading, copy, meta, action);
    return card;
  });

  elements.gallery.replaceChildren(...cards);
}

function bindControls() {
  Object.entries(elements.inputs).forEach(([key, input]) => {
    input.addEventListener("input", () => {
      state[key] = Number(input.value);
      enforceCoreBounds(state);
      updateLive();
    });
  });

  elements.motionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.motion = button.dataset.motion;
      updateLive();
    });
  });
}

function bindShareTools() {
  elements.buttons.copyConfig.addEventListener("click", async () => {
    const copied = await copyText(JSON.stringify(exportConfig(state), null, 2));
    setShareStatus(copied ? "Config copied." : "Copy failed. The config block below is current.");
  });

  elements.buttons.copyLink.addEventListener("click", async () => {
    const copied = await copyText(window.location.href);
    setShareStatus(copied ? "Share link copied." : "Copy failed. You can still copy the URL from the address bar.");
  });
}

function loadInitialState() {
  const sharedConfig = parseHashState();
  if (sharedConfig) {
    loadPreset({ ...defaultPreset, ...sharedConfig });
    setShareStatus("Loaded shared config from URL.");
    return;
  }

  const savedConfig = loadSavedState();
  if (savedConfig) {
    loadPreset({ ...defaultPreset, ...savedConfig });
    setShareStatus("Restored saved local state.");
    return;
  }

  loadPreset(defaultPreset);
}

function loadPreset(preset) {
  Object.assign(state, preset);
  enforceCoreBounds(state);
  updateLive();
}

function updateControls() {
  elements.inputs.outerStroke.value = state.outerStroke;
  elements.inputs.middleStroke.value = state.middleStroke;
  elements.inputs.middleInset.value = state.middleInset;
  elements.inputs.innerInset.value = state.innerInset;
  elements.inputs.coreCut.value = state.coreCut;
  elements.inputs.depth.value = state.depth;
  elements.inputs.tilt.value = state.tilt;

  elements.outputs.outerStroke.value = `${state.outerStroke.toFixed(1)}px`;
  elements.outputs.middleStroke.value = `${state.middleStroke.toFixed(1)}px`;
  elements.outputs.middleInset.value = `${state.middleInset}px`;
  elements.outputs.innerInset.value = `${coreGap(state)}px`;
  elements.outputs.coreCut.value = state.coreCut === 0 ? "square" : `${state.coreCut}px`;
  elements.outputs.depth.value = `${state.depth}px`;
  elements.outputs.tilt.value = `${state.tilt}deg`;

  elements.motionButtons.forEach((button) => {
    const active = button.dataset.motion === state.motion;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function updateLive() {
  updateControls();
  applyVisualState(live, state);
  elements.title.textContent = titleForState(state);
  elements.note.textContent = noteForState(state);
  elements.summary.textContent = summaryForState(state);
  elements.exportBox.textContent = JSON.stringify(exportConfig(state), null, 2);
  syncHash(state);
  saveState(state);

  if (currentMotion !== state.motion || state.motion === "lock") {
    motionStart = performance.now();
    currentMotion = state.motion;
  }

  cancelAnimationFrame(rafId);
  tick();
}

function applyVisualState(markParts, config) {
  const markSize = displayMarkSize(markParts);
  const scale = markSize / BASE_MARK_SIZE;

  markParts.mark.style.setProperty("--outer-stroke", `${roundToTenth(config.outerStroke * scale)}px`);
  markParts.mark.style.setProperty("--middle-stroke", `${roundToTenth(config.middleStroke * scale)}px`);
  markParts.mark.style.setProperty("--middle-inset", `${roundToTenth(config.middleInset * scale)}px`);
  markParts.mark.style.setProperty("--inner-inset", `${roundToTenth(config.innerInset * scale)}px`);
  markParts.mark.style.setProperty("--core-cut", `${roundToTenth(config.coreCut * scale)}px`);
  markParts.mark.style.setProperty("--depth", `${roundToTenth(config.depth * scale)}px`);
  markParts.mark.style.setProperty("--depth-factor", roundToTenth(config.depth * scale));
}

function tick(now = performance.now()) {
  const elapsed = now - motionStart;
  applyMotionFrame(live, state, elapsed);
  rafId = requestAnimationFrame(tick);
}

function applyMotionFrame(markParts, config, elapsed) {
  const frame = motionFrame(config, elapsed);

  markParts.rig.style.transform = [
    `translateY(${frame.floatY}px)`,
    `rotateX(${frame.tiltX}deg)`,
    `rotateY(${frame.tiltY}deg)`,
    `rotateZ(${frame.roll}deg)`,
  ].join(" ");

  markParts.outer.style.transform = `rotate(${frame.outerAngle}deg) translateZ(${config.depth * 0.18}px)`;
  markParts.middle.style.transform = `rotate(${frame.middleAngle}deg) translateZ(${config.depth * 0.42}px)`;
  markParts.core.style.transform = `rotate(45deg) scale(${frame.coreScale}) translateZ(${2 + config.depth * 0.92}px)`;
}

function motionFrame(config, elapsed) {
  const baseTilt = config.tilt;
  const tuckedScale = safeCoreScale(config);

  if (config.motion === "orbit") {
    return {
      outerAngle: 45 + ((elapsed * 0.05) % 360),
      middleAngle: 45 - ((elapsed * 0.07) % 360),
      coreScale: tuckedScale + Math.sin(elapsed / 420) * 0.028,
      tiltX: baseTilt + Math.sin(elapsed / 1400) * 1.5,
      tiltY: baseTilt * -1.15 + Math.cos(elapsed / 1800) * 1.5,
      roll: Math.sin(elapsed / 2000) * 1.5,
      floatY: Math.sin(elapsed / 700) * -4,
    };
  }

  if (config.motion === "lock") {
    const total = 3600;
    const t = elapsed % total;
    const hold = 260;
    const expand = 620;
    const converge = 1500;
    const settle = total - hold - expand - converge;
    const target = 45;
    const outerPeak = 152;
    const middlePeak = -28;

    let outerAngle = target;
    let middleAngle = target;
    let coreScale = 1;
    let tiltLift = 0;
    let roll = 0;
    let floatY = 0;

    if (t < hold) {
      coreScale = 1;
    } else if (t < hold + expand) {
      const progress = easeOutCubic((t - hold) / expand);
      outerAngle = lerp(target, outerPeak, progress);
      middleAngle = lerp(target, middlePeak, progress);
      coreScale = lerp(1, tuckedScale, progress);
      tiltLift = progress * 2;
      roll = progress * -1.4;
      floatY = progress * -8;
    } else if (t < hold + expand + converge) {
      const progress = easeSnapLock((t - hold - expand) / converge);
      outerAngle = lerp(outerPeak, target, progress);
      middleAngle = lerp(middlePeak, target, progress);
      coreScale = lerp(tuckedScale, 1, progress) + Math.sin(progress * Math.PI) * 0.018;
      tiltLift = (1 - progress) * 2;
      roll = (1 - progress) * -1.4;
      floatY = (1 - progress) * -8;
    } else {
      const progress = settle <= 0 ? 1 : (t - hold - expand - converge) / settle;
      coreScale = 1 + Math.sin(progress * Math.PI) * 0.012;
      floatY = Math.sin(progress * Math.PI) * -2;
    }

    return {
      outerAngle,
      middleAngle,
      coreScale,
      tiltX: baseTilt + tiltLift,
      tiltY: baseTilt * -1.15 + tiltLift * -0.7,
      roll,
      floatY,
    };
  }

  return {
    outerAngle: 45,
    middleAngle: 45,
    coreScale: 1,
    tiltX: baseTilt,
    tiltY: baseTilt * -1.15,
    roll: 0,
    floatY: 0,
  };
}

function titleForState(config) {
  const lead =
    config.outerStroke > config.middleStroke + 0.45
      ? "Outer-led"
      : config.middleStroke > config.outerStroke + 0.45
        ? "Inner-led"
        : "Balanced";
  const depth =
    config.depth >= 11 ? "bevel" : config.depth >= 5 ? "shallow depth" : "flat";
  return `${lead} ${depth}`;
}

function noteForState(config) {
  if (config.depth >= 11 && config.outerStroke > config.middleStroke) {
    return "The outer frame carries the identity, the bevel stays restrained, and the core now tucks back during the off-axis lock phase so the lines do not collide.";
  }

  if (config.middleStroke > config.outerStroke) {
    return "This makes the middle frame do more of the talking. It feels tighter and more engineered, but the outer silhouette reads a little quieter.";
  }

  if (config.outerStroke > config.middleStroke) {
    return "This keeps the outside silhouette dominant, which gives the mark more confidence even before the motion kicks in.";
  }

  return "Balanced strokes keep the mark clean, but the silhouette has less emphasis than the asymmetric options.";
}

function summaryForState(config) {
  const spacing = config.middleInset <= 20 ? "compressed spacing" : config.middleInset >= 25 ? "wide spacing" : "moderate spacing";
  const depth = config.depth === 0 ? "flat presentation" : config.depth <= 8 ? "light 3D pass" : "noticeable bevel";
  return `${config.motion.toUpperCase()} motion, ${spacing}, ${depth}. Middle-to-core gap ${coreGap(config)}px with ${config.coreCut === 0 ? "a square core" : `${config.coreCut}px chamfer`}.`;
}

function enforceCoreBounds(config) {
  config.innerInset = clamp(config.innerInset, minCoreInset(config), 60);
  config.coreCut = clamp(config.coreCut ?? 0, 0, 14);
}

function minCoreInset(config) {
  return config.middleInset + 14;
}

function coreGap(config) {
  return Math.max(0, config.innerInset - config.middleInset);
}

function safeCoreScale(config) {
  const gap = coreGap(config);
  const gapPressure = Math.max(0, 22 - gap) * 0.01;
  const depthPressure = config.depth * 0.002;
  const chamferRelief = (config.coreCut || 0) * 0.004;
  return clamp(1 - gapPressure - depthPressure + chamferRelief, 0.84, 0.97);
}

function displayMarkSize(markParts) {
  if (!markParts.scene.classList.contains("is-large")) return BASE_MARK_SIZE;
  return window.innerWidth <= 720 ? 180 : 230;
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundToTenth(value) {
  return Math.round(value * 10) / 10;
}

function handleResize() {
  renderGallery();
  updateLive();
}

function exportConfig(config) {
  return CONFIG_KEYS.reduce((acc, key) => {
    acc[key] = config[key];
    return acc;
  }, {});
}

function syncHash(config) {
  const params = new URLSearchParams();
  params.set("outerStroke", String(config.outerStroke));
  params.set("middleStroke", String(config.middleStroke));
  params.set("middleInset", String(config.middleInset));
  params.set("innerInset", String(config.innerInset));
  params.set("coreCut", String(config.coreCut));
  params.set("depth", String(config.depth));
  params.set("tilt", String(config.tilt));
  params.set("motion", String(config.motion));
  history.replaceState(null, "", `#${params.toString()}`);
}

function parseHashState() {
  const rawHash = window.location.hash.slice(1);
  if (!rawHash) return null;

  const params = new URLSearchParams(rawHash);
  const motion = params.get("motion");
  const parsed = {
    outerStroke: Number(params.get("outerStroke")),
    middleStroke: Number(params.get("middleStroke")),
    middleInset: Number(params.get("middleInset")),
    innerInset: Number(params.get("innerInset")),
    coreCut: Number(params.get("coreCut")),
    depth: Number(params.get("depth")),
    tilt: Number(params.get("tilt")),
    motion,
  };

  if (
    Number.isNaN(parsed.outerStroke) ||
    Number.isNaN(parsed.middleStroke) ||
    Number.isNaN(parsed.middleInset) ||
    Number.isNaN(parsed.innerInset) ||
    Number.isNaN(parsed.coreCut) ||
    Number.isNaN(parsed.depth) ||
    Number.isNaN(parsed.tilt) ||
    !["still", "orbit", "lock"].includes(motion)
  ) {
    return null;
  }

  return parsed;
}

function loadSavedState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidConfig(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveState(config) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(exportConfig(config)));
  } catch {
    // Ignore storage failures; sharing via hash still works.
  }
}

function isValidConfig(config) {
  return !!config &&
    typeof config.outerStroke === "number" &&
    typeof config.middleStroke === "number" &&
    typeof config.middleInset === "number" &&
    typeof config.innerInset === "number" &&
    typeof config.coreCut === "number" &&
    typeof config.depth === "number" &&
    typeof config.tilt === "number" &&
    ["still", "orbit", "lock"].includes(config.motion);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("readonly", "");
    input.style.position = "absolute";
    input.style.left = "-9999px";
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(input);
    return copied;
  }
}

function setShareStatus(message) {
  window.clearTimeout(shareStatusTimer);
  elements.shareStatus.textContent = message;
  if (!message) return;

  shareStatusTimer = window.setTimeout(() => {
    elements.shareStatus.textContent = "";
  }, 2200);
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeSnapLock(t) {
  if (t >= 0.96) return 1;
  const mapped = t / 0.96;
  return 0.96 * (1 - Math.pow(1 - mapped, 3));
}
