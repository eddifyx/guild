import React, { memo } from 'react';

import {
  AddonCardView,
  AddonDownloadNoticeView,
  AddonEmptyStateView,
  AddonGridView,
  AddonPendingAddonCardView,
  AddonUploadSectionView,
} from './AddonViewPanelsContent.jsx';
import {
  buildAddonCardPanelState,
  buildAddonDownloadNoticeState,
  buildAddonGridPanelState,
  buildAddonUploadSectionState,
  buildPendingAddonCardState,
} from '../../features/addons/addonPanelsModel.mjs';

export const AddonUploadSection = memo(function AddonUploadSection({
  description,
  setDescription,
  uploading = false,
  dragOver = false,
  uploadError = null,
  onClearUploadError = () => {},
  onOpenFilePicker = () => {},
  onDragOver = () => {},
  onDragLeave = () => {},
  onDrop = () => {},
}) {
  const uploadSectionState = buildAddonUploadSectionState({
    uploading,
    dragOver,
    uploadError,
  });

  return (
    <AddonUploadSectionView
      description={description}
      setDescription={setDescription}
      uploadSectionState={uploadSectionState}
      dragOver={dragOver}
      uploadError={uploadError}
      onClearUploadError={onClearUploadError}
      onOpenFilePicker={onOpenFilePicker}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    />
  );
});

export const PendingAddonCard = memo(function PendingAddonCard({
  pendingUpload,
}) {
  const pendingAddon = buildPendingAddonCardState({
    pendingUpload,
  });

  return (
    <AddonPendingAddonCardView pendingAddon={pendingAddon} />
  );
});

export const AddonCard = memo(function AddonCard({
  addon,
  currentUserId = null,
  getFileUrlFn = (value) => value,
  onOpenImagePreview = () => {},
  onDownload = () => {},
  onDelete = () => {},
}) {
  const addonState = buildAddonCardPanelState({
    addon,
    currentUserId,
    getFileUrlFn,
  });

  return (
    <AddonCardView
      addon={addon}
      addonState={addonState}
      onOpenImagePreview={onOpenImagePreview}
      onDownload={onDownload}
      onDelete={onDelete}
    />
  );
});

export const AddonEmptyState = memo(function AddonEmptyState() {
  return <AddonEmptyStateView />;
});

export const AddonDownloadNotice = memo(function AddonDownloadNotice({
  fileName,
}) {
  const noticeState = buildAddonDownloadNoticeState({ fileName });

  return <AddonDownloadNoticeView noticeLabel={noticeState.label} />;
});

export const AddonGrid = memo(function AddonGrid({
  loading = false,
  addons = [],
  pendingUpload = null,
  currentUserId = null,
  getFileUrlFn = (value) => value,
  onOpenImagePreview = () => {},
  onDownload = () => {},
  onDelete = () => {},
}) {
  const emptyState = buildAddonGridPanelState({ loading, addons, pendingUpload });

  if (emptyState.showLoading) {
    return <AddonGridView emptyState={emptyState} />;
  }

  if (emptyState.showEmpty) {
    return <AddonEmptyState />;
  }

  const pendingAddon = buildPendingAddonCardState({
    pendingUpload,
  });

  const addonItems = addons.map((addon) => ({
    addon,
    addonState: buildAddonCardPanelState({
      addon,
      currentUserId,
      getFileUrlFn,
    }),
  }));

  return (
    <AddonGridView
      emptyState={emptyState}
      pendingAddon={pendingAddon}
      addonItems={addonItems}
      onOpenImagePreview={onOpenImagePreview}
      onDownload={onDownload}
      onDelete={onDelete}
    />
  );
});
