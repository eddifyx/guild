import { useState } from 'react';

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(1);
  return String(value);
}

function MetricRow({ label, value }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      gap: 12,
      fontSize: 10,
      color: 'var(--text-secondary)',
      fontVariantNumeric: 'tabular-nums',
    }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{formatValue(value)}</span>
    </div>
  );
}

function DiagnosticsCard({ title, children }) {
  return (
    <div style={{
      padding: 10,
      borderRadius: 6,
      background: 'var(--bg-input)',
      border: '1px solid var(--border)',
      display: 'grid',
      gap: 6,
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--text-primary)',
        textTransform: 'uppercase',
        letterSpacing: '0.8px',
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export default function VoiceDiagnosticsPanel({ liveDiagnostics, testDiagnostics }) {
  if (!import.meta.env.DEV) return null;

  const [isOpen, setIsOpen] = useState(false);

  const liveCapture = liveDiagnostics?.liveCapture;
  const liveSender = liveDiagnostics?.senderStats;
  const liveConsumers = Object.entries(liveDiagnostics?.consumers || {});
  const testCapture = testDiagnostics;

  return (
    <details
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      style={{
        marginTop: 16,
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--bg-input)',
        overflow: 'hidden',
      }}
    >
      <summary style={{
        cursor: 'pointer',
        listStyle: 'none',
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--text-primary)',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          Voice Diagnostics
        </span>
        <span style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {liveDiagnostics?.updatedAt || testDiagnostics?.updatedAt || 'No samples yet'}
        </span>
      </summary>

      {isOpen && (
      <div style={{
        padding: 12,
        borderTop: '1px solid var(--border)',
        display: 'grid',
        gap: 10,
      }}>
        <div style={{
          padding: 10,
          borderRadius: 6,
          background: 'rgba(255, 184, 0, 0.08)',
          border: '1px solid rgba(255, 184, 0, 0.25)',
          fontSize: 10,
          color: 'var(--text-secondary)',
          lineHeight: 1.45,
        }}>
          Local capture timing and call stats. Useful for checking which voice path is active and how quickly it started.
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
        <DiagnosticsCard title="Live Session">
          <MetricRow label="Channel" value={liveDiagnostics?.session?.channelId} />
          <MetricRow label="Active" value={liveDiagnostics?.session?.active} />
          <MetricRow label="Secure Voice" value={liveDiagnostics?.session?.secureVoice?.state} />
          <MetricRow label="Secure Warning" value={liveDiagnostics?.session?.secureVoice?.warning} />
          <MetricRow label="Mode" value={liveCapture?.mode} />
          <MetricRow label="Suppression Path" value={liveCapture?.filter?.backend} />
          <MetricRow label="Updated" value={liveDiagnostics?.updatedAt} />
          <MetricRow label="getUserMedia (ms)" value={liveCapture?.timingsMs?.getUserMedia} />
          <MetricRow label="Audio Graph (ms)" value={liveCapture?.timingsMs?.audioGraphSetup} />
          <MetricRow label="Filter Init (ms)" value={liveCapture?.filter?.initializeMs} />
          <MetricRow label="Worklet Create (ms)" value={liveCapture?.filter?.workletCreateMs} />
          <MetricRow label="Produce (ms)" value={liveCapture?.timingsMs?.produce} />
          <MetricRow label="Total Local Path (ms)" value={liveCapture?.timingsMs?.total} />
          <MetricRow label="Default Device Fallback" value={liveCapture?.usedDefaultDeviceFallback} />
          <MetricRow label="AEC Enabled" value={liveCapture?.requestedConstraints?.echoCancellation} />
          <MetricRow label="AGC Enabled" value={liveCapture?.requestedConstraints?.autoGainControl} />
          <MetricRow label="Track NS" value={liveCapture?.sourceTrack?.settings?.noiseSuppression} />
          <MetricRow label="Track AGC" value={liveCapture?.sourceTrack?.settings?.autoGainControl} />
          <MetricRow label="Requested Sample Rate" value={liveCapture?.requestedConstraints?.sampleRate?.ideal} />
          <MetricRow label="Actual Sample Rate" value={liveCapture?.sourceTrack?.settings?.sampleRate} />
          <MetricRow label="AudioContext Sample Rate" value={liveCapture?.audioContext?.sampleRate} />
          <MetricRow label="Base Latency (ms)" value={liveCapture?.audioContext?.baseLatencyMs} />
          <MetricRow label="Processing Ready" value={liveCapture?.filter?.loaded} />
          <MetricRow label="Filter Fallback" value={liveCapture?.filter?.fallbackReason} />
          <MetricRow label="Live Error" value={liveCapture?.error} />
        </DiagnosticsCard>

        <DiagnosticsCard title="Sender Stats">
          <MetricRow label="Sampled" value={liveSender?.sampledAt} />
          <MetricRow label="Packets Sent" value={liveSender?.outboundAudio?.packetsSent} />
          <MetricRow label="Bytes Sent" value={liveSender?.outboundAudio?.bytesSent} />
          <MetricRow label="Packet Send Delay (ms)" value={liveSender?.outboundAudio?.totalPacketSendDelayMs} />
          <MetricRow label="Remote RTT (ms)" value={liveSender?.remoteInboundAudio?.roundTripTimeMs} />
          <MetricRow label="Remote Jitter (ms)" value={liveSender?.remoteInboundAudio?.jitterMs} />
          <MetricRow label="Candidate RTT (ms)" value={liveSender?.candidatePair?.currentRoundTripTimeMs} />
          <MetricRow label="Outgoing Bitrate" value={liveSender?.candidatePair?.availableOutgoingBitrate} />
        </DiagnosticsCard>

        <DiagnosticsCard title="Mic Test">
          <MetricRow label="Mode" value={testCapture?.mode} />
          <MetricRow label="Suppression Path" value={testCapture?.filter?.backend} />
          <MetricRow label="Updated" value={testCapture?.updatedAt} />
          <MetricRow label="getUserMedia (ms)" value={testCapture?.timingsMs?.getUserMedia} />
          <MetricRow label="Audio Graph (ms)" value={testCapture?.timingsMs?.audioGraphSetup} />
          <MetricRow label="Filter Init (ms)" value={testCapture?.filter?.initializeMs} />
          <MetricRow label="Worklet Create (ms)" value={testCapture?.filter?.workletCreateMs} />
          <MetricRow label="Monitor Setup (ms)" value={testCapture?.timingsMs?.monitorSetup} />
          <MetricRow label="Total Local Path (ms)" value={testCapture?.timingsMs?.total} />
          <MetricRow label="Default Device Fallback" value={testCapture?.usedDefaultDeviceFallback} />
          <MetricRow label="AEC Enabled" value={testCapture?.requestedConstraints?.echoCancellation} />
          <MetricRow label="Track NS" value={testCapture?.sourceTrack?.settings?.noiseSuppression} />
          <MetricRow label="Track AGC" value={testCapture?.sourceTrack?.settings?.autoGainControl} />
          <MetricRow label="Actual Sample Rate" value={testCapture?.sourceTrack?.settings?.sampleRate} />
          <MetricRow label="AudioContext Sample Rate" value={testCapture?.audioContext?.sampleRate} />
          <MetricRow label="Base Latency (ms)" value={testCapture?.audioContext?.baseLatencyMs} />
          <MetricRow label="Processing Ready" value={testCapture?.filter?.loaded} />
          <MetricRow label="Monitor State" value={testCapture?.playback?.state} />
          <MetricRow label="Monitor Error" value={testCapture?.playback?.error} />
          <MetricRow label="Test Error" value={testCapture?.error} />
        </DiagnosticsCard>

        <details style={{ border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-input)', padding: '8px 10px' }}>
          <summary style={{ cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
            Receiver Stats ({liveConsumers.length})
          </summary>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {liveConsumers.length === 0 ? (
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>No consumer stats captured yet.</div>
            ) : liveConsumers.map(([producerId, consumer]) => (
              <DiagnosticsCard key={producerId} title={`${consumer?.source || 'consumer'} · ${producerId.slice(0, 8)}`}>
                <MetricRow label="User" value={consumer?.producerUserId} />
                <MetricRow label="Sampled" value={consumer?.sampledAt} />
                <MetricRow label="Consume Request (ms)" value={consumer?.timingsMs?.consumeRequest} />
                <MetricRow label="Transport Setup (ms)" value={consumer?.timingsMs?.transportSetup} />
                <MetricRow label="Decrypt Attach (ms)" value={consumer?.timingsMs?.decryptAttach} />
                <MetricRow label="Audio Element (ms)" value={consumer?.timingsMs?.audioElementSetup} />
                <MetricRow label="Playback State" value={consumer?.playback?.state} />
                <MetricRow label="Playback Via" value={consumer?.playback?.via} />
                <MetricRow label="Playback Error" value={consumer?.playback?.error} />
                <MetricRow label="Packets Received" value={consumer?.stats?.inboundAudio?.packetsReceived} />
                <MetricRow label="Packets Lost" value={consumer?.stats?.inboundAudio?.packetsLost} />
                <MetricRow label="Jitter (ms)" value={consumer?.stats?.inboundAudio?.jitterMs} />
                <MetricRow label="Jitter Buffer Avg (ms)" value={consumer?.stats?.inboundAudio?.jitterBufferAverageMs} />
                <MetricRow label="Candidate RTT (ms)" value={consumer?.stats?.candidatePair?.currentRoundTripTimeMs} />
              </DiagnosticsCard>
            ))}
          </div>
        </details>

        <details style={{ border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-input)', padding: '8px 10px' }}>
          <summary style={{ cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
            Diagnostics JSON
          </summary>
          <pre style={{
            marginTop: 8,
            padding: 10,
            borderRadius: 6,
            background: 'var(--bg-primary)',
            color: 'var(--text-secondary)',
            fontSize: 10,
            lineHeight: 1.45,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 260,
            overflow: 'auto',
          }}>
            {JSON.stringify({ liveDiagnostics, testDiagnostics }, null, 2)}
          </pre>
        </details>
        </div>
      </div>
      )}
    </details>
  );
}
