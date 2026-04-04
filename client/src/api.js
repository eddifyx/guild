import { uploadFileWithXhr, uploadFormDataWithAuth } from './features/api/uploadRuntime.mjs';
import {
  getAuthHeaders,
  getFileUrl,
  getServerUrl,
  handleSessionExpiry,
  toServerConnectionError,
} from './features/api/apiRuntime.mjs';
export { api, apiNoAuth, getServerUrl, getFileUrl, isInsecureConnection, resetSessionExpiry, setServerUrl, toServerConnectionError } from './features/api/apiRuntime.mjs';
export { checkLatestVersion } from './features/api/apiVersionRuntime.mjs';
export {
  fetchDeviceIdentityRecords,
  fetchIdentityAttestation,
  fetchPreKeyBundle,
  getKyberCount,
  getOTPCount,
  replenishKyberPreKeys,
  replenishOTPs,
  resetEncryptionKeys,
  uploadPreKeyBundle,
} from './features/api/apiKeyRoutes.mjs';
export {
  acceptFriendRequest,
  checkNpubs,
  deleteUploadedFile,
  getContacts,
  getIncomingRequests,
  getSentRequests,
  lookupUserByNpub,
  lookupUsersByNpubs,
  removeContact,
  rejectFriendRequest,
  sendFriendRequest,
} from './features/api/apiSocialRoutes.mjs';

export async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  return uploadFormDataWithAuth({
    endpoint: '/api/upload',
    formData,
    authHeaders: getAuthHeaders(),
    serverUrl: getServerUrl(),
    handleSessionExpiryFn: handleSessionExpiry,
    toServerConnectionErrorFn: (error) => toServerConnectionError(error),
    failureMessage: 'Upload failed',
  });
}

export function uploadAddonFile(file, description, onProgress) {
  const authHeaders = getAuthHeaders();
  return uploadFileWithXhr({
    endpoint: '/api/addons',
    file,
    description,
    authToken: authHeaders.Authorization?.replace(/^Bearer\s+/i, '') || null,
    onProgress,
    serverUrl: getServerUrl(),
    failureMessage: 'Addon upload failed',
    handleSessionExpiryFn: handleSessionExpiry,
  });
}

export async function uploadEncryptedFile(encryptedBlob, filename) {
  const formData = new FormData();
  formData.append('file', encryptedBlob, filename);
  formData.append('scope', 'chat-attachment');
  return uploadFormDataWithAuth({
    endpoint: '/api/upload',
    formData,
    authHeaders: getAuthHeaders(),
    serverUrl: getServerUrl(),
    handleSessionExpiryFn: handleSessionExpiry,
    toServerConnectionErrorFn: (error) => toServerConnectionError(error),
    failureMessage: 'Upload failed',
  });
}

export function uploadAssetFile(file, description, onProgress) {
  const authHeaders = getAuthHeaders();
  return uploadFileWithXhr({
    endpoint: '/api/assets',
    file,
    description,
    authToken: authHeaders.Authorization?.replace(/^Bearer\s+/i, '') || null,
    onProgress,
    serverUrl: getServerUrl(),
    failureMessage: 'Asset upload failed',
    handleSessionExpiryFn: handleSessionExpiry,
  });
}
