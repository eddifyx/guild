const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');
const auth = require('../middleware/authMiddleware');
const {
  insertAddon, getAllAddons, getAddonById, deleteAddon,
} = require('../db');

const uploadDir = path.join(__dirname, '..', '..', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

// Block dangerous file types that could enable stored XSS or RCE.
const BLOCKED_EXTENSIONS = new Set([
  '.html', '.htm', '.xhtml', '.svg', '.xml',
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx',
  '.php', '.asp', '.aspx', '.jsp', '.cgi', '.pl',
  '.sh', '.bash', '.bat', '.cmd', '.ps1', '.psm1',
  '.exe', '.dll', '.so', '.dylib', '.msi',
  '.swf', '.xpi', '.crx',
]);

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return cb(new Error(`File type ${ext} is not allowed`));
    }
    cb(null, true);
  },
});

const router = express.Router();

// List all addons
router.get('/', auth, (req, res) => {
  const addons = getAllAddons.all();
  res.json(addons);
});

// Upload a new addon
router.post('/', auth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const id = uuidv4();
  const fileType = req.file.mimetype || mime.lookup(req.file.originalname) || 'application/octet-stream';
  const description = (req.body.description && typeof req.body.description === 'string')
    ? req.body.description.slice(0, 1000) : null;

  insertAddon.run(
    id,
    `/uploads/${req.file.filename}`,
    req.file.originalname,
    fileType,
    req.file.size,
    description,
    req.userId
  );

  // Re-query with uploader info
  const addons = getAllAddons.all();
  const full = addons.find(a => a.id === id);

  if (router._io) {
    router._io.emit('addon:uploaded', full);
  }

  res.status(201).json(full);
});

// Delete addon (uploader only)
router.delete('/:id', auth, (req, res) => {
  const addon = getAddonById.get(req.params.id);
  if (!addon) return res.status(404).json({ error: 'Addon not found' });
  if (addon.uploaded_by !== req.userId) {
    return res.status(403).json({ error: 'Only the uploader can delete this addon' });
  }

  // Delete file from disk
  const filePath = path.join(uploadDir, path.basename(addon.file_url));
  try { fs.unlinkSync(filePath); } catch (e) { /* file may already be gone */ }

  deleteAddon.run(req.params.id);

  if (router._io) {
    router._io.emit('addon:deleted', { addonId: req.params.id });
  }

  res.json({ success: true });
});

module.exports = router;
