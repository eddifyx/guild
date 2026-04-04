const express = require('express');
const fs = require('fs');
const path = require('path');
const {
  getUploadedFileById,
  deleteUploadedFileRecord,
  getSession,
  hashToken,
  isRoomMember,
  isGuildMember,
  usersShareGuild,
} = require('../db');
const auth = require('../middleware/authMiddleware');

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
const router = express.Router();

function resolveAuthenticatedUser(req) {
  const queryToken = Array.isArray(req.query.token) ? req.query.token[0] : req.query.token;
  const token = queryToken ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  if (!token) return null;
  const session = getSession.get(hashToken(token));
  return session?.user_id || null;
}

function canAccessUploadedFile(file, userId) {
  if (!file || !userId) return false;
  if (file.uploaded_by === userId) return true;
  if (file.guildchat_guild_id) {
    return !!isGuildMember.get(file.guildchat_guild_id, userId);
  }
  if (!file.message_id) return false;
  if (file.room_id) {
    return !!isRoomMember.get(file.room_id, userId);
  }
  if (file.dm_user_a && file.dm_user_b) {
    if (file.dm_user_a !== userId && file.dm_user_b !== userId) {
      return false;
    }
    return !!usersShareGuild.get(file.dm_user_a, file.dm_user_b);
  }
  return false;
}

router.get('/:id', (req, res) => {
  try {
    const userId = resolveAuthenticatedUser(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const file = getUploadedFileById.get(req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (!canAccessUploadedFile(file, userId)) {
      return res.status(403).json({ error: 'Not authorized to access this file' });
    }

    const diskPath = path.join(uploadDir, path.basename(file.stored_name || ''));
    if (!file.stored_name || !fs.existsSync(diskPath)) {
      return res.status(404).json({ error: 'File missing from storage' });
    }

    const inlineTypes = new Set([
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/avif',
      'video/mp4', 'video/webm', 'audio/mpeg', 'audio/ogg', 'audio/wav',
    ]);
    const stats = fs.statSync(diskPath);
    res.setHeader('Content-Disposition', inlineTypes.has(file.file_type) ? 'inline' : 'attachment');
    res.setHeader('Content-Type', file.file_type || 'application/octet-stream');
    res.setHeader('Content-Length', String(stats.size));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    const stream = fs.createReadStream(diskPath);
    stream.on('error', (err) => {
      console.error('[Files] Failed to stream ' + req.params.id + ':', err);
      if (!res.headersSent) {
        const status = err && err.code === 'ENOENT' ? 404 : 500;
        res.status(status).json({ error: status === 404 ? 'File missing from storage' : 'Failed to stream file' });
        return;
      }
      res.destroy(err);
    });
    stream.pipe(res);
  } catch (err) {
    console.error('[Files] Unexpected error serving ' + req.params.id + ':', err);
    return res.status(500).json({ error: 'Failed to stream file' });
  }
});

router.delete('/:id', auth, (req, res) => {
  const file = getUploadedFileById.get(req.params.id);
  if (!file) return res.status(404).json({ error: 'File not found' });
  if (file.uploaded_by !== req.userId) {
    return res.status(403).json({ error: 'Only the uploader can delete this file' });
  }
  if (file.message_id || file.guildchat_message_id) {
    return res.status(409).json({ error: 'This file is already attached to a message' });
  }

  const diskPath = path.join(uploadDir, path.basename(file.stored_name));
  try {
    if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
  } catch (err) {
    console.warn('[Files] Failed to delete upload:', err.message);
  }
  deleteUploadedFileRecord.run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
