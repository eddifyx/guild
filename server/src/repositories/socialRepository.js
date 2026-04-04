function createSocialRepository({ db }) {
  const getContactsByUser = db.prepare(
    'SELECT contact_npub, display_name, added_at FROM contacts WHERE user_id = ? ORDER BY added_at DESC'
  );
  const addContact = db.prepare(
    'INSERT OR IGNORE INTO contacts (user_id, contact_npub, display_name) VALUES (?, ?, ?)'
  );
  const removeContact = db.prepare(
    'DELETE FROM contacts WHERE user_id = ? AND contact_npub = ?'
  );

  const createFriendRequest = db.prepare(
    'INSERT INTO friend_requests (id, from_user_id, to_user_id) VALUES (?, ?, ?)'
  );
  const getPendingRequestsForUser = db.prepare(`
    SELECT fr.id, fr.from_user_id, fr.created_at,
           u.username AS from_username, u.npub AS from_npub,
           u.avatar_color AS from_color, u.profile_picture AS from_picture
    FROM friend_requests fr
    JOIN users u ON fr.from_user_id = u.id
    WHERE fr.to_user_id = ? AND fr.status = 'pending'
    ORDER BY fr.created_at DESC
  `);
  const getSentRequests = db.prepare(`
    SELECT fr.id, fr.to_user_id, fr.created_at, u.npub AS to_npub
    FROM friend_requests fr
    JOIN users u ON fr.to_user_id = u.id
    WHERE fr.from_user_id = ? AND fr.status = 'pending'
  `);
  const getFriendRequest = db.prepare(
    'SELECT * FROM friend_requests WHERE id = ?'
  );
  const getPendingBetween = db.prepare(
    "SELECT * FROM friend_requests WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'"
  );
  const acceptFriendRequest = db.prepare(
    "UPDATE friend_requests SET status = 'accepted' WHERE id = ?"
  );
  const deleteFriendRequest = db.prepare(
    'DELETE FROM friend_requests WHERE id = ?'
  );

  return {
    getContactsByUser,
    addContact,
    removeContact,
    createFriendRequest,
    getPendingRequestsForUser,
    getSentRequests,
    getFriendRequest,
    getPendingBetween,
    acceptFriendRequest,
    deleteFriendRequest,
  };
}

module.exports = {
  createSocialRepository,
};
