import { Response } from 'express';
import { query } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.js';

export async function createRating(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { jobId, rating, comment } = req.body;

    if (!jobId || rating === undefined) {
      res.status(400).json({ error: 'jobId and rating are required' });
      return;
    }

    if (typeof rating !== 'number' || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      res.status(400).json({ error: 'rating must be an integer between 1 and 5' });
      return;
    }

    const jobResult = await query('SELECT * FROM jobs WHERE id = $1', [jobId]);
    if (jobResult.rows.length === 0) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const job = jobResult.rows[0];

    if (job.customer_id !== userId) {
      res.status(403).json({ error: 'Only the customer who posted this job can leave a rating' });
      return;
    }

    if (job.status !== 'completed') {
      res.status(400).json({ error: 'Job must be completed before it can be rated' });
      return;
    }

    if (!job.professional_id) {
      res.status(400).json({ error: 'No professional assigned to this job' });
      return;
    }

    const result = await query(
      `INSERT INTO ratings (job_id, customer_id, professional_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [jobId, userId, job.professional_id, rating, comment || null]
    );

    res.status(201).json(formatRating(result.rows[0]));
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'You have already rated this job' });
      return;
    }
    console.error('Create rating error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getJobRating(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;

    const result = await query(
      `SELECT r.*,
         u.first_name AS customer_first_name,
         u.last_name AS customer_last_name
       FROM ratings r
       JOIN users u ON r.customer_id = u.id
       WHERE r.job_id = $1`,
      [jobId]
    );

    if (result.rows.length === 0) {
      res.json({ rating: null });
      return;
    }

    const row = result.rows[0];
    res.json({
      rating: {
        ...formatRating(row),
        customer: {
          firstName: row.customer_first_name,
          lastName: row.customer_last_name,
        },
      },
    });
  } catch (error) {
    console.error('Get job rating error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function formatRating(row: any) {
  return {
    id: row.id,
    jobId: row.job_id,
    customerId: row.customer_id,
    professionalId: row.professional_id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
  };
}
