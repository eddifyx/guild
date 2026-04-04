import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getFileUrl } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { useAssets } from '../../hooks/useAssets';
import {
  buildAssetCardView,
  buildPendingAssetView,
} from './assetDumpModel.mjs';
import {
  openAssetImagePreviewWindow,
  triggerAssetDownload,
} from './assetDumpRuntime.mjs';

export function useAssetDumpController() {
  const { user } = useAuth();
  const { assets, loading, uploadAsset, deleteAsset } = useAssets();
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);
  const [downloadNotice, setDownloadNotice] = useState(null);
  const [, setTick] = useState(0);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);
  const downloadTimerRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => setTick((value) => value + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => () => {
    if (downloadTimerRef.current) {
      clearTimeout(downloadTimerRef.current);
    }
  }, []);

  const handleUpload = useCallback(async (file) => {
    if (!file) return;
    setPendingFile({ name: file.name, size: file.size, type: file.type });
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    try {
      await uploadAsset(file, description.trim() || null, (pct) => setUploadProgress(pct));
      setDescription('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setUploadError(err.message || 'Upload failed');
    }
    setPendingFile(null);
    setUploading(false);
    setUploadProgress(0);
  }, [description, uploadAsset]);

  const handleDrop = useCallback((event) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file) void handleUpload(file);
  }, [handleUpload]);

  const handleDownload = useCallback((fileName, url) => {
    triggerAssetDownload({ fileName, url });
    if (downloadTimerRef.current) clearTimeout(downloadTimerRef.current);
    setDownloadNotice(fileName);
    downloadTimerRef.current = setTimeout(() => setDownloadNotice(null), 3000);
  }, []);

  const handleDelete = useCallback(async (assetId) => {
    try {
      await deleteAsset(assetId);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }, [deleteAsset]);

  const assetCards = useMemo(() => (
    assets.map((asset) => buildAssetCardView({
      asset,
      currentUserId: user?.userId,
      getFileUrlFn: getFileUrl,
    }))
  ), [assets, user?.userId]);

  const pendingAssetView = useMemo(() => (
    buildPendingAssetView(pendingFile, uploadProgress)
  ), [pendingFile, uploadProgress]);

  return {
    loading,
    uploading,
    description,
    dragOver,
    uploadError,
    downloadNotice,
    pendingAssetView,
    assetCards,
    hasAssets: assets.length > 0,
    fileInputRef,
    scrollRef,
    onDescriptionChange: setDescription,
    onSetDragOver: setDragOver,
    onClearUploadError: () => setUploadError(null),
    onFileInput: (event) => {
      const file = event.target.files[0];
      if (file) void handleUpload(file);
    },
    onBrowse: () => fileInputRef.current?.click(),
    onDrop: handleDrop,
    onDownload: handleDownload,
    onDelete: handleDelete,
    onOpenImagePreview: ({ url, name }) => openAssetImagePreviewWindow({ url, name }),
  };
}
