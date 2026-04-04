import React from 'react';
import {
  PanelShell,
  SmallHint,
  ToggleOption,
  VOICE_PROCESSING_MODES,
} from './AudioSettingsPanelShared.jsx';

export function AudioSettingsSensitivityPanelView({
  labelStyle,
  lowLatencyEnabled = false,
  micGain = 3,
  onMicGainChange = () => {},
} = {}) {
  return (
    <PanelShell labelStyle={labelStyle} title="Mic Sensitivity">
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
          onChange={(event) => {
            onMicGainChange(parseFloat(event.target.value));
          }}
          style={{
            flex: 1,
            accentColor: 'var(--accent)',
            cursor: 'pointer',
            opacity: 1,
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
      <SmallHint>
        {lowLatencyEnabled
          ? 'Still available when cleanup is off. This boosts input level, not processing latency.'
          : 'Increase for quiet mics (laptop built-in)'}
      </SmallHint>
    </PanelShell>
  );
}

export function AudioSettingsProcessingPanelView({
  labelStyle,
  lowLatencyEnabled = false,
  preferredSuppressionImplementation = { detail: '' },
  appleHardwareProcessingGuidance = null,
  handleSelectProcessingMode = () => {},
  noiseSuppressionFallbackReason = null,
} = {}) {
  return (
    <PanelShell labelStyle={labelStyle} title="Audio Processing">
      <ToggleOption
        active={!lowLatencyEnabled}
        inactiveBackground="var(--bg-input)"
        inactiveBorder="var(--border)"
        activeBackground="rgba(255, 122, 26, 0.08)"
        activeBorder="rgba(255, 122, 26, 0.28)"
        indicatorBackground="var(--accent)"
        indicatorBorder="var(--accent)"
        onClick={() => handleSelectProcessingMode(VOICE_PROCESSING_MODES.STANDARD)}
        title="Noise Suppression"
        description={preferredSuppressionImplementation.detail}
      />
      <div style={{ height: 10 }} />
      <ToggleOption
        active={lowLatencyEnabled}
        inactiveBackground="var(--bg-input)"
        inactiveBorder="var(--border)"
        activeBackground="rgba(255, 82, 82, 0.08)"
        activeBorder="rgba(255, 82, 82, 0.26)"
        indicatorBackground="var(--danger)"
        indicatorBorder="var(--danger)"
        onClick={() => handleSelectProcessingMode(VOICE_PROCESSING_MODES.ULTRA_LOW_LATENCY)}
        title="Ultra Low Latency"
        description="Fastest raw mic path. Headset mic recommended. Built-in speakers and laptop mics can create feedback or echo."
      />
      <SmallHint>
        {lowLatencyEnabled
          ? 'Ultra Low Latency skips cleanup and echo control for the fastest response. Use a headset mic whenever possible.'
          : 'Noise Suppression keeps the cleanup path active while the standard voice path handles speaker safety in the background.'}
      </SmallHint>
      {appleHardwareProcessingGuidance && (
        <SmallHint style={{ marginTop: 6 }}>
          {appleHardwareProcessingGuidance}
        </SmallHint>
      )}
      {noiseSuppressionFallbackReason && (
        <div style={{
          fontSize: 10,
          color: 'var(--danger)',
          marginTop: 6,
          lineHeight: 1.4,
          padding: '8px 10px',
          borderRadius: 6,
          background: 'rgba(255, 82, 82, 0.08)',
          border: '1px solid rgba(255, 82, 82, 0.22)',
        }}>
          {noiseSuppressionFallbackReason}
        </div>
      )}
    </PanelShell>
  );
}

export function AudioSettingsOutputPanelView({
  labelStyle,
  selectStyle,
  selectedOutput = '',
  outputDevices = [],
  handleOutputChange = () => {},
  activeMonitorProfile = { hint: '' },
} = {}) {
  return (
    <div>
      <label style={labelStyle}>Output Device</label>
      <select
        value={selectedOutput}
        onChange={(event) => handleOutputChange(event.target.value)}
        style={selectStyle}
      >
        <option value="">Default</option>
        {outputDevices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `Speaker ${device.deviceId.slice(0, 8)}`}
          </option>
        ))}
      </select>
      <SmallHint>{activeMonitorProfile.hint}</SmallHint>
    </div>
  );
}

export function AudioSettingsFooterView({
  handleClose = () => {},
} = {}) {
  return (
    <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
      <button
        onClick={handleClose}
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
        onMouseEnter={(event) => { event.target.style.color = 'var(--text-primary)'; }}
        onMouseLeave={(event) => { event.target.style.color = 'var(--text-secondary)'; }}
      >
        Close
      </button>
    </div>
  );
}
