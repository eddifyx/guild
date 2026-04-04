import { useCallback } from 'react';

import {
  uploadGuildChatPendingFiles,
  validateGuildChatAttachment,
} from './guildChatComposerFlow.mjs';
import {
  handleGuildChatDragEnter,
  handleGuildChatDragLeave,
  handleGuildChatDragOver,
  handleGuildChatFileDrop,
  handleGuildChatPasteUpload,
  removeGuildChatPendingUpload,
} from './guildChatUploadFlow.mjs';
import {
  buildGuildChatFileDropOptions,
  buildGuildChatPasteUploadOptions,
  buildGuildChatRemovePendingUploadOptions,
  buildGuildChatUploadPendingFilesOptions,
} from './guildChatDockControllerBindings.mjs';

export function revokeGuildChatPendingPreview(file) {
  if (file?._previewUrl) {
    URL.revokeObjectURL(file._previewUrl);
  }
}

export function useGuildChatDockControllerUploadRuntime({
  guildChat = {},
  state = {},
  refs = {},
} = {}) {
  const {
    uploadChatAttachmentFn = async () => null,
    deleteChatAttachmentUploadFn = async () => {},
    logErrorFn = () => {},
    warnFn = () => {},
  } = guildChat;

  const {
    canCompose = false,
    composerDisabledReason = '',
    dragActive = false,
    setPendingFilesFn = () => {},
    setLocalErrorFn = () => {},
    setDragActiveFn = () => {},
  } = state;

  const {
    pendingFilesRef = { current: [] },
    dragDepthRef = { current: 0 },
  } = refs;

  const uploadPendingFiles = useCallback(async (files, sourceLabel = 'Upload') => {
    await uploadGuildChatPendingFiles(buildGuildChatUploadPendingFilesOptions({
      files,
      sourceLabel,
      canCompose,
      composerDisabledReason,
      setLocalErrorFn,
      setPendingFilesFn,
      validateGuildChatAttachmentFn: validateGuildChatAttachment,
      uploadChatAttachmentFn,
      logErrorFn,
    }));
  }, [
    canCompose,
    composerDisabledReason,
    logErrorFn,
    setLocalErrorFn,
    setPendingFilesFn,
    uploadChatAttachmentFn,
  ]);

  const handlePaste = useCallback(async (event) => {
    await handleGuildChatPasteUpload(buildGuildChatPasteUploadOptions({
      event,
      uploadPendingFilesFn: uploadPendingFiles,
    }));
  }, [uploadPendingFiles]);

  const handleDragEnter = useCallback((event) => {
    handleGuildChatDragEnter({
      event,
      dragDepthRef,
      setDragActiveFn,
    });
  }, [dragDepthRef, setDragActiveFn]);

  const handleDragOver = useCallback((event) => {
    handleGuildChatDragOver({
      event,
      dragActive,
      setDragActiveFn,
    });
  }, [dragActive, setDragActiveFn]);

  const handleDragLeave = useCallback((event) => {
    handleGuildChatDragLeave({
      event,
      dragDepthRef,
      setDragActiveFn,
    });
  }, [dragDepthRef, setDragActiveFn]);

  const handleDrop = useCallback((event) => {
    handleGuildChatFileDrop(buildGuildChatFileDropOptions({
      event,
      dragDepthRef,
      setDragActiveFn,
      uploadPendingFilesFn: uploadPendingFiles,
    }));
  }, [dragDepthRef, setDragActiveFn, uploadPendingFiles]);

  const removePendingFile = useCallback(async (index) => {
    await removeGuildChatPendingUpload(buildGuildChatRemovePendingUploadOptions({
      index,
      pendingFilesRef,
      setPendingFilesFn,
      revokePreviewFn: revokeGuildChatPendingPreview,
      deleteChatAttachmentUploadFn,
      warnFn,
    }));
  }, [
    deleteChatAttachmentUploadFn,
    pendingFilesRef,
    setPendingFilesFn,
    warnFn,
  ]);

  return {
    handlePaste,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    removePendingFile,
  };
}
