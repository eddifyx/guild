import { io } from 'socket.io-client';
import { api, getServerUrl } from './api';
import { createSocketControlRuntime } from './features/crypto/socketControlRuntime.mjs';

let socket = null;
const socketControlRuntime = createSocketControlRuntime({
  apiRequestFn: api,
});

export async function flushPendingControlMessagesNow() {
  await socketControlRuntime.flushPendingControlMessagesNow();
}

export async function syncRoomSenderKeys(roomId, { includeDelivered = false, limit = 32 } = {}) {
  return socketControlRuntime.syncRoomSenderKeys(roomId, {
    includeDelivered,
    limit,
  });
}

export function requestRoomSenderKey(roomId, senderUserId) {
  return socketControlRuntime.requestRoomSenderKey({
    socket,
    roomId,
    senderUserId,
  });
}

export function connectSocket(token) {
  socketControlRuntime.clearPendingRoomSenderKeyRequests();
  if (socket) socket.disconnect();
  socket = io(getServerUrl(), {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  // Listen for incoming sender key and voice key distributions.
  // Route through the validated processing functions, not inline handlers.
  socket.on('dm:sender_key', socketControlRuntime.createDirectSenderKeyHandler());

  // Listen for room member removal and re-key sender keys for forward secrecy.
  socket.on('room:member_removed', socketControlRuntime.createRoomMemberRemovedHandler());
  socket.on('room:sender_key_requested', socketControlRuntime.createRoomSenderKeyRequestedHandler());
  socket.on('connect', socketControlRuntime.handleSocketConnect);
  socket.on('disconnect', socketControlRuntime.handleSocketDisconnect);

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  socketControlRuntime.reset();
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
