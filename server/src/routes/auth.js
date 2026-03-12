const express = require('express');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
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
  res.json({ challenge });
});

// ---------------------------------------------------------------------------
// POST /nostr â€” Verify signed Nostr event + issue session token
// ---------------------------------------------------------------------------

router.post('/nostr', (req, res) => {
  try {
    const { signedEvent, displayName, lud16, profilePicture } = req.body;

    if (!signedEvent || typeof signedEvent !== 'object') {
      return res.status(400).json({ error: 'signedEvent is required' });
    }

    // 1. Verify event structure and Schnorr signature
    if (!verifyNostrEvent(signedEvent)) {
      return res.status(401).json({ error: 'Invalid event signature' });
    }

    // 2. Validate event kind (NIP-42 AUTH)
    if (signedEvent.kind !== 22242) {
      return res.status(400).json({ error: 'Invalid event kind â€” expected 22242' });
    }

    // 3. Extract and validate challenge from tags
    const challengeTag = signedEvent.tags.find(t => Array.isArray(t) && t[0] === 'challenge');
    if (!challengeTag || typeof challengeTag[1] !== 'string') {
      return res.status(400).json({ error: 'Missing challenge tag in event' });
    }

    const challenge = challengeTag[1];
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
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - signedEvent.created_at) > 300) {
      return res.status(401).json({ error: 'Event timestamp too far from current time' });
    }

    // 6. Derive npub from verified pubkey
    const npub = pubkeyToNpub(signedEvent.pubkey);

    // 7. Get or create user
    let user = getUserByNpub.get(npub);
    if (!user) {
      const id = uuidv4();
      let name = (displayName && displayName.trim())
        ? displayName.trim().slice(0, 30)
        : npub.slice(0, 8) + '...' + npub.slice(-4);
      const avatarColor = hashColor(npub);
      const userLud16 = (lud16 && lud16.trim()) ? lud16.trim() : null;
      const pic = sanitizeProfilePictureUrl(profilePicture);

      // Handle display name collisions with existing usernames
      try {
        createUserWithNpub.run(id, name, avatarColor, npub, userLud16, pic);
      } catch (insertErr) {
        if (insertErr.message && insertErr.message.includes('UNIQUE constraint failed')) {
          name = name.slice(0, 25) + '_' + crypto.randomBytes(3).toString('hex');
          createUserWithNpub.run(id, name, avatarColor, npub, userLud16, pic);
        } else {
          throw insertErr;
        }
      }
      user = { id, username: name, avatar_color: avatarColor, npub, lud16: userLud16, profile_picture: pic };
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
