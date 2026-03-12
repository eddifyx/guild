import { useState, useEffect, useRef, useCallback } from 'react';
import { DeepFilterNet3Core } from 'deepfilternet3-noise-filter';
import { useVoiceContext } from '../../contexts/VoiceContext';
import { getServerUrl } from '../../api';
import Modal from '../Common/Modal';

export default function AudioSettings({ onClose }) {
  const {
    inputDevices, outputDevices,
    selectedInput, selectedOutput,
    selectInput, selectOutput,
    setOutputDevice,
    setMicGain,
    toggleNoiseSuppression,
    setNoiseSuppressionLevel,
  } = useVoiceContext();

  const [testing, setTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micGain, setMicGainLocal] = useState(() =>
    parseFloat(localStorage.getItem('voice:micGain') || '3')
  );
  const [noiseSuppression, setNoiseSuppression] = useState(() =>
    localStorage.getItem('voice:noiseSuppression') !== 'false'
  );
  const [nsHigh, setNsHigh] = useState(() =>
    (localStorage.getItem('voice:nsLevel') || '80') !== '20'
  );
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const animFrameRef = useRef(null);
  const loopbackAudioRef = useRef(null);
  const gainRef = useRef(null);
  const deepFilterRef = useRef(null);

  const handleOutputChange = (deviceId) => {
    selectOutput(deviceId);
    setOutputDevice(deviceId);
  };

  const stopTest = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (loopbackAudioRef.current) {
      loopbackAudioRef.current.pause();
      loopbackAudioRef.current.srcObject = null;
      loopbackAudioRef.current = null;
    }
    if (deepFilterRef.current) {
      try { deepFilterRef.current.destroy?.(); } catch {}
      deepFilterRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setMicLevel(0);
    setTesting(false);
  }, []);

  const startTest = useCallback(async () => {
    try {
      const deepFilterEnabled = localStorage.getItem('voice:noiseSuppression') !== 'false';
      const constraints = {
        audio: {
          noiseSuppression: !deepFilterEnabled,
          echoCancellation: true,
          autoGainControl: true,
          ...(selectedInput ? { deviceId: { exact: selectedInput } } : {}),
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: 48000 });
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);

      // Apply mic gain so the test reflects what others will hear
      const gain = ctx.createGain();
      const savedGain = parseFloat(localStorage.getItem('voice:micGain') || '3');
      gain.gain.value = savedGain;
      gainRef.current = gain;

      // Insert DeepFilterNet3 if enabled
      if (deepFilterEnabled) {
        try {
          const savedNsLevel = parseInt(localStorage.getItem('voice:nsLevel') || '80', 10);
          const dfCore = new DeepFilterNet3Core({ sampleRate: 48000, noiseReductionLevel: savedNsLevel, assetConfig: { cdnUrl: `${getServerUrl()}/deepfilter` } });
          await dfCore.initialize();
          const dfNode = await dfCore.createAudioWorkletNode(ctx);
          deepFilterRef.current = dfCore;
          source.connect(dfNode);
          dfNode.connect(gain);
        } catch (dfErr) {
          console.warn('DeepFilterNet3 test failed, using raw mic:', dfErr);
          source.connect(gain);
        }
      } else {
        source.connect(gain);
      }

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      gain.connect(analyser);

      // Route processed audio to loopback so user hears what others hear
      const dest = ctx.createMediaStreamDestination();
      gain.connect(dest);
      const audio = new Audio();
      audio.srcObject = dest.stream;
      audio.volume = 1.0;
      const outputId = localStorage.getItem('voice:outputDeviceId');
      if (outputId && audio.setSinkId) {
        audio.setSinkId(outputId).catch(() => {});
      }
      audio.play().catch(() => {});
      loopbackAudioRef.current = audio;

      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
        setMicLevel(Math.min(100, (avg / 128) * 100));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
      setTesting(true);
    } catch (err) {
      console.error('Mic test failed:', err);
    }
  }, [selectedInput]);

  useEffect(() => {
    return () => stopTest();
  }, [stopTest]);

  const handleInputChange = (deviceId) => {
    selectInput(deviceId);
    if (testing) {
      stopTest();
      setTimeout(() => {
        startTest();
      }, 200);
    }
  };

  const levelColor = micLevel > 60 ? '#00d68f' : micLevel > 25 ? '#40FF40' : 'var(--text-muted)';

  const selectStyle = {
    width: '100%',
    padding: '8px 10px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text-primary)',
    fontSize: 13,
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  };

  const labelStyle = {
    display: 'block',
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: 6,
  };

  return (
    <Modal onClose={() => { stopTest(); onClose(); }} title="Audio Settings">
      <div style={{ minWidth: 320 }}>
        {/* Input device */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Input Device</label>
          <select
            value={selectedInput}
            onChange={e => handleInputChange(e.target.value)}
            style={selectStyle}
          >
            <option value="">Default</option>
            {inputDevices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>

          <div style={{ marginTop: 10 }}>
            <button
              onClick={testing ? stopTest : startTest}
              style={{
                padding: '6px 14px',
                background: testing ? 'var(--danger)' : 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: testing ? '#fff' : 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s',
              }}
            >
              {testing ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                  Stop
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                  Test Mic
                </>
              )}
            </button>

            {testing && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    flex: 1,
                    height: 4,
                    background: 'var(--bg-primary)',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${micLevel}%`,
                      height: '100%',
                      background: levelColor,
                      borderRadius: 2,
                      transition: 'width 0.05s linear, background 0.2s ease',
                    }} />
                  </div>
                  <span style={{
                    fontSize: 10,
                    color: levelColor,
                    fontWeight: 600,
                    minWidth: 20,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {Math.round(micLevel)}
                  </span>
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, display: 'block' }}>
                  {micLevel < 5
                    ? 'No input detected — speak to test'
                    : micLevel < 25
                      ? 'Low input — listening through speakers'
                      : 'Mic is working — listening through speakers'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Mic sensitivity */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Mic Sensitivity</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
            <input
              type="range"
              min="1"
              max="5"
              step="0.5"
              value={micGain}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setMicGainLocal(val);
                if (gainRef.current) gainRef.current.gain.value = val;
                if (setMicGain) setMicGain(val);
              }}
              style={{
                flex: 1,
                accentColor: 'var(--accent)',
                cursor: 'pointer',
              }}
            />
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              minWidth: 28,
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {micGain}x
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
            Increase for quiet mics (laptop built-in)
          </div>
        </div>

        {/* Noise suppression */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Audio Processing</label>
          <button
            onClick={() => {
              const next = !noiseSuppression;
              setNoiseSuppression(next);
              if (toggleNoiseSuppression) toggleNoiseSuppression(next);
              // Restart mic test with new constraints
              if (testing) {
                stopTest();
                setTimeout(() => startTest(), 200);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '8px 10px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text-primary)',
              fontSize: 13,
              cursor: 'pointer',
              transition: 'border-color 0.2s',
              textAlign: 'left',
            }}
          >
            <div style={{
              width: 32,
              height: 18,
              borderRadius: 9,
              background: noiseSuppression ? 'var(--accent)' : 'var(--bg-tertiary)',
              border: `1px solid ${noiseSuppression ? 'var(--accent)' : 'var(--border-strong)'}`,
              position: 'relative',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}>
              <div style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: '#fff',
                position: 'absolute',
                top: 1,
                left: noiseSuppression ? 16 : 1,
                transition: 'left 0.2s',
              }} />
            </div>
            <div>
              <div style={{ fontWeight: 500, fontSize: 12 }}>Noise Suppression</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                AI noise suppression (fans, keyboard, voices)
              </div>
            </div>
          </button>
          {noiseSuppression && (
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              {[false, true].map(high => (
                <button
                  key={high ? 'high' : 'low'}
                  onClick={() => {
                    setNsHigh(high);
                    const val = high ? 80 : 20;
                    if (setNoiseSuppressionLevel) setNoiseSuppressionLevel(val);
                    if (testing) {
                      stopTest();
                      setTimeout(() => startTest(), 200);
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    borderRadius: 4,
                    border: `1px solid ${nsHigh === high ? 'var(--accent)' : 'var(--border)'}`,
                    background: nsHigh === high ? 'rgba(64, 255, 64, 0.1)' : 'var(--bg-tertiary)',
                    color: nsHigh === high ? 'var(--accent)' : 'var(--text-muted)',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {high ? 'High' : 'Low'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Output device */}
        <div>
          <label style={labelStyle}>Output Device</label>
          <select
            value={selectedOutput}
            onChange={e => handleOutputChange(e.target.value)}
            style={selectStyle}
          >
            <option value="">Default</option>
            {outputDevices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Speaker ${d.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </div>

        {/* Close button */}
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => { stopTest(); onClose(); }}
            style={{
              padding: '8px 20px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.target.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.target.style.color = 'var(--text-secondary)'}
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
