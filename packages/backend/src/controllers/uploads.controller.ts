import { Response } from 'express';
import { query } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { fileTypeFromFile } from 'file-type';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

// Only expose API-relative URL — serving is authenticated via servePhoto
function getPhotoUrl(filename: string): string {
  const base = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
  return `${base}/api/uploads/photos/${filename}`;
}

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

async function verifyParticipant(jobId: string, userId: string) {
  const result = await query(
    'SELECT customer_id, professional_id, status FROM jobs WHERE id = $1',
    [jobId],
  );
  if (result.rows.length === 0) return null;
  const job = result.rows[0];
  if (job.customer_id !== userId && job.professional_id !== userId) return null;
  return job;
}

const UPLOAD_ALLOWED_STATUSES = ['pending', 'accepted', 'in_progress', 'completed'];

export async function uploadJobPhoto(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { id: jobId } = req.params;
    const photoType = (req.query.type as string) === 'completion' ? 'completion' : 'problem';

    if (!UUID_RE.test(jobId)) {
      if (req.file) fs.unlink(req.file.path, () => {});
      res.status(400).json({ error: 'Invalid job ID' });
      return;
    }

    const job = await verifyParticipant(jobId, userId);
    if (!job) {
      if (req.file) fs.unlink(req.file.path, () => {});
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    if (!UPLOAD_ALLOWED_STATUSES.includes(job.status)) {
      if (req.file) fs.unlink(req.file.path, () => {});
      res.status(400).json({ error: 'Cannot upload photos to a cancelled job' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // FILE-01: Validate actual file content via magic bytes (not client-supplied Content-Type)
    const detected = await fileTypeFromFile(req.file.path);
    if (!detected || !ALLOWED_MIME.includes(detected.mime)) {
      fs.unlink(req.file.path, () => {});
      res.status(400).json({ error: 'File content is not a valid image (JPEG, PNG or WebP required)' });
      return;
    }

    // Check total photos for this job (max 20)
    const countResult = await query('SELECT COUNT(*) FROM job_photos WHERE job_id = $1', [jobId]);
    if (parseInt(countResult.rows[0].count) >= 20) {
      fs.unlink(req.file.path, () => {});
      res.status(400).json({ error: 'Maximum 20 photos per job' });
      return;
    }

    // FILE-02: Strip EXIF metadata (GPS coordinates, device info, etc.) using sharp
    const cleanPath = req.file.path + '.clean';
    await sharp(req.file.path).toFile(cleanPath);
    fs.unlink(req.file.path, () => {}); // remove original with EXIF
    fs.renameSync(cleanPath, req.file.path); // replace with clean version

    const result = await query(
      `INSERT INTO job_photos (job_id, uploaded_by, filename, original_name, photo_type)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [jobId, userId, req.file.filename, req.file.originalname, photoType],
    );

    const photo = result.rows[0];
    res.status(201).json({
      id: photo.id,
      jobId,
      uploadedBy: userId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      photoType,
      url: getPhotoUrl(req.file.filename),
      createdAt: photo.created_at,
    });
  } catch (error) {
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error('Upload job photo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getJobPhotos(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { id: jobId } = req.params;

    if (!UUID_RE.test(jobId)) {
      res.status(400).json({ error: 'Invalid job ID' });
      return;
    }

    const job = await verifyParticipant(jobId, userId);
    if (!job) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const result = await query(
      `SELECT p.id, p.job_id, p.uploaded_by, p.filename, p.original_name, p.photo_type, p.created_at,
              u.first_name, u.last_name
       FROM job_photos p
       JOIN users u ON u.id = p.uploaded_by
       WHERE p.job_id = $1
       ORDER BY p.created_at ASC`,
      [jobId],
    );

    res.json({
      photos: result.rows.map((r: any) => ({
        id: r.id,
        jobId: r.job_id,
        uploadedBy: r.uploaded_by,
        uploaderName: `${r.first_name} ${r.last_name}`,
        filename: r.filename,
        originalName: r.original_name,
        photoType: r.photo_type,
        url: getPhotoUrl(r.filename),
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    console.error('Get job photos error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteJobPhoto(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { photoId } = req.params;

    if (!UUID_RE.test(photoId)) {
      res.status(400).json({ error: 'Invalid photo ID' });
      return;
    }

    const result = await query(
      'SELECT id, uploaded_by, filename FROM job_photos WHERE id = $1',
      [photoId],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Photo not found' });
      return;
    }

    const photo = result.rows[0];
    if (photo.uploaded_by !== userId) {
      res.status(403).json({ error: 'You can only delete your own photos' });
      return;
    }

    await query('DELETE FROM job_photos WHERE id = $1', [photoId]);

    const filePath = path.join(UPLOADS_DIR, photo.filename);
    fs.unlink(filePath, (err) => {
      if (err) console.error('Failed to delete file:', err);
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete job photo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// AUTHZ-07: Authenticated photo serving — verifies requester is a participant on the owning job
export async function servePhoto(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { filename } = req.params;

    // Reject anything that looks like a path traversal attempt
    if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      res.status(400).json({ error: 'Invalid filename' });
      return;
    }

    // Confirm the photo belongs to a job this user participates in
    const result = await query(
      `SELECT jp.filename, jp.job_id
       FROM job_photos jp
       JOIN jobs j ON j.id = jp.job_id
       WHERE jp.filename = $1
         AND (j.customer_id = $2 OR j.professional_id = $2)`,
      [filename, userId],
    );

    if (result.rows.length === 0) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const filePath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Photo not found' });
      return;
    }

    res.sendFile(filePath);
  } catch (error) {
    console.error('Serve photo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
