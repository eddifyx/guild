function createSessionsRepository({ db }) {
  const createSession = db.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))"
  );
  const getSession = db.prepare(
    "SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')"
  );
  const deleteSession = db.prepare('DELETE FROM sessions WHERE token = ?');
  const deleteUserSessions = db.prepare('DELETE FROM sessions WHERE user_id = ?');
  const deleteExpiredSessions = db.prepare(
    "DELETE FROM sessions WHERE expires_at <= datetime('now')"
  );

  return {
    createSession,
    getSession,
    deleteSession,
    deleteUserSessions,
    deleteExpiredSessions,
  };
}

module.exports = {
  createSessionsRepository,
};
