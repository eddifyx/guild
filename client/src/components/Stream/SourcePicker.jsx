import { useState, useEffect } from 'react';

const VIRTUAL_AUDIO_KEYWORDS = ['blackhole', 'soundflower', 'loopback audio', 'vb-cable'];

function detectVirtualAudioDevices(devices) {
  return devices.filter(d =>
    d.kind === 'audioinput' &&
    VIRTUAL_AUDIO_KEYWORDS.some(kw => d.label.toLowerCase().includes(kw))
  );
}

function SourceCard({ source, isSelected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: isSelected ? 'rgba(64, 255, 64, 0.1)' : 'var(--bg-primary)',
        border: isSelected ? '2px solid var(--accent)' : '2px solid var(--border)',
        borderRadius: 8,
        padding: 6,
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'border-color 0.15s, background 0.15s',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        willChange: 'border-color',
        contain: 'layout style',
      }}
      onMouseEnter={e => {
        if (!isSelected) e.currentTarget.style.borderColor = 'var(--text-muted)';
      }}
      onMouseLeave={e => {
        if (!isSelected) e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      {source.thumbnail ? (
        <img
          src={source.thumbnail}
          alt={source.name}
          draggable={false}
          style={{ width: '100%', aspectRatio: '16/9', borderRadius: 4, objectFit: 'contain', background: '#000' }}
        />
      ) : (
        <div style={{
          width: '100%',
          aspectRatio: '16/9',
          borderRadius: 4,
          background: 'var(--bg-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {source.id.startsWith('screen:') ? (
              <>
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </>
            ) : (
              <>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
              </>
            )}
          </svg>
        </div>
      )}
      <span style={{
        fontSize: 11,
        color: isSelected ? 'var(--accent)' : 'var(--text-secondary)',
        fontWeight: isSelected ? 600 : 400,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        width: '100%',
      }}>
        {source.name}
      </span>
    </button>
  );
}

export default function SourcePicker({ onSelect, onClose }) {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const isMac = window.electronAPI?.getPlatform?.() === 'darwin';

  // Audio state
  const [includeAudio, setIncludeAudio] = useState(true);
  const [virtualDevices, setVirtualDevices] = useState([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
  const [audioDetected, setAudioDetected] = useState(!isMac); // Windows always has loopback

  // Detect virtual audio devices on Mac
  useEffect(() => {
    if (!isMac) return;
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const virtual = detectVirtualAudioDevices(devices);
      setVirtualDevices(virtual);
      if (virtual.length > 0) {
        setSelectedAudioDevice(virtual[0].deviceId);
        setAudioDetected(true);
      } else {
        setIncludeAudio(false);
      }
    }).catch(() => {});
  }, [isMac]);

  useEffect(() => {
    window.electronAPI?.getDesktopSources?.().then(srcs => {
      setSources(srcs || []);
      setLoading(false);

      // On macOS, screens load instantly but windows + thumbnails are deferred
      if (isMac) {
        // Load windows in background (window enumeration is slow on macOS)
        window.electronAPI.getDesktopWindows?.().then(wins => {
          if (wins?.length) {
            setSources(prev => {
              const existingIds = new Set(prev.map(s => s.id));
              const newWins = wins.filter(w => !existingIds.has(w.id));
              return newWins.length ? [...prev, ...newWins] : prev;
            });
          }
        }).catch(() => {});

        // Load thumbnails for everything in background
        window.electronAPI.getDesktopThumbnails?.().then(thumbs => {
          if (!thumbs) return;
          setSources(prev => prev.map(s => ({
            ...s,
            thumbnail: thumbs[s.id] || s.thumbnail,
          })));
        }).catch(() => {});
      }
    }).catch(() => setLoading(false));
  }, []);

  const screens = sources.filter(s => s.id.startsWith('screen:'));
  const windows = sources.filter(s => s.id.startsWith('window:'));

  const handleConfirm = () => {
    if (!selected) return;
    onSelect({
      sourceId: selected,
      includeAudio,
      macAudioDeviceId: isMac && includeAudio && audioDetected ? selectedAudioDevice : null,
    });
  };

  // Speaker icon
  const speakerIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: 12,
          padding: 24,
          width: 680,
          maxWidth: '90vw',
          maxHeight: '80vh',
          overflow: 'hidden',
          border: '1px solid var(--border)',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.5)',
          animation: 'fadeIn 0.2s ease-out',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
          Share Your Screen
        </h3>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Loading sources...
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {screens.length > 0 && (
              <div>
                <div style={{
                  fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                  color: 'var(--text-muted)', letterSpacing: '1.2px', marginBottom: 8,
                }}>
                  Screens
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                  {screens.map(s => (
                    <SourceCard key={s.id} source={s} isSelected={selected === s.id} onClick={() => setSelected(s.id)} />
                  ))}
                </div>
              </div>
            )}

            {windows.length > 0 && (
              <div>
                <div style={{
                  fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                  color: 'var(--text-muted)', letterSpacing: '1.2px', marginBottom: 8,
                }}>
                  Windows
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                  {windows.map(s => (
                    <SourceCard key={s.id} source={s} isSelected={selected === s.id} onClick={() => setSelected(s.id)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Audio section */}
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
                onChange={e => setIncludeAudio(e.target.checked)}
                style={{ accentColor: 'var(--accent)', cursor: audioDetected ? 'pointer' : 'default' }}
              />
              <span style={{ color: 'var(--text-primary)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                {speakerIcon}
                Also share audio
              </span>
            </label>

            {/* Mac: show device picker if multiple virtual devices */}
            {isMac && audioDetected && virtualDevices.length > 1 && includeAudio && (
              <select
                value={selectedAudioDevice}
                onChange={e => setSelectedAudioDevice(e.target.value)}
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
                {virtualDevices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                ))}
              </select>
            )}
          </div>

          {/* Mac: helper text */}
          {isMac && (
            <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.5 }}>
              {audioDetected ? (
                <span style={{ color: 'var(--text-muted)' }}>
                  System audio via <strong style={{ color: 'var(--accent)' }}>
                    {virtualDevices.find(d => d.deviceId === selectedAudioDevice)?.label || 'virtual device'}
                  </strong>
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>
                  macOS requires a virtual audio driver for system audio.{' '}
                  <button
                    onClick={() => window.electronAPI?.openExternal?.('https://existential.audio/blackhole/')}
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
                  {' '} then restart /guild.
                </span>
              )}
            </div>
          )}

          {/* Windows: simple helper text */}
          {!isMac && includeAudio && (
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
              Game and app audio will be shared with viewers
            </div>
          )}
        </div>

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
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
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
      </div>
    </div>
  );
}
