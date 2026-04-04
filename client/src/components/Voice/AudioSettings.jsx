import React, { memo } from 'react';
import { useAudioSettingsController } from '../../features/voice/useAudioSettingsController.mjs';
import Modal from '../Common/Modal';
import {
  AudioSettingsFooter,
  AudioSettingsInputPanel,
  AudioSettingsOutputPanel,
  AudioSettingsProcessingPanel,
  AudioSettingsSensitivityPanel,
} from './AudioSettingsPanels.jsx';
import { styles } from './AudioSettingsShellStyles.mjs';

function AudioSettings({ onClose, openTraceId = null }) {
  const controller = useAudioSettingsController({ onClose, openTraceId });

  return (
    <Modal onClose={controller.handleClose} title="Audio Settings">
      <div style={styles.modalContent}>
        <AudioSettingsInputPanel
          labelStyle={styles.label}
          selectStyle={styles.select}
          {...controller.inputPanelProps}
        />

        <AudioSettingsSensitivityPanel
          labelStyle={styles.label}
          {...controller.sensitivityPanelProps}
        />

        <AudioSettingsProcessingPanel
          labelStyle={styles.label}
          {...controller.processingPanelProps}
        />

        <AudioSettingsOutputPanel
          labelStyle={styles.label}
          selectStyle={styles.select}
          {...controller.outputPanelProps}
        />

        <AudioSettingsFooter {...controller.footerProps} />
      </div>
    </Modal>
  );
}

export default memo(AudioSettings);
