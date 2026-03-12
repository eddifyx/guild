const express = require('express');
const auth = require('../middleware/authMiddleware');
const { getVisibleUsers, getUserByNpub } = require('../db');

const router = express.Router();

let getOnlineUserIds = () => new Set();

router.setOnlineProvider = (fn) => { getOnlineUserIds = fn; };

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

module.exports = router;
