import React from 'react';
import logoGeometry from '../../branding/logoGeometry.json';
import { buildUpdateOverlayLogoMetrics } from '../../features/update/updateOverlayModel.mjs';
import { useUpdateOverlayController } from '../../features/update/useUpdateOverlayController.mjs';
import { UpdateOverlayCard } from './UpdateOverlayPanels.jsx';
import {
  updateOverlayAnimationsCss,
  updateOverlayStyles as styles,
} from './UpdateOverlayStyles.mjs';

const logoMetrics = buildUpdateOverlayLogoMetrics(logoGeometry);

export default function UpdateOverlay({ serverUrl, onDismiss, updateInfo = null }) {
  const controller = useUpdateOverlayController({
    serverUrl,
    onDismiss,
    updateInfo,
  });

  return (
    <>
      <style>{updateOverlayAnimationsCss}</style>
      <div style={styles.backdrop}>
        <UpdateOverlayCard
          controller={controller}
          styles={styles}
          logoMetrics={logoMetrics}
        />
      </div>
    </>
  );
}
