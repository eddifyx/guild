export function createAddonUploadAction({
  uploadAddonFn = async () => {},
  getDescriptionFn = () => '',
  setPendingFileFn = () => {},
  setUploadingFn = () => {},
  setUploadProgressFn = () => {},
  setUploadErrorFn = () => {},
  clearDescriptionFn = () => {},
  clearFileInputFn = () => {},
} = {}) {
  return async function handleUpload(file) {
    if (!file) return;
    setPendingFileFn({ name: file.name, size: file.size, type: file.type });
    setUploadingFn(true);
    setUploadProgressFn(0);
    setUploadErrorFn(null);
    try {
      await uploadAddonFn(file, getDescriptionFn().trim() || null, (pct) => setUploadProgressFn(pct));
      clearDescriptionFn();
      clearFileInputFn();
    } catch (error) {
      setUploadErrorFn(error?.message || 'Upload failed');
    }
    setPendingFileFn(null);
    setUploadingFn(false);
    setUploadProgressFn(0);
  };
}

export function createAddonDropAction({
  handleUploadFn = async () => {},
  setDragOverFn = () => {},
} = {}) {
  return function handleDrop(event) {
    event.preventDefault();
    setDragOverFn(false);
    const file = event?.dataTransfer?.files?.[0];
    if (file) {
      void handleUploadFn(file);
    }
  };
}

export function createAddonDownloadAction({
  triggerAddonDownloadFn = () => {},
  timerRef = { current: null },
  clearTimeoutFn = clearTimeout,
  setTimeoutFn = setTimeout,
  setDownloadNoticeFn = () => {},
} = {}) {
  return function handleDownload(fileName, url) {
    triggerAddonDownloadFn({ fileName, url });
    if (timerRef.current) clearTimeoutFn(timerRef.current);
    setDownloadNoticeFn(fileName);
    timerRef.current = setTimeoutFn(() => setDownloadNoticeFn(null), 3000);
  };
}

export function createAddonDeleteAction({
  deleteAddonFn = async () => {},
  logErrorFn = console.error,
} = {}) {
  return async function handleDelete(addonId) {
    try {
      await deleteAddonFn(addonId);
    } catch (error) {
      logErrorFn('Delete failed:', error);
    }
  };
}
