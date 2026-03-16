const express = require('express');
const auth = require('../middleware/authMiddleware');
const {
  getVisibleUsers,
  getUserByNpub,
  getUserById,
  updateUserUsername,
  updateUserLud16,
  updateUserProfilePicture,
} = require('../db');
const { broadcastPresenceUpdates } = require('../socket/presenceHandler');

const router = express.Router();

let getOnlineUserIds = () => new Set();

router.setOnlineProvider = (fn) => { getOnlineUserIds = fn; };

function normalizeDisplayName(name, fallback) {
  if (typeof name !== 'string') return fallback;
  const trimmed = name.trim().slice(0, 30);
  return trimmed || fallback;
}

function parseProfilePictureUrl(url) {
  if (url == null) return { ok: true, value: null };
  if (typeof url !== 'string') return { ok: false, value: null };
  const trimmed = url.trim();
  if (!trimmed) return { ok: true, value: null };
  if (!/^https?:\/\//i.test(trimmed)) return { ok: false, value: null };
  return { ok: true, value: trimmed.slice(0, 2048) };
}

router.get('/', auth, (req, res) => {
  const onlineIds = getOnlineUserIds();
  const users = getVisibleUsers(req.userId);
  res.json(users.map((user) => ({ ...user, online: onlineIds.has(user.id) })));
});

router.post('/lookup-npubs', auth, (req, res) => {
  const { npubs } = req.body;
  if (!Array.isArray(npubs)) {
    return res.status(400).json({ error: 'npubs array required' });
  }

  const users = [];
  const seen = new Set();
  for (const rawNpub of npubs) {
    if (typeof rawNpub !== 'string') continue;
    const npub = rawNpub.trim();
    if (!npub.startsWith('npub1') || seen.has(npub)) continue;
    seen.add(npub);
    const user = getUserByNpub.get(npub);
    if (!user || user.id.startsWith('system-')) continue;
    users.push({
      id: user.id,
      username: user.username,
      avatar_color: user.avatar_color,
      profile_picture: user.profile_picture,
      npub: user.npub,
    });
  }

  res.json({ users });
});

router.post('/check-npubs', auth, (req, res) => {
  const { npubs } = req.body;
  if (!Array.isArray(npubs)) {
    return res.status(400).json({ error: 'npubs array required' });
  }
  const registered = npubs.filter((npub) => typeof npub === 'string' && getUserByNpub.get(npub));
  res.json({ registered });
});

router.get('/online', auth, (req, res) => {
  const onlineIds = getOnlineUserIds();
  const users = getVisibleUsers(req.userId)
    .filter((user) => onlineIds.has(user.id))
    .map((user) => ({ ...user, online: true }));
  res.json(users);
});

router.put('/me/nostr-profile', auth, (req, res) => {
  const user = getUserById.get(req.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const nextUsername = normalizeDisplayName(req.body?.displayName, user.username);

  const { ok: pictureOk, value: nextPicture } = parseProfilePictureUrl(req.body?.profilePicture);
  if (!pictureOk) {
    return res.status(400).json({ error: 'Profile picture must be an http(s) URL' });
  }

  const rawLud16 = typeof req.body?.lud16 === 'string' ? req.body.lud16.trim() : '';
  const nextLud16 = rawLud16 ? rawLud16.slice(0, 320) : null;

  try {
    if (nextUsername !== user.username) {
      updateUserUsername.run(nextUsername, user.id);
    }
    if ((user.lud16 || null) !== nextLud16) {
      updateUserLud16.run(nextLud16, user.id);
    }
    if ((user.profile_picture || null) !== nextPicture) {
      updateUserProfilePicture.run(nextPicture, user.id);
    }
  } catch (err) {
    throw err;
  }

  const updated = getUserById.get(user.id);

  if (router._io) {
    broadcastPresenceUpdates(router._io);
  }

  res.json({
    userId: updated.id,
    username: updated.username,
    avatarColor: updated.avatar_color,
    npub: updated.npub || null,
    lud16: updated.lud16 || null,
    profilePicture: updated.profile_picture || null,
  });
});

module.exports = router;
