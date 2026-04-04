import React from 'react';
function SourcePickerSection({
  title,
  sources,
  selected,
  onSelect,
  SourceCardComponent,
}) {
  if (sources.length === 0) {
    return null;
  }

  return (
    <div>
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        letterSpacing: '1.2px',
        marginBottom: 8,
      }}>
        {title}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
        {sources.map((source) => (
          <SourceCardComponent
            key={source.id}
            source={source}
            isSelected={selected === source.id}
            onClick={() => onSelect(source.id)}
          />
        ))}
      </div>
    </div>
  );
}

function SpeakerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

export function SourcePickerSections({
  screens,
  windows,
  selected,
  onSelect,
  SourceCardComponent,
}) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SourcePickerSection
        title="Screens"
        sources={screens}
        selected={selected}
        onSelect={onSelect}
        SourceCardComponent={SourceCardComponent}
      />
      <SourcePickerSection
        title="Windows"
        sources={windows}
        selected={selected}
        onSelect={onSelect}
        SourceCardComponent={SourceCardComponent}
      />
    </div>
  );
}

export function SourcePickerAudioSection({
  isMac,
  includeAudio,
  setIncludeAudio,
  virtualDevices,
  selectedAudioDevice,
  setSelectedAudioDevice,
  selectedAudioDeviceLabel,
  audioDetected,
  openVirtualAudioInstaller,
}) {
  return (
    <div style={{
      marginTop: 16,
      padding: '12px 14px',
      borderRadius: 8,
      background: 'var(--bg-primary)',
      border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: audioDetected ? 'pointer' : 'default',
          flex: 1,
          minWidth: 0,
        }}>
          <input
            type="checkbox"
            checked={includeAudio && audioDetected}
            disabled={!audioDetected}
            onChange={(event) => setIncludeAudio(event.target.checked)}
            style={{ accentColor: 'var(--accent)', cursor: audioDetected ? 'pointer' : 'default' }}
          />
          <span style={{ color: 'var(--text-primary)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <SpeakerIcon />
            Also share audio
          </span>
        </label>

        {isMac && audioDetected && virtualDevices.length > 1 && includeAudio && (
          <select
            value={selectedAudioDevice}
            onChange={(event) => setSelectedAudioDevice(event.target.value)}
            style={{
              padding: '4px 8px',
              borderRadius: 4,
              border: '1px solid var(--border)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              fontSize: 11,
              outline: 'none',
              maxWidth: 200,
            }}
          >
            {virtualDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
            ))}
          </select>
        )}
      </div>

      {isMac && (
        <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.5 }}>
          {audioDetected ? (
            <span style={{ color: 'var(--text-muted)' }}>
              System audio via <strong style={{ color: 'var(--accent)' }}>{selectedAudioDeviceLabel}</strong>
            </span>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>
              macOS requires a virtual audio driver for system audio.{` `}
              <button
                onClick={openVirtualAudioInstaller}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: 11,
                  textDecoration: 'underline',
                  fontFamily: 'inherit',
                }}
              >
                Install BlackHole (free)
              </button>
              {` `}then restart /guild.
            </span>
          )}
        </div>
      )}

      {!isMac && includeAudio && (
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
          Game and app audio will be shared with viewers
        </div>
      )}
    </div>
  );
}

export function SourcePickerFooter({
  selected,
  onClose,
  onConfirm,
}) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
      <button
        onClick={onClose}
        style={{
          padding: '8px 16px',
          borderRadius: 6,
          border: '1px solid var(--border)',
          background: 'transparent',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: 13,
          transition: 'all 0.15s',
        }}
        onMouseEnter={(event) => { event.currentTarget.style.background = 'var(--bg-hover)'; }}
        onMouseLeave={(event) => { event.currentTarget.style.background = 'transparent'; }}
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={!selected}
        style={{
          padding: '8px 16px',
          borderRadius: 6,
          border: 'none',
          background: selected ? 'var(--accent)' : 'var(--bg-hover)',
          color: selected ? '#050705' : 'var(--text-muted)',
          cursor: selected ? 'pointer' : 'default',
          fontSize: 13,
          fontWeight: 600,
          transition: 'all 0.15s',
        }}
      >
        Share
      </button>
    </div>
  );
}
