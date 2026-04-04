import React from 'react';
import { useSourcePickerController } from '../../features/stream/useSourcePickerController.mjs';
import { SourceCard } from './SourcePickerCard.jsx';
import {
  SourcePickerAudioSection,
  SourcePickerFooter,
  SourcePickerSections,
} from './SourcePickerPanels.jsx';

export default function SourcePicker({ onSelect, onClose }) {
  const {
    loading,
    selected,
    setSelected,
    screens,
    windows,
    isMac,
    includeAudio,
    setIncludeAudio,
    virtualDevices,
    selectedAudioDevice,
    setSelectedAudioDevice,
    selectedAudioDeviceLabel,
    audioDetected,
    handleConfirm,
    openVirtualAudioInstaller,
  } = useSourcePickerController({ onSelect });

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
        onClick={event => event.stopPropagation()}
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
          <SourcePickerSections
            screens={screens}
            windows={windows}
            selected={selected}
            onSelect={setSelected}
            SourceCardComponent={SourceCard}
          />
        )}

        <SourcePickerAudioSection
          isMac={isMac}
          includeAudio={includeAudio}
          setIncludeAudio={setIncludeAudio}
          virtualDevices={virtualDevices}
          selectedAudioDevice={selectedAudioDevice}
          setSelectedAudioDevice={setSelectedAudioDevice}
          selectedAudioDeviceLabel={selectedAudioDeviceLabel}
          audioDetected={audioDetected}
          openVirtualAudioInstaller={openVirtualAudioInstaller}
        />

        <SourcePickerFooter
          selected={selected}
          onClose={onClose}
          onConfirm={handleConfirm}
        />
      </div>
    </div>
  );
}
