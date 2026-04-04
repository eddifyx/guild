const express = require('express');
const auth = require('../middleware/authMiddleware');
const { listRawDMConversations, usersShareGuild } = require('../db');
const { filterVisibleDirectMessageConversations } = require('../domain/messaging/directMessages');

const router = express.Router();

router.get('/conversations', auth, (req, res) => {
  const conversations = filterVisibleDirectMessageConversations(
    listRawDMConversations(req.userId),
    {
      canUseDirectMessagesWithUser: (otherUserId) => usersShareGuild.get(req.userId, otherUserId),
    }
  );
  res.json(conversations);
});

module.exports = router;
