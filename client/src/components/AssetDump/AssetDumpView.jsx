import React from 'react';
import {
  AssetDownloadNotice,
  AssetDumpEmptyState,
  AssetDumpGrid,
  AssetDumpUploadPanel,
} from './AssetDumpPanels.jsx';
import { assetDumpStyles as styles } from './AssetDumpStyles.mjs';
import { useAssetDumpController } from '../../features/assetDump/useAssetDumpController.mjs';

export default function AssetDumpView() {
  const controller = useAssetDumpController();

  return (
    <div style={styles.container}>
      <AssetDumpUploadPanel
        description={controller.description}
        uploading={controller.uploading}
        dragOver={controller.dragOver}
        uploadError={controller.uploadError}
        fileInputRef={controller.fileInputRef}
        styles={styles}
        onDescriptionChange={controller.onDescriptionChange}
        onBrowse={controller.onBrowse}
        onFileInput={controller.onFileInput}
        onDrop={controller.onDrop}
        onSetDragOver={controller.onSetDragOver}
        onClearUploadError={controller.onClearUploadError}
      />

      <div ref={controller.scrollRef} style={styles.scrollArea}>
        {controller.loading ? (
          <div style={styles.loadingState}>Loading...</div>
        ) : !controller.hasAssets && !controller.pendingAssetView ? (
          <AssetDumpEmptyState styles={styles} />
        ) : (
          <AssetDumpGrid
            assetCards={controller.assetCards}
            pendingAssetView={controller.pendingAssetView}
            styles={styles}
            onDownload={controller.onDownload}
            onDelete={controller.onDelete}
            onOpenImagePreview={controller.onOpenImagePreview}
          />
        )}
      </div>

      <AssetDownloadNotice
        downloadNotice={controller.downloadNotice}
        styles={styles}
      />
    </div>
  );
}
