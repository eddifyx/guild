import React, { useState, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useAddons } from '../../hooks/useAddons';
import { getFileUrl } from '../../api';
import {
  AddonDownloadNotice,
  AddonGrid,
  AddonUploadSection,
} from './AddonViewPanels.jsx';
import { buildPendingAddonUploadState } from '../../features/addons/addonViewModel.mjs';
import {
  createAddonDeleteAction,
  createAddonDownloadAction,
  createAddonDropAction,
  createAddonUploadAction,
} from '../../features/addons/addonViewRuntime.mjs';
import {
  openAddonImagePreviewWindow,
  triggerAddonDownload,
} from '../../features/addons/addonPreviewRuntime.mjs';

export default function AddonView() {
  const { user } = useAuth();
  const { addons, loading, uploadAddon, deleteAddon } = useAddons();
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [downloadNotice, setDownloadNotice] = useState(null);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);
  const downloadTimerRef = useRef(null);

  const handleUpload = useCallback(createAddonUploadAction({
    uploadAddonFn: uploadAddon,
    getDescriptionFn: () => description,
    setPendingFileFn: setPendingFile,
    setUploadingFn: setUploading,
    setUploadProgressFn: setUploadProgress,
    setUploadErrorFn: setUploadError,
    clearDescriptionFn: () => setDescription(''),
    clearFileInputFn: () => {
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
  }), [description, uploadAddon]);

  const handleDrop = useCallback(createAddonDropAction({
    handleUploadFn: handleUpload,
    setDragOverFn: setDragOver,
  }), [handleUpload]);

  const handleDownload = useCallback(createAddonDownloadAction({
    triggerAddonDownloadFn: triggerAddonDownload,
    timerRef: downloadTimerRef,
    setDownloadNoticeFn: setDownloadNotice,
  }), []);

  const handleDelete = useCallback(createAddonDeleteAction({
    deleteAddonFn: deleteAddon,
  }), [deleteAddon]);

  const pendingUpload = buildPendingAddonUploadState({
    pendingFile,
    uploadProgress,
  });

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-primary)',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Upload area */}
      <AddonUploadSection
        description={description}
        setDescription={setDescription}
        uploading={uploading}
        dragOver={dragOver}
        uploadError={uploadError}
        onClearUploadError={() => setUploadError(null)}
        onOpenFilePicker={() => !uploading && fileInputRef.current?.click()}
        onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      />
      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={(event) => {
        const file = event.target.files[0];
        if (file) handleUpload(file);
      }} />

      {/* Addon grid */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 20,
        }}
      >
        <AddonGrid
          loading={loading}
          addons={addons}
          pendingUpload={pendingUpload}
          currentUserId={user.userId}
          getFileUrlFn={getFileUrl}
          onOpenImagePreview={(url, fileName) => openAddonImagePreviewWindow({ url, name: fileName })}
          onDownload={handleDownload}
          onDelete={handleDelete}
        />
      </div>
      {downloadNotice && (
        <AddonDownloadNotice fileName={downloadNotice} />
      )}
    </div>
  );
}
