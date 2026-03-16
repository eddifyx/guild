const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { secp256k1, schnorr } = require('@noble/curves/secp256k1');
const { bytesToHex } = require('@noble/hashes/utils');
const {
  hashColor,
  getUserByNpub,
  createUserWithNpub,
  updateUserLud16,
  updateUserProfilePicture,
  addUserToGuildRooms,
  getUserGuilds,
  createSession,
  deleteSession,
  hashToken,
} = require('../db');
const { verifyNostrEvent, pubkeyToNpub } = require('../utils/nostrVerify');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
const LOGIN_COMPAT_KIND = 1;
const LOGIN_COMPAT_CONTENT = '/guild login';
const LOGIN_COMPAT_CLIENT = '/guild';
const AUTH_ENCRYPTION_SECRET = crypto.randomBytes(32);
const AUTH_ENCRYPTION_PUBKEY = bytesToHex(schnorr.getPublicKey(AUTH_ENCRYPTION_SECRET));

// Validate profile picture URL â€” only allow https:// schemes (reject javascript:, data:, etc.)
function sanitizeProfilePictureUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed.slice(0, 2048);
  return null;
}

// ---------------------------------------------------------------------------
// Challenge store (in-memory, short-lived)
// ---------------------------------------------------------------------------

const challenges = new Map();
const CHALLENGE_TTL = 300_000; // 5 minutes
const MAX_CHALLENGES = 10_000; // prevent memory exhaustion

function decryptNip04(ciphertextWithIv, senderPubkey) {
  if (typeof ciphertextWithIv !== 'string' || typeof senderPubkey !== 'string' || !/^[0-9a-f]{64}$/i.test(senderPubkey)) {
    throw new Error('Invalid NIP-04 payload');
  }

  const separatorIndex = ciphertextWithIv.lastIndexOf('?iv=');
  if (separatorIndex <= 0) {
    throw new Error('Missing NIP-04 IV');
  }

  const ciphertextB64 = ciphertextWithIv.slice(0, separatorIndex);
  const ivB64 = ciphertextWithIv.slice(separatorIndex + 4);
  const iv = Buffer.from(ivB64, 'base64');
  if (iv.length !== 16) {
    throw new Error('Invalid NIP-04 IV length');
  }

  const sharedPoint = secp256k1.getSharedSecret(AUTH_ENCRYPTION_SECRET, '02' + senderPubkey);
  const sharedX = Buffer.from(sharedPoint.slice(1, 33));
  const decipher = crypto.createDecipheriv('aes-256-cbc', sharedX, iv);
  let plaintext = decipher.update(ciphertextB64, 'base64', 'utf8');
  plaintext += decipher.final('utf8');
  return plaintext;
}

// Clean up expired challenges every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of challenges) {
    if (now >= val.expiresAt) challenges.delete(key);
  }
}, 60_000);

// ---------------------------------------------------------------------------
// GET /nostr/challenge â€” Issue a random challenge for login
// ---------------------------------------------------------------------------

router.get('/nostr/challenge', (req, res) => {
  // Prevent memory exhaustion from challenge flooding
  if (challenges.size >= MAX_CHALLENGES) {
    return res.status(429).json({ error: 'Too many pending challenges. Try again later.' });
  }

  const challenge = crypto.randomBytes(32).toString('hex');
  challenges.set(challenge, { expiresAt: Date.now() + CHALLENGE_TTL });
  res.json({
    challenge,
    authPubkey: AUTH_ENCRYPTION_PUBKEY,
  });
});

// ---------------------------------------------------------------------------
// POST /nostr â€” Verify signed Nostr event + issue session token
// ---------------------------------------------------------------------------

function isAcceptedLoginProofEvent(event) {
  if (!event || typeof event !== 'object') return false;

  if (event.kind === 22242) {
    return event.content === '' || event.content === '/guild login';
  }

  if (event.kind === LOGIN_COMPAT_KIND) {
    const clientTag = event.tags.find(t => Array.isArray(t) && t[0] === 'client');
    return clientTag?.[1] === LOGIN_COMPAT_CLIENT && event.content === LOGIN_COMPAT_CONTENT;
  }

  return false;
}

router.post('/nostr', (req, res) => {
  try {
    const { signedEvent, pubkey, nip04Ciphertext, displayName, lud16, profilePicture } = req.body;

    const isEventLogin = signedEvent && typeof signedEvent === 'object';
    const isNip04Login = typeof pubkey === 'string' && typeof nip04Ciphertext === 'string';

    if (!isEventLogin && !isNip04Login) {
      return res.status(400).json({ error: 'signedEvent or NIP-04 auth proof is required' });
    }

    let verifiedPubkey;
    let challenge;

    if (isEventLogin) {
      // 1. Verify event structure and Schnorr signature
      if (!verifyNostrEvent(signedEvent)) {
        return res.status(401).json({ error: 'Invalid event signature' });
      }

      // 2. Validate login proof kind/content
      if (!isAcceptedLoginProofEvent(signedEvent)) {
        return res.status(400).json({ error: 'Invalid login proof event' });
      }

      // 3. Extract and validate challenge from tags
      const challengeTag = signedEvent.tags.find(t => Array.isArray(t) && t[0] === 'challenge');
      if (!challengeTag || typeof challengeTag[1] !== 'string') {
        return res.status(400).json({ error: 'Missing challenge tag in event' });
      }

      challenge = challengeTag[1];
      verifiedPubkey = signedEvent.pubkey;
    } else {
      challenge = req.body.challenge;
      if (typeof challenge !== 'string') {
        return res.status(400).json({ error: 'challenge is required for NIP-04 auth proof' });
      }
      try {
        const decryptedChallenge = decryptNip04(nip04Ciphertext, pubkey);
        if (decryptedChallenge !== challenge) {
          return res.status(401).json({ error: 'Invalid NIP-04 auth proof' });
        }
      } catch (err) {
        return res.status(401).json({ error: 'Invalid NIP-04 auth proof' });
      }
      verifiedPubkey = pubkey;
    }

    const stored = challenges.get(challenge);
    if (!stored) {
      return res.status(401).json({ error: 'Unknown or expired challenge' });
    }
    if (Date.now() >= stored.expiresAt) {
      challenges.delete(challenge);
      return res.status(401).json({ error: 'Challenge expired' });
    }

    // 4. Consume challenge (one-time use)
    challenges.delete(challenge);

    // 5. Validate event timestamp (reject if >5 minutes old)
    if (isEventLogin) {
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - signedEvent.created_at) > 300) {
        return res.status(401).json({ error: 'Event timestamp too far from current time' });
      }
    }

    // 6. Derive npub from verified pubkey
    const npub = pubkeyToNpub(verifiedPubkey);

    // 7. Get or create user
    let user = getUserByNpub.get(npub);
    if (!user) {
      const id = uuidv4();
      const name = (displayName && displayName.trim())
        ? displayName.trim().slice(0, 30)
        : npub.slice(0, 8) + '...' + npub.slice(-4);
      const avatarColor = hashColor(npub);
      const userLud16 = (lud16 && lud16.trim()) ? lud16.trim() : null;
      const pic = sanitizeProfilePictureUrl(profilePicture);

      try {
        createUserWithNpub.run(id, name, avatarColor, npub, userLud16, pic);
      } catch (insertErr) {
        if (insertErr?.message?.includes('UNIQUE constraint failed')) {
          user = getUserByNpub.get(npub);
          if (!user) {
            throw insertErr;
          }
        }
      }
      if (!user) {
        user = { id, username: name, avatar_color: avatarColor, npub, lud16: userLud16, profile_picture: pic };
      }
    } else {
      // Update profile metadata if changed
      if (lud16 && lud16.trim() && lud16.trim() !== user.lud16) {
        updateUserLud16.run(lud16.trim(), user.id);
        user.lud16 = lud16.trim();
      }
      const pic = sanitizeProfilePictureUrl(profilePicture);
      if (pic && pic !== user.profile_picture) {
        updateUserProfilePicture.run(pic, user.id);
        user.profile_picture = pic;
      }
    }

    // 8. Auto-join all rooms in guilds the user belongs to
    const userGuilds = getUserGuilds.all(user.id);
    for (const guild of userGuilds) {
      addUserToGuildRooms(guild.id, user.id);
    }

    // 9. Generate session token (store SHA-256 hash â€” plaintext never hits the DB)
    const token = crypto.randomBytes(32).toString('hex');
    createSession.run(hashToken(token), user.id);

    res.json({
      userId: user.id,
      username: user.username,
      avatarColor: user.avatar_color,
      npub: user.npub,
      lud16: user.lud16 || null,
      profilePicture: user.profile_picture || null,
      token,
    });
  } catch (err) {
    console.error('Nostr login error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// ---------------------------------------------------------------------------
// POST /logout â€” Invalidate session token
// ---------------------------------------------------------------------------

router.post('/logout', authMiddleware, (req, res) => {
  const token = req.headers.authorization.slice(7);
  deleteSession.run(hashToken(token));
  res.json({ success: true });
});

module.exports = router;
