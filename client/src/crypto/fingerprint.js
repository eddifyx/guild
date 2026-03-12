/**
 * /guild E2E Encryption — Safety Numbers (Fingerprints)
 *
 * v2: Uses libsignal's Fingerprint class via IPC for consistent safety
 * number generation (matches Signal's NumericFingerprint exactly).
 *
 * v1 fallback: Custom SHA-512 iteration for users still on old identity keys.
 */

import { getFingerprint } from './signalClient.js';
import { isE2EInitialized } from './sessionManager.js';

/**
 * Get the safety number for a conversation with another user.
 * Uses libsignal's Fingerprint class in the main process via IPC.
 *
 * @param {string} theirUserId
 * @param {string} [theirIdentityKeyBase64] — their identity public key (base64).
 *   If not provided, the server's stored key is used (requires prior session).
 * @returns {Promise<string|null>} formatted safety number, or null if unavailable
 */
export async function getSafetyNumberForUser(theirUserId, theirIdentityKeyBase64) {
  if (!isE2EInitialized()) return null;
  if (!theirIdentityKeyBase64) return null;

  try {
    const displayable = await getFingerprint(theirUserId, theirIdentityKeyBase64);
    // Format as 12 groups of 5 digits
    const groups = [];
    for (let i = 0; i < displayable.length; i += 5) {
      groups.push(displayable.slice(i, i + 5));
    }
    return groups.join(' ');
  } catch (err) {
    console.error('[Fingerprint] Failed to generate safety number:', err);
    return null;
  }
}
