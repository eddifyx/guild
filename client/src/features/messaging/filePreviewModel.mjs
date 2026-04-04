export function formatFilePreviewSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function buildFilePreviewAttachmentModel(attachment) {
  const encKey = attachment?.encryptionKey || attachment?._encryptionKey || '';
  const encDigest = attachment?.encryptionDigest || attachment?._encryptionDigest || '';
  const serverUrl = attachment?.serverFileUrl || attachment?.fileUrl || attachment?.file_url || '';
  const localPreviewUrl = attachment?._previewUrl || null;
  const name = attachment?.originalFileName || attachment?._originalName || attachment?.fileName || attachment?.file_name || '';
  const type = attachment?.originalFileType || attachment?._originalType || attachment?.fileType || attachment?.file_type || '';
  const size = attachment?.originalFileSize || attachment?._originalSize || attachment?.fileSize || attachment?.file_size || 0;

  return {
    encKey,
    encDigest,
    serverUrl,
    localPreviewUrl,
    name,
    type,
    size,
    isEncrypted: !!encKey,
    isInlineMedia: type.startsWith('image/') || type.startsWith('video/') || type.startsWith('audio/'),
    attachmentKey: [serverUrl || '', encKey || '', encDigest || '', name || ''].join('|'),
  };
}

export function buildFilePreviewLayoutStyles(compact = false) {
  return {
    previewBoxStyle: compact
      ? {
          marginTop: 4,
          maxWidth: 220,
        }
      : {
          marginTop: 8,
          maxWidth: 400,
        },
    mediaStyle: compact
      ? {
          maxWidth: '100%',
          maxHeight: 136,
          width: 'auto',
          borderRadius: 8,
          cursor: 'pointer',
          objectFit: 'contain',
          background: 'rgba(4, 11, 4, 0.9)',
        }
      : {
          maxWidth: '100%',
          maxHeight: 300,
          borderRadius: 8,
          cursor: 'pointer',
        },
  };
}
