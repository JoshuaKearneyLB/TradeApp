import express from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth.js';
import { uploadJobPhoto, getJobPhotos, deleteJobPhoto, servePhoto } from '../controllers/uploads.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
    cb(null, `${Date.now()}-${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG and WebP images are allowed'));
    }
  },
});

const router = express.Router();

router.post('/jobs/:id/photos', authenticateToken, upload.single('photo'), uploadJobPhoto);
router.get('/jobs/:id/photos', authenticateToken, getJobPhotos);
router.delete('/photos/:photoId', authenticateToken, deleteJobPhoto);
// AUTHZ-07: Authenticated photo serving — participant check done inside servePhoto
router.get('/photos/:filename', authenticateToken, servePhoto);

export default router;
