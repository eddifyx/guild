const { getSession, hashToken } = require('../db');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.slice(7);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const session = getSession.get(hashToken(token));
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  req.userId = session.user_id;
  next();
}

module.exports = authMiddleware;
