const express = require('express');
const auth = require('../middleware/authMiddleware');
const { getContactsByUser, removeContact } = require('../db');

const router = express.Router();

// List contacts
router.get('/', auth, (req, res) => {
  const contacts = getContactsByUser.all(req.userId);
  res.json(contacts);
});

// Remove contact
router.delete('/:npub', auth, (req, res) => {
  removeContact.run(req.userId, req.params.npub);
  const contacts = getContactsByUser.all(req.userId);
  res.json(contacts);
});

module.exports = router;
