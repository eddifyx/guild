import { recordLaneDiagnostic } from '../../utils/laneDiagnostics.js';
import {
  applyVoicePeerMuteUpdate,
  applyVoicePeerSpeakingUpdate,
  getVoiceParticipantIds,
} from './voiceParticipantState.mjs';

export const VOICE_SOCKET_ACK_TIMEOUT_MS = 10_000;
export const VOICE_DISCONNECTED_ERROR_MESSAGE = 'Voice connection lost. Rejoin the channel.';
export const VOICE_SESSION_ENDED_ERROR_MESSAGE = 'Voice session ended. Rejoin the channel.';

export const VOICE_SOCKET_EVENT_NAMES = Object.freeze({
  disconnect: 'disconnect',
  join: 'voice:join',
  leave: 'voice:leave',
  createTransport: 'voice:create-transport',
  connectTransport: 'voice:connect-transport',
  produce: 'voice:produce',
  consume: 'voice:consume',
  resumeConsumer: 'voice:resume-consumer',
  toggleMute: 'voice:toggle-mute',
  toggleDeafen: 'voice:toggle-deafen',
  speaking: 'voice:speaking',
  channelUpdate: 'voice:channel-update',
  newProducer: 'voice:new-producer',
  producerClosed: 'voice:producer-closed',
  peerMuteUpdate: 'voice:peer-mute-update',
  channelDeleted: 'voice:channel-deleted',
});

export function createVoiceEmitAsync({
  socket,
  ackTimeoutMs = VOICE_SOCKET_ACK_TIMEOUT_MS,
  setTimeoutFn = (...args) => globalThis.window?.setTimeout?.(...args) ?? globalThis.setTimeout?.(...args),
  clearTimeoutFn = (...args) => globalThis.window?.clearTimeout?.(...args) ?? globalThis.clearTimeout?.(...args),
} = {}) {
  return function emitAsync(event, data) {
    if (!socket) {
      return Promise.reject(new Error('Voice connection unavailable'));
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      let timeoutId = null;

      const handleDisconnect = () => {
        if (settled) return;
        settled = true;
        if (timeoutId) {
          clearTimeoutFn(timeoutId);
        }
        socket.off(VOICE_SOCKET_EVENT_NAMES.disconnect, handleDisconnect);
        reject(new Error('Voice connection lost'));
      };

      const settle = (handler, value) => {
        if (settled) return;
        settled = true;
        if (timeoutId) {
          clearTimeoutFn(timeoutId);
        }
        socket.off(VOICE_SOCKET_EVENT_NAMES.disconnect, handleDisconnect);
        handler(value);
      };

      timeoutId = setTimeoutFn(() => {
        settle(reject, new Error(`Voice request timed out: ${event}`));
      }, ackTimeoutMs);

      socket.on(VOICE_SOCKET_EVENT_NAMES.disconnect, handleDisconnect);
      socket.emit(event, data, (response) => {
        if (!response) {
          settle(reject, new Error('No response from server'));
          return;
        }
        if (response.ok) {
          settle(resolve, response);
          return;
        }
        settle(reject, new Error(response.error || 'Socket call failed'));
      });
    });
  };
}

export function createVoiceSocketRuntimeHandlers({
  currentUserId = null,
  getCurrentChannelId = () => null,
  rememberUsers = () => {},
  getUntrustedVoiceParticipants = () => [],
  buildVoiceTrustError = () => 'Secure voice is waiting for every participant\'s Nostr identity.',
  setJoinError = () => {},
  setVoiceE2E = () => {},
  setE2EWarning = () => {},
  leaveChannel = () => {},
  syncVoiceParticipants = async () => {},
  syncVoiceE2EState = async () => {},
  handleUnexpectedVoiceSessionEnd = async () => {},
  cleanupRemoteProducer = () => {},
  consumeProducer = async () => {},
  isExpectedVoiceTeardownError = () => false,
  setPeers = () => {},
  resetVoiceSession = async () => {},
  getParticipantIds = () => [],
  updateVoiceDiagnostics = () => {},
  resumeVoiceMediaAfterKeyUpdate = async () => ({ resumed: false }),
  diagnosticFn = recordLaneDiagnostic,
  setTimeoutFn = (...args) => globalThis.window?.setTimeout?.(...args) ?? globalThis.setTimeout?.(...args),
} = {}) {
  return {
    handleDisconnect() {
      void handleUnexpectedVoiceSessionEnd(VOICE_DISCONNECTED_ERROR_MESSAGE);
    },

    handleChannelUpdate({ channelId: updatedChannelId, participants }) {
      if (!updatedChannelId || updatedChannelId !== getCurrentChannelId()) return;
      const participantList = Array.isArray(participants) ? participants : [];
      rememberUsers(participantList);
      if (currentUserId && !participantList.some((participant) => participant.userId === currentUserId)) {
        void handleUnexpectedVoiceSessionEnd(VOICE_SESSION_ENDED_ERROR_MESSAGE, {
          channelId: updatedChannelId,
        });
        return;
      }

      const untrustedParticipants = getUntrustedVoiceParticipants(participantList);
      if (untrustedParticipants.length > 0) {
        const message = buildVoiceTrustError(participantList);
        setJoinError(message);
        setE2EWarning(message);
        void leaveChannel();
        return;
      }

      const participantIds = getVoiceParticipantIds(participantList);
      void syncVoiceParticipants(participantList, { channelId: updatedChannelId })
        .then(async () => {
          await syncVoiceE2EState(participantIds, {
            activeChannelId: updatedChannelId,
            feature: 'Voice chat',
          });
        })
        .catch(async (error) => {
          if (getCurrentChannelId() !== updatedChannelId || isExpectedVoiceTeardownError(error)) {
            return;
          }
          const message = error?.message || 'Secure voice could not synchronize channel participants.';
          setJoinError(message);
          setE2EWarning(message);
          await leaveChannel();
        });
    },

    async handleNewProducer({ producerId, producerUserId, source }) {
      diagnosticFn('voice', 'new_producer_socket', {
        channelId: getCurrentChannelId(),
        producerId,
        producerUserId,
        source: source || null,
      });
      if (!getCurrentChannelId()) return;

      try {
        await consumeProducer(getCurrentChannelId(), producerId, producerUserId, source);
      } catch (error) {
        if (isExpectedVoiceTeardownError(error)) {
          cleanupRemoteProducer(producerId, { producerUserId, source });
          return;
        }
        const message = error?.message || 'Secure media setup failed for a new participant.';
        cleanupRemoteProducer(producerId, { producerUserId, source });
        setJoinError(message);
        setE2EWarning(message);
        setTimeoutFn(() => {
          setJoinError((current) => (current === message ? null : current));
        }, 5000);
      }
    },

    handleProducerClosed({ producerId, producerUserId, source, getProducerUserEntries = null } = {}) {
      diagnosticFn('voice', 'producer_closed_socket', {
        channelId: getCurrentChannelId(),
        producerId: producerId || null,
        producerUserId: producerUserId || null,
        source: source || null,
      });
      if (producerId) {
        cleanupRemoteProducer(producerId, { producerUserId, source });
        return;
      }

      const producerEntries = typeof getProducerUserEntries === 'function'
        ? getProducerUserEntries()
        : [];
      for (const [existingProducerId, ownerId] of producerEntries) {
        if (ownerId !== producerUserId) continue;
        cleanupRemoteProducer(existingProducerId, { producerUserId, source });
      }
    },

    handlePeerMute({ userId, muted, deafened }) {
      setPeers((previousPeers) => applyVoicePeerMuteUpdate(previousPeers, {
        userId,
        muted,
        deafened,
      }));
    },

    handlePeerSpeaking({ userId, speaking }) {
      setPeers((previousPeers) => applyVoicePeerSpeakingUpdate(previousPeers, {
        userId,
        speaking,
      }));
    },

    async handleChannelDeleted({ channelId: deletedChannelId }) {
      if (!deletedChannelId || deletedChannelId !== getCurrentChannelId()) return;
      setJoinError('This voice channel was deleted.');
      setTimeoutFn(() => setJoinError(null), 5000);
      await resetVoiceSession({ channelId: deletedChannelId, notifyServer: false });
    },

    handleVoiceKeyUpdated(event) {
      const updatedChannelId = event?.detail?.channelId;
      if (!updatedChannelId || updatedChannelId !== getCurrentChannelId()) return false;

      setVoiceE2E(true);
      setE2EWarning(null);
      setJoinError((current) => (
        current && current.includes('secure media key') ? null : current
      ));
      updateVoiceDiagnostics((previousDiagnostics) => ({
        ...previousDiagnostics,
        session: {
          ...(previousDiagnostics.session || {}),
          secureVoice: {
            state: 'ready',
            channelId: updatedChannelId,
            participantCount: getParticipantIds().length,
            updatedAt: new Date().toISOString(),
            warning: null,
          },
        },
      }));
      void Promise.resolve(resumeVoiceMediaAfterKeyUpdate({
        channelId: updatedChannelId,
      })).catch((error) => {
        const message = error?.message || 'Secure voice recovered, but media restart failed.';
        setJoinError(message);
        setTimeoutFn(() => {
          setJoinError((current) => (current === message ? null : current));
        }, 5000);
      });
      return true;
    },
  };
}

export function registerVoiceSocketRuntimeSubscriptions(socket, handlers = {}) {
  if (!socket?.on || !socket?.off) {
    return () => {};
  }

  socket.on(VOICE_SOCKET_EVENT_NAMES.disconnect, handlers.handleDisconnect);
  socket.on(VOICE_SOCKET_EVENT_NAMES.channelUpdate, handlers.handleChannelUpdate);
  socket.on(VOICE_SOCKET_EVENT_NAMES.newProducer, handlers.handleNewProducer);
  socket.on(VOICE_SOCKET_EVENT_NAMES.producerClosed, handlers.handleProducerClosed);
  socket.on(VOICE_SOCKET_EVENT_NAMES.peerMuteUpdate, handlers.handlePeerMute);
  socket.on(VOICE_SOCKET_EVENT_NAMES.speaking, handlers.handlePeerSpeaking);
  socket.on(VOICE_SOCKET_EVENT_NAMES.channelDeleted, handlers.handleChannelDeleted);

  return () => {
    socket.off(VOICE_SOCKET_EVENT_NAMES.disconnect, handlers.handleDisconnect);
    socket.off(VOICE_SOCKET_EVENT_NAMES.channelUpdate, handlers.handleChannelUpdate);
    socket.off(VOICE_SOCKET_EVENT_NAMES.newProducer, handlers.handleNewProducer);
    socket.off(VOICE_SOCKET_EVENT_NAMES.producerClosed, handlers.handleProducerClosed);
    socket.off(VOICE_SOCKET_EVENT_NAMES.peerMuteUpdate, handlers.handlePeerMute);
    socket.off(VOICE_SOCKET_EVENT_NAMES.speaking, handlers.handlePeerSpeaking);
    socket.off(VOICE_SOCKET_EVENT_NAMES.channelDeleted, handlers.handleChannelDeleted);
  };
}
