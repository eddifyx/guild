function createUsersRepository({ db }) {
  const createUser = db.prepare(
    'INSERT INTO users (id, username, avatar_color) VALUES (?, ?, ?)'
  );
  const getUserByUsername = db.prepare('SELECT * FROM users WHERE username = ?');
  const getUserById = db.prepare('SELECT * FROM users WHERE id = ?');
  const getAllUsers = db.prepare('SELECT id, username, avatar_color, last_seen, npub, lud16 FROM users ORDER BY username');
  const updateLastSeen = db.prepare("UPDATE users SET last_seen = datetime('now') WHERE id = ?");
  const getUserByNpub = db.prepare('SELECT * FROM users WHERE npub = ?');
  const createUserWithNpub = db.prepare(
    'INSERT INTO users (id, username, avatar_color, npub, lud16, profile_picture) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const updateUserUsername = db.prepare('UPDATE users SET username = ? WHERE id = ?');
  const updateUserLud16 = db.prepare('UPDATE users SET lud16 = ? WHERE id = ?');
  const updateUserProfilePicture = db.prepare('UPDATE users SET profile_picture = ? WHERE id = ?');
  const updateUserStatus = db.prepare('UPDATE users SET custom_status = ? WHERE id = ?');

  return {
    createUser,
    getUserByUsername,
    getUserById,
    getAllUsers,
    updateLastSeen,
    getUserByNpub,
    createUserWithNpub,
    updateUserUsername,
    updateUserLud16,
    updateUserProfilePicture,
    updateUserStatus,
  };
}

module.exports = {
  createUsersRepository,
};
