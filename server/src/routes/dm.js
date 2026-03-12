const express = require('express');
const auth = require('../middleware/authMiddleware');
const { getDMConversations } = require('../db');

const router = express.Router();

router.get('/conversations', auth, (req, res) => {
  const conversations = getDMConversations(req.userId);
  res.json(conversations);
});

module.exports = router;
