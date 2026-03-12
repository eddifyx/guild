const express = require('express');
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/authMiddleware');
const {
  getUserByNpub,
  getUserById,
  createFriendRequest,
  getPendingRequestsForUser,
  getSentRequests,
  getFriendRequest,
  getPendingBetween,
  acceptFriendRequest,
  deleteFriendRequest,
  addContact,
  getContactsByUser,
} = require('../db');

const router = express.Router();

// Send a friend request
router.post('/', auth, (req, res) => {
  const { toNpub } = req.body;
  if (!toNpub || typeof toNpub !== 'string' || !toNpub.startsWith('npub1')) {
    return res.status(400).json({ error: 'Valid npub required' });
  }

  const target = getUserByNpub.get(toNpub.trim());
  if (!target) {
    return res.status(404).json({ error: 'User not found on /guild' });
  }

  if (target.id === req.userId) {
    return res.status(400).json({ error: "You can't friend yourself" });
  }

  // Check if request already exists (in either direction)
  const existing = getPendingBetween.get(req.userId, target.id);
  if (existing) {
    return res.status(409).json({ error: 'Friend request already sent' });
  }
  const reverse = getPendingBetween.get(target.id, req.userId);
  if (reverse) {
    return res.status(409).json({ error: 'This user already sent you a request — check your incoming requests' });
  }

  // Check if already friends
  const contacts = getContactsByUser.all(req.userId);
  if (contacts.some(c => c.contact_npub === toNpub.trim())) {
    return res.status(409).json({ error: 'Already friends' });
  }

  const id = uuidv4();
  createFriendRequest.run(id, req.userId, target.id);

  // Notify recipient via socket
  if (router._io) {
    const sender = getUserById.get(req.userId);
    router._io.to(`user:${target.id}`).emit('friend:request-received', {
      id,
      from_user_id: req.userId,
      from_username: sender?.username,
      from_npub: sender?.npub,
      from_picture: sender?.profile_picture,
      created_at: new Date().toISOString(),
    });
  }

  res.json({ ok: true, id });
});

// List incoming pending requests
router.get('/incoming', auth, (req, res) => {
  const requests = getPendingRequestsForUser.all(req.userId);
  res.json(requests);
});

// List sent pending requests
router.get('/sent', auth, (req, res) => {
  const requests = getSentRequests.all(req.userId);
  res.json(requests);
});

// Accept a friend request
router.post('/:id/accept', auth, (req, res) => {
  const fr = getFriendRequest.get(req.params.id);
  if (!fr || fr.to_user_id !== req.userId || fr.status !== 'pending') {
    return res.status(404).json({ error: 'Request not found' });
  }

  acceptFriendRequest.run(fr.id);

  // Add both users to each other's contacts
  const sender = getUserById.get(fr.from_user_id);
  const recipient = getUserById.get(req.userId);
  if (sender && recipient) {
    addContact.run(req.userId, sender.npub, sender.username || '');
    addContact.run(fr.from_user_id, recipient.npub, recipient.username || '');
  }

  // Notify sender
  if (router._io) {
    router._io.to(`user:${fr.from_user_id}`).emit('friend:request-accepted', {
      id: fr.id,
      by_user_id: req.userId,
      by_username: recipient?.username,
      by_npub: recipient?.npub,
    });
  }

  res.json({ ok: true });
});

// Reject a friend request
router.post('/:id/reject', auth, (req, res) => {
  const fr = getFriendRequest.get(req.params.id);
  if (!fr || fr.to_user_id !== req.userId || fr.status !== 'pending') {
    return res.status(404).json({ error: 'Request not found' });
  }

  deleteFriendRequest.run(fr.id);

  // Notify sender
  if (router._io) {
    router._io.to(`user:${fr.from_user_id}`).emit('friend:request-rejected', {
      id: fr.id,
    });
  }

  res.json({ ok: true });
});

// Cancel a sent request
router.delete('/:id', auth, (req, res) => {
  const fr = getFriendRequest.get(req.params.id);
  if (!fr || fr.from_user_id !== req.userId || fr.status !== 'pending') {
    return res.status(404).json({ error: 'Request not found' });
  }

  deleteFriendRequest.run(fr.id);
  res.json({ ok: true });
});

module.exports = router;
