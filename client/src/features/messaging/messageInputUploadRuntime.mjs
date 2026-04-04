export function createMessageInputAttachmentUploader({
  getUploading = () => false,
  setUploadingFn = () => {},
  setInputErrorFn = () => {},
  setPendingFilesFn = () => {},
  uploadAttachmentFn,
  logErrorFn = console.error,
}) {
  return async function uploadPendingAttachments(files, sourceLabel) {
    const uploadableFiles = Array.from(files || []).filter(Boolean);
    if (uploadableFiles.length === 0 || getUploading()) return [];

    setUploadingFn(true);
    setInputErrorFn('');
    try {
      const uploaded = [];
      for (const file of uploadableFiles) {
        uploaded.push(await uploadAttachmentFn(file));
      }
      setPendingFilesFn((prev) => [...prev, ...uploaded]);
      return uploaded;
    } catch (error) {
      logErrorFn(`${sourceLabel} upload failed:`, error);
      setInputErrorFn(error?.message || 'Secure attachment upload failed.');
      return [];
    } finally {
      setUploadingFn(false);
    }
  };
}

export function createPendingFileRemovalHandler({
  getPendingFiles = () => [],
  setPendingFilesFn = () => {},
  revokePreviewFn = () => {},
  deleteUploadFn = async () => {},
  warnFn = console.warn,
}) {
  return async function removePendingFile(index) {
    const file = getPendingFiles()[index];
    setPendingFilesFn((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
    revokePreviewFn(file);
    try {
      await deleteUploadFn(file);
    } catch (error) {
      warnFn('Failed to delete pending upload:', error?.message || error);
    }
  };
}
