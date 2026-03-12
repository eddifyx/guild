const express = require('express');
const auth = require('../middleware/authMiddleware');
const { getRoomMessages, getDMMessages, getAttachmentsForMessages, isRoomMember, usersShareGuild } = require('../db');

const router = express.Router();

function attachFiles(messages) {
  const ids = messages.map(m => m.id);
  const attachmentMap = getAttachmentsForMessages(ids);
  return messages.map(m => ({
    ...m,
    attachments: attachmentMap[m.id] || [],
  }));
}

router.get('/room/:roomId', auth, (req, res) => {
  const member = isRoomMember.get(req.params.roomId, req.userId);
  if (!member) return res.status(403).json({ error: 'Not a member of this room' });
  const { before } = req.query;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const messages = getRoomMessages(req.params.roomId, before, limit);
  res.json(attachFiles(messages));
});

router.get('/dm/:otherUserId', auth, (req, res) => {
  if (!usersShareGuild.get(req.userId, req.params.otherUserId)) {
    return res.status(403).json({ error: 'Direct messages are only available while you share a guild with this user.' });
  }
  const { before } = req.query;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const messages = getDMMessages(req.userId, req.params.otherUserId, before, limit);
  res.json(attachFiles(messages));
});

module.exports = router;
