import { deleteUploadedFile, uploadEncryptedFile } from '../api';
import { encryptAttachment } from '../crypto/attachmentEncryption';
import { isE2EInitialized } from '../crypto/sessionManager';

export async function uploadChatAttachment(file) {
  if (!isE2EInitialized()) {
    throw new Error('End-to-end encryption is not ready yet. Reconnect and try again.');
  }

  const {
    encryptedBlob,
    key,
    digest,
    originalName,
    originalType,
    originalSize,
  } = await encryptAttachment(file);

  const result = await uploadEncryptedFile(encryptedBlob, `${file.name}.enc`);
  const previewUrl = originalType.startsWith('image/') ? URL.createObjectURL(file) : null;

  return {
    ...result,
    fileName: originalName,
    fileType: originalType,
    fileSize: originalSize,
    _encrypted: true,
    _encryptionKey: key,
    _encryptionDigest: digest,
    _originalName: originalName,
    _originalType: originalType,
    _originalSize: originalSize,
    _previewUrl: previewUrl,
  };
}

export async function deleteChatAttachmentUpload(fileData) {
  const fileId = fileData?.fileId;
  if (!fileId) return;
  await deleteUploadedFile(fileId);
}
