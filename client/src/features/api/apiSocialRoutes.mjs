import { api } from './apiRuntime.mjs';

export async function checkNpubs(npubs) {
  return api('/api/users/check-npubs', {
    method: 'POST',
    body: JSON.stringify({ npubs }),
  });
}

export async function deleteUploadedFile(fileId) {
  return api(`/api/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
}

export async function lookupUsersByNpubs(npubs) {
  const result = await api('/api/users/lookup-npubs', {
    method: 'POST',
    body: JSON.stringify({ npubs }),
  });
  return Array.isArray(result?.users) ? result.users : [];
}

export async function lookupUserByNpub(npub) {
  const users = await lookupUsersByNpubs([npub]);
  return users[0] || null;
}

export async function getContacts() {
  return api('/api/contacts');
}

export async function removeContact(npub) {
  return api(`/api/contacts/${encodeURIComponent(npub)}`, {
    method: 'DELETE',
  });
}

export async function sendFriendRequest(toNpub) {
  return api('/api/friend-requests', {
    method: 'POST',
    body: JSON.stringify({ toNpub }),
  });
}

export async function getIncomingRequests() {
  return api('/api/friend-requests/incoming');
}

export async function getSentRequests() {
  return api('/api/friend-requests/sent');
}

export async function acceptFriendRequest(id) {
  return api(`/api/friend-requests/${id}/accept`, {
    method: 'POST',
  });
}

export async function rejectFriendRequest(id) {
  return api(`/api/friend-requests/${id}/reject`, {
    method: 'POST',
  });
}
