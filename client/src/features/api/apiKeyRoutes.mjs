import { api } from './apiRuntime.mjs';

export async function uploadPreKeyBundle(bundle, deviceId = null) {
  return api('/api/keys/bundle', {
    method: 'POST',
    body: JSON.stringify(deviceId ? { ...bundle, deviceId } : bundle),
  });
}

export async function fetchPreKeyBundle(userId, deviceId = null) {
  if (deviceId) {
    return api(`/api/keys/bundle/${userId}/${encodeURIComponent(deviceId)}`);
  }
  return api(`/api/keys/bundle/${userId}`);
}

export async function fetchIdentityAttestation(userId) {
  return api(`/api/keys/identity/${userId}`);
}

export async function fetchDeviceIdentityRecords(userId) {
  return api(`/api/keys/identities/${userId}`);
}

export async function getOTPCount(deviceId = null) {
  const suffix = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : '';
  return api(`/api/keys/count${suffix}`);
}

export async function getKyberCount(deviceId = null) {
  const suffix = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : '';
  return api(`/api/keys/count-kyber${suffix}`);
}

export async function resetEncryptionKeys() {
  return api('/api/keys/reset', { method: 'DELETE' });
}

export async function replenishOTPs(oneTimePreKeys, deviceId = null) {
  return api('/api/keys/replenish', {
    method: 'POST',
    body: JSON.stringify(deviceId ? { oneTimePreKeys, deviceId } : { oneTimePreKeys }),
  });
}

export async function replenishKyberPreKeys(kyberPreKeys, deviceId = null) {
  return api('/api/keys/replenish-kyber', {
    method: 'POST',
    body: JSON.stringify(deviceId ? { kyberPreKeys, deviceId } : { kyberPreKeys }),
  });
}
