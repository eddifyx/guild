import React from 'react';
import { AssetCard, PendingAssetCard } from './AssetDumpCardViews.jsx';

export function AssetDumpGrid({
  assetCards,
  pendingAssetView,
  styles,
  onDownload,
  onDelete,
  onOpenImagePreview,
}) {
  return (
    <div style={styles.assetGrid}>
      <PendingAssetCard pendingAssetView={pendingAssetView} styles={styles} />
      {assetCards.map((asset) => (
        <AssetCard
          key={asset.id}
          asset={asset}
          styles={styles}
          onDownload={onDownload}
          onDelete={onDelete}
          onOpenImagePreview={onOpenImagePreview}
        />
      ))}
    </div>
  );
}
