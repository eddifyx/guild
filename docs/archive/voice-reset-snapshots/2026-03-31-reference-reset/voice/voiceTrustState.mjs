import { hasKnownNpub } from '../../crypto/identityDirectory.js';
import { normalizeVoiceParticipants } from './voiceParticipantState.mjs';

export function getUntrustedVoiceParticipants(participants, {
  currentUserId = null,
  hasKnownNpubFn = hasKnownNpub,
} = {}) {
  return normalizeVoiceParticipants(participants).filter((participant) => (
    participant.userId !== currentUserId
    && !hasKnownNpubFn(participant.userId, participant.npub || null)
  ));
}

export function buildVoiceTrustError(participants, {
  currentUserId = null,
  hasKnownNpubFn = hasKnownNpub,
} = {}) {
  const names = Array.from(new Set(
    getUntrustedVoiceParticipants(participants, {
      currentUserId,
      hasKnownNpubFn,
    }).map((participant) => participant.username || 'an untrusted participant')
  ));

  if (names.length === 0) {
    return 'Secure voice is waiting for every participant\'s Nostr identity.';
  }
  if (names.length === 1) {
    return `Secure voice is waiting for ${names[0]}'s Nostr identity.`;
  }
  if (names.length === 2) {
    return `Secure voice is waiting for ${names[0]} and ${names[1]}.`;
  }
  return `Secure voice is waiting for ${names.slice(0, 3).join(', ')}.`;
}
