const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');
const auth = require('../middleware/authMiddleware');
const { insertUploadedFile } = require('../db');

const uploadDir = path.join(__dirname, '..', '..', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

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
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return cb(new Error(`File type ${ext} is not allowed`));
    }
    cb(null, true);
  },
});

const router = express.Router();

function isPrivateChatAttachmentUpload(req) {
  return req.body?.scope === 'chat-attachment';
}

router.post('/', auth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileType = req.file.mimetype || mime.lookup(req.file.originalname) || 'application/octet-stream';

  if (!isPrivateChatAttachmentUpload(req)) {
    return res.json({
      fileUrl: `/uploads/${req.file.filename}`,
      fileName: req.file.originalname,
      fileType,
      fileSize: req.file.size,
    });
  }

  const fileId = uuidv4();

  try {
    insertUploadedFile.run(
      fileId,
      req.file.filename,
      req.userId,
      req.file.originalname,
      fileType,
      req.file.size,
      1
    );
  } catch (err) {
    try {
      require('fs').unlinkSync(path.join(uploadDir, req.file.filename));
    } catch {}
    throw err;
  }

  res.json({
    fileId,
    fileUrl: `/api/files/${fileId}`,
    fileName: req.file.originalname,
    fileType,
    fileSize: req.file.size,
  });
});

module.exports = router;
