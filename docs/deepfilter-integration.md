# DeepFilterNet3 Noise Suppression Integration

## Context
Chrome's built-in `noiseSuppression` is basic DSP from the 2010s — it handles fans/HVAC but is poor at keyboard clicks during speech, background voices, and transient noises. We're replacing it with **DeepFilterNet3** (2023), the highest-quality open-source ML noise suppression available. MIT/Apache-2.0, 48kHz full-band, ~40ms latency, production-proven by LiveKit.

npm package: `deepfilternet3-noise-filter` (75.8KB, self-contained WASM + AudioWorklet + Web Worker)

---

## Audio Pipeline

### Before (Chrome built-in NS)
```
getUserMedia(noiseSuppression: true)
  → AudioContext(48kHz)
  → createMediaStreamSource
  → GainNode (mic sensitivity boost)
  → createMediaStreamDestination
  → boostedTrack → mediasoup producer
```

### After (DeepFilterNet3)
```
getUserMedia(noiseSuppression: false, echoCancellation: true, autoGainControl: true)
  → AudioContext(48kHz)
  → createMediaStreamSource
  → DeepFilterNet3 AudioWorkletNode  ← ML noise suppression
  → GainNode (mic sensitivity boost)
  → createMediaStreamDestination
  → processedTrack → mediasoup producer
```

Key: **Disable** Chrome's built-in NS to avoid double-processing artifacts. Keep echoCancellation and autoGainControl (they handle different things).

---

## Implementation Details

### A. Package
```bash
cd client && npm install deepfilternet3-noise-filter
```

### B. useVoice.js Changes
1. Import `DeepFilterNet3Core` from the package
2. Import `getServerUrl` from `../api` (for self-hosted asset CDN)
3. Add `deepFilterRef = useRef(null)` for the filter instance
4. In mic+produce block: disable Chrome NS when DeepFilter enabled, insert AudioWorkletNode between mic source and gain node
5. Constructor uses `assetConfig: { cdnUrl: getServerUrl() + '/deepfilter' }` to fetch WASM/model from our server
6. Cleanup `deepFilterRef` in `leaveChannel`
7. `toggleNoiseSuppression` stores preference in localStorage — takes effect on next channel join

### C. AudioSettings.jsx Changes
Same DeepFilterNet3 integration in the mic test pipeline so users can hear the difference in "Listen" loopback mode.

### D. Server-Side Asset Hosting
DeepFilterNet3 downloads ~17MB of assets at runtime:
- `v2/pkg/df_bg.wasm` (9.2MB) — WebAssembly binary
- `v2/models/DeepFilterNet3_onnx.tar.gz` (7.7MB) — ONNX ML model

These are self-hosted because Electron's `fetch()` cannot reach the default CDN (`cdn.mezon.ai`).

**Server setup:**
- Assets stored at: `<server>/src/public/deepfilter/v2/`
- Express route: `app.use('/deepfilter', express.static(path.join(__dirname, 'public/deepfilter')))`
- Applied to both production (port 3001) and staging (port 3002)

### E. Electron CSP
No CSP configured in electron/main.js — WASM loads without issues. If CSP is ever added, `'unsafe-eval'` or `'wasm-unsafe-eval'` will be needed.

---

## Files Modified
1. `client/package.json` — added `deepfilternet3-noise-filter` dependency
2. `client/src/hooks/useVoice.js` — DeepFilterNet3 in voice pipeline
3. `client/src/components/Voice/AudioSettings.jsx` — DeepFilterNet3 in mic test
4. `server/src/index.js` — `/deepfilter` static route

## Server Files (manual, not in git)
- `/root/byzantine-server/src/public/deepfilter/v2/pkg/df_bg.wasm`
- `/root/byzantine-server/src/public/deepfilter/v2/models/DeepFilterNet3_onnx.tar.gz`
- Same paths under `/root/byzantine-staging/`

---

## Verification
- Join voice channel → speak with keyboard clicking → listener hears clean voice
- Toggle NS off in Audio Settings → listener hears keyboard clicks
- Toggle NS on → noise suppression takes effect on next join
- Audio Settings "Test Mic" → "Listen" → hear the DeepFilterNet3 processing live
- No noticeable latency increase (40ms is imperceptible in voice chat)
- If DeepFilterNet3 fails to load (WASM error), graceful fallback to raw mic

## Feature Branch
`feature/deepfilter-noise-suppression` — not yet merged to main
