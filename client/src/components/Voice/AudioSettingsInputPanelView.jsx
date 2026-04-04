import React from 'react';
import {
  PanelShell,
  SmallHint,
} from './AudioSettingsPanelShared.jsx';

function MicTestButton({ testing, testStarting, startTest, stopTest }) {
  return (
    <button
      onClick={testing ? stopTest : startTest}
      disabled={testStarting && !testing}
      style={{
        padding: '6px 14px',
        background: testing ? 'var(--danger)' : 'var(--bg-tertiary)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        color: testing ? '#fff' : 'var(--text-secondary)',
        fontSize: 12,
        fontWeight: 500,
        cursor: testStarting ? 'wait' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        transition: 'all 0.15s',
        opacity: testStarting ? 0.85 : 1,
      }}
    >
      {testStarting ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 0.8s linear infinite' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          Starting...
        </>
      ) : testing ? (
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
  );
}

function MicTestMeter({
  meterFillRef,
  meterValueRef,
  meterStatusRef,
  activeMonitorProfile,
  lowLatencyEnabled,
  noiseSuppression,
  testDiagnostics,
  noiseSuppressionFallbackReason,
  testing,
  testStarting,
}) {
  return (
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
            width: '0%',
            height: '100%',
            background: 'var(--text-muted)',
            borderRadius: 2,
            transition: 'background 0.12s ease',
          }} ref={meterFillRef} />
        </div>
        <span style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          fontWeight: 600,
          minWidth: 20,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }} ref={meterValueRef}>
          0
        </span>
      </div>
      <span
        ref={meterStatusRef}
        style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, display: 'block' }}
      >
        No input detected — speak to test
      </span>
      <SmallHint>You should hear yourself immediately while the test is running.</SmallHint>
      <SmallHint>{activeMonitorProfile.hint}</SmallHint>
      {!lowLatencyEnabled && noiseSuppression && testing && testDiagnostics?.filter?.requiresWarmup && !testDiagnostics?.filter?.loaded && !noiseSuppressionFallbackReason && (
        <SmallHint>
          Noise suppression is starting. You will keep hearing your regular mic until it is ready.
        </SmallHint>
      )}
      {!testing && testStarting && (
        <SmallHint>Starting mic monitor.</SmallHint>
      )}
    </div>
  );
}

export function AudioSettingsInputPanelView({
  labelStyle,
  selectStyle,
  selectedInput = '',
  inputDevices = [],
  handleInputChange = () => {},
  testing = false,
  testStarting = false,
  startTest = () => {},
  stopTest = () => {},
  meterFillRef,
  meterValueRef,
  meterStatusRef,
  activeMonitorProfile = { hint: '' },
  lowLatencyEnabled = false,
  noiseSuppression = false,
  noiseSuppressionFallbackReason = null,
  testDiagnostics = null,
} = {}) {
  return (
    <PanelShell labelStyle={labelStyle} title="Input Device">
      <select
        value={selectedInput}
        onChange={(event) => handleInputChange(event.target.value)}
        style={selectStyle}
      >
        <option value="">Default</option>
        {inputDevices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
          </option>
        ))}
      </select>

      <div style={{ marginTop: 10 }}>
        <MicTestButton
          testing={testing}
          testStarting={testStarting}
          startTest={startTest}
          stopTest={stopTest}
        />

        {testing && (
          <MicTestMeter
            meterFillRef={meterFillRef}
            meterValueRef={meterValueRef}
            meterStatusRef={meterStatusRef}
            activeMonitorProfile={activeMonitorProfile}
            lowLatencyEnabled={lowLatencyEnabled}
            noiseSuppression={noiseSuppression}
            testDiagnostics={testDiagnostics}
            noiseSuppressionFallbackReason={noiseSuppressionFallbackReason}
            testing={testing}
            testStarting={testStarting}
          />
        )}
      </div>
    </PanelShell>
  );
}
