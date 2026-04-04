import React, { useState } from 'react';

import {
  formatStreamCount,
  formatStreamFps,
  formatStreamKbps,
  formatStreamMs,
  formatStreamResolution,
  formatStreamTimestamp,
} from '../../features/stream/streamViewModel.mjs';

function DebugMetric({ label, value }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      gap: 10,
      fontSize: 11,
      color: 'rgba(230, 255, 230, 0.82)',
      fontVariantNumeric: 'tabular-nums',
    }}>
      <span style={{ color: 'rgba(184, 225, 184, 0.72)' }}>{label}</span>
      <span style={{ textAlign: 'right', color: '#f3fff3' }}>{value ?? '—'}</span>
    </div>
  );
}

function DebugSection({ title, children }) {
  return (
    <div style={{
      display: 'grid',
      gap: 6,
      paddingTop: 8,
      borderTop: '1px solid rgba(128, 255, 128, 0.12)',
    }}>
      <div style={{
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'rgba(166, 255, 166, 0.72)',
        fontWeight: 700,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export function StreamDebugHud({ ownStream, streamerName, screenShareDiagnostics, consumerDiagnostics }) {
  const [collapsed, setCollapsed] = useState(false);

  const screenShareHardware = screenShareDiagnostics?.adaptation?.hardware || null;
  const senderVideo = screenShareDiagnostics?.sender?.outboundVideo || null;
  const senderRemoteInboundVideo = screenShareDiagnostics?.sender?.remoteInboundVideo || null;
  const senderCandidatePair = screenShareDiagnostics?.sender?.candidatePair || null;
  const captureSettings = screenShareDiagnostics?.captureTrack?.settings || null;
  const receiverVideo = consumerDiagnostics?.stats?.inboundVideo || null;
  const receiverCandidatePair = consumerDiagnostics?.stats?.candidatePair || null;

  return (
    <div style={{
      position: 'absolute',
      top: 12,
      left: 12,
      zIndex: 3,
      width: 290,
      maxWidth: 'calc(100% - 80px)',
      padding: 12,
      borderRadius: 14,
      border: '1px solid rgba(98, 255, 98, 0.18)',
      background: 'rgba(6, 11, 6, 0.78)',
      color: '#f3fff3',
      backdropFilter: 'blur(14px)',
      boxShadow: '0 18px 48px rgba(0,0,0,0.34)',
      display: 'grid',
      gap: 8,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <div style={{ display: 'grid', gap: 2 }}>
          <div style={{
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'rgba(166, 255, 166, 0.78)',
            fontWeight: 700,
          }}>
            Stream Diagnostics
          </div>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#f7fff7',
          }}>
            {ownStream ? 'Local Sender' : `${streamerName}'s Stream`}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          style={{
            border: '1px solid rgba(123, 255, 123, 0.18)',
            background: 'rgba(14, 24, 14, 0.82)',
            color: '#d9ffd9',
            borderRadius: 999,
            padding: '4px 10px',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            cursor: 'pointer',
          }}
        >
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </div>

      {!collapsed && (
        <>
          {ownStream ? (
            <DebugSection title="Sender">
              <DebugMetric label="Sampled" value={formatStreamTimestamp(screenShareDiagnostics?.sampledAt)} />
              <DebugMetric label="Mode" value={screenShareDiagnostics?.producerMode || '—'} />
              <DebugMetric label="Profile" value={screenShareDiagnostics?.activeProfile?.label || '—'} />
              <DebugMetric label="Capture" value={formatStreamResolution(captureSettings?.width, captureSettings?.height)} />
              <DebugMetric label="Capture FPS" value={formatStreamFps(captureSettings?.frameRate)} />
              <DebugMetric label="Sent" value={formatStreamResolution(senderVideo?.frameWidth, senderVideo?.frameHeight)} />
              <DebugMetric label="Sent FPS" value={formatStreamFps(senderVideo?.framesPerSecond)} />
              <DebugMetric label="Frames Encoded" value={formatStreamCount(senderVideo?.framesEncoded)} />
              <DebugMetric label="Frames Sent" value={formatStreamCount(senderVideo?.framesSent)} />
              <DebugMetric label="Quality Limit" value={senderVideo?.qualityLimitationReason || '—'} />
              <DebugMetric label="Outgoing" value={formatStreamKbps(screenShareDiagnostics?.sender?.outgoingBitrateKbps)} />
              <DebugMetric label="BWE Out" value={formatStreamKbps(senderCandidatePair?.availableOutgoingBitrate)} />
              <DebugMetric label="RTT" value={formatStreamMs(senderRemoteInboundVideo?.roundTripTimeMs || senderCandidatePair?.currentRoundTripTimeMs)} />
              <DebugMetric label="Codec" value={senderVideo?.codecMimeType || screenShareDiagnostics?.selectedCodec?.mimeType || '—'} />
              <DebugMetric label="Encoder" value={senderVideo?.encoderImplementation || '—'} />
              <DebugMetric label="HW Accel" value={screenShareHardware?.hardwareAccelerationEnabled} />
              <DebugMetric label="GPU Encode" value={screenShareHardware?.videoEncode || '—'} />
              <DebugMetric label="GPU Decode" value={screenShareHardware?.videoDecode || '—'} />
              <DebugMetric label="Adaptation" value={screenShareDiagnostics?.adaptation?.lastReason || '—'} />
              {screenShareDiagnostics?.promotionFailure?.message && (
                <DebugMetric label="Promotion Error" value={screenShareDiagnostics.promotionFailure.message} />
              )}
            </DebugSection>
          ) : (
            <DebugSection title="Receiver">
              <DebugMetric label="Sampled" value={formatStreamTimestamp(consumerDiagnostics?.sampledAt)} />
              <DebugMetric label="Received" value={formatStreamResolution(receiverVideo?.frameWidth, receiverVideo?.frameHeight)} />
              <DebugMetric label="Recv FPS" value={formatStreamFps(receiverVideo?.framesPerSecond)} />
              <DebugMetric label="Frames Decoded" value={formatStreamCount(receiverVideo?.framesDecoded)} />
              <DebugMetric label="Frames Dropped" value={formatStreamCount(receiverVideo?.framesDropped)} />
              <DebugMetric label="Freeze Count" value={formatStreamCount(receiverVideo?.freezeCount)} />
              <DebugMetric label="Pause Count" value={formatStreamCount(receiverVideo?.pauseCount)} />
              <DebugMetric label="Jitter Avg" value={formatStreamMs(receiverVideo?.jitterBufferAverageMs)} />
              <DebugMetric label="Jitter" value={formatStreamMs(receiverVideo?.jitterMs)} />
              <DebugMetric label="Incoming" value={formatStreamKbps(receiverCandidatePair?.availableIncomingBitrate)} />
              <DebugMetric label="RTT" value={formatStreamMs(receiverCandidatePair?.currentRoundTripTimeMs)} />
              <DebugMetric label="Codec" value={receiverVideo?.codecMimeType || consumerDiagnostics?.signaledCodecMimeType || '—'} />
              <DebugMetric label="Decoder" value={receiverVideo?.decoderImplementation || '—'} />
            </DebugSection>
          )}
        </>
      )}
    </div>
  );
}
