import { Response } from 'express';
import { query } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.js';

export async function createJob(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { categoryId, title, description, location, address, urgency, estimatedBudget, scheduledDate } = req.body;

    if (!categoryId || !title || !description || !address) {
      res.status(400).json({ error: 'categoryId, title, description, and address are required' });
      return;
    }

    let locationSQL = 'NULL';
    const params: unknown[] = [userId, categoryId, title, description, address, urgency || 'medium', estimatedBudget || null, scheduledDate || null];

    if (location?.latitude && location?.longitude) {
      params.push(location.longitude, location.latitude);
      locationSQL = `ST_SetSRID(ST_MakePoint($9, $10), 4326)::geography`;
    }

    const result = await query(
      `INSERT INTO jobs (customer_id, category_id, title, description, address, urgency, estimated_budget, scheduled_date, location)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ${locationSQL})
       RETURNING *,
         ST_Y(location::geometry) as latitude,
         ST_X(location::geometry) as longitude`,
      params
    );

    const job = formatJob(result.rows[0]);
    res.status(201).json(job);
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Browse open jobs — used by professionals to find work.
 * Only returns pending (open) jobs by default.
 */
export async function getJobs(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { status, categoryId, page = '1', limit = '20', lat, lng, radiusKm } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const params: unknown[] = [];
    let paramIndex = 1;

    // Location filter — must be added before other params so positions are known
    let locationCondition = '';
    let distanceSelect = '';
    let orderBy = 'ORDER BY j.created_at DESC';

    if (lat && lng) {
      const latNum = Number(lat);
      const lngNum = Number(lng);
      const radiusMeters = Number(radiusKm || 50) * 1000;
      const latIdx = paramIndex++;
      const lngIdx = paramIndex++;
      const radiusIdx = paramIndex++;
      params.push(lngNum, latNum, radiusMeters);

      locationCondition = `AND j.location IS NOT NULL
        AND ST_DWithin(j.location, ST_SetSRID(ST_MakePoint($${latIdx}, $${lngIdx}), 4326)::geography, $${radiusIdx})`;
      distanceSelect = `, ST_Distance(j.location, ST_SetSRID(ST_MakePoint($${latIdx}, $${lngIdx}), 4326)::geography) / 1000 AS distance_km`;
      orderBy = `ORDER BY distance_km ASC`;
    }

    let whereClause = `WHERE 1=1 ${locationCondition}`;

    if (status) {
      whereClause += ` AND j.status = $${paramIndex++}`;
      params.push(status);
    } else {
      whereClause += ` AND j.status = 'pending'`;
    }

    if (categoryId) {
      whereClause += ` AND j.category_id = $${paramIndex++}`;
      params.push(categoryId);
    }

    params.push(Number(limit), offset);

    const result = await query(
      `SELECT
         j.*,
         ST_Y(j.location::geometry) as latitude,
         ST_X(j.location::geometry) as longitude
         ${distanceSelect},
         u.first_name AS customer_first_name,
         u.last_name AS customer_last_name,
         sc.name AS category_name,
         sc.description AS category_description
       FROM jobs j
       JOIN users u ON j.customer_id = u.id
       JOIN service_categories sc ON j.category_id = sc.id
       ${whereClause}
       ${orderBy}
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      params
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM jobs j ${whereClause}`,
      params.slice(0, params.length - 2)
    );

    const jobs = result.rows.map(formatJobWithDetails);

    res.json({
      jobs,
      total: parseInt(countResult.rows[0].count),
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getJobById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT
         j.*,
         ST_Y(j.location::geometry) as latitude,
         ST_X(j.location::geometry) as longitude,
         cu.first_name AS customer_first_name,
         cu.last_name AS customer_last_name,
         cu.phone AS customer_phone,
         pu.first_name AS professional_first_name,
         pu.last_name AS professional_last_name,
         pu.phone AS professional_phone,
         pp.average_rating AS professional_rating,
         sc.name AS category_name,
         sc.description AS category_description
       FROM jobs j
       JOIN users cu ON j.customer_id = cu.id
       JOIN service_categories sc ON j.category_id = sc.id
       LEFT JOIN users pu ON j.professional_id = pu.id
       LEFT JOIN professional_profiles pp ON pu.id = pp.user_id
       WHERE j.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const row = result.rows[0];
    const job = {
      ...formatJob(row),
      customer: {
        firstName: row.customer_first_name,
        lastName: row.customer_last_name,
        phone: row.customer_phone,
      },
      professional: row.professional_id
        ? {
            firstName: row.professional_first_name,
            lastName: row.professional_last_name,
            phone: row.professional_phone,
            averageRating: row.professional_rating ? parseFloat(row.professional_rating) : 0,
          }
        : null,
      category: {
        name: row.category_name,
        description: row.category_description,
      },
    };

    res.json(job);
  } catch (error) {
    console.error('Get job by ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function acceptJob(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const jobResult = await query('SELECT * FROM jobs WHERE id = $1', [id]);
    if (jobResult.rows.length === 0) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const job = jobResult.rows[0];
    if (job.status !== 'pending') {
      res.status(400).json({ error: 'Job is no longer available' });
      return;
    }

    const result = await query(
      `UPDATE jobs SET professional_id = $1, status = 'accepted', accepted_at = NOW()
       WHERE id = $2 AND status = 'pending'
       RETURNING *,
         ST_Y(location::geometry) as latitude,
         ST_X(location::geometry) as longitude`,
      [userId, id]
    );

    if (result.rows.length === 0) {
      res.status(400).json({ error: 'Job is no longer available' });
      return;
    }

    res.json(formatJob(result.rows[0]));
  } catch (error) {
    console.error('Accept job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateJobStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { status } = req.body;

    const validTransitions: Record<string, string[]> = {
      accepted: ['in_progress', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
      pending: ['cancelled'],
    };

    const jobResult = await query('SELECT * FROM jobs WHERE id = $1', [id]);
    if (jobResult.rows.length === 0) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const job = jobResult.rows[0];

    if (job.customer_id !== userId && job.professional_id !== userId) {
      res.status(403).json({ error: 'Not authorized to update this job' });
      return;
    }

    const allowed = validTransitions[job.status];
    if (!allowed || !allowed.includes(status)) {
      res.status(400).json({ error: `Cannot transition from '${job.status}' to '${status}'` });
      return;
    }

    let extraSet = '';
    if (status === 'in_progress') extraSet = ', started_at = NOW()';
    if (status === 'completed') extraSet = ', completed_at = NOW()';

    const result = await query(
      `UPDATE jobs SET status = $1 ${extraSet}
       WHERE id = $2
       RETURNING *,
         ST_Y(location::geometry) as latitude,
         ST_X(location::geometry) as longitude`,
      [status, id]
    );

    if (status === 'completed' && job.professional_id) {
      await query(
        `UPDATE professional_profiles SET total_jobs_completed = total_jobs_completed + 1 WHERE user_id = $1`,
        [job.professional_id]
      );
    }

    res.json(formatJob(result.rows[0]));
  } catch (error) {
    console.error('Update job status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * My jobs — role-aware.
 * Customers see only their own posted jobs.
 * Professionals see only jobs assigned to them.
 */
export async function getMyJobs(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;

    const whereField = role === 'customer' ? 'j.customer_id' : 'j.professional_id';

    const result = await query(
      `SELECT
         j.*,
         ST_Y(j.location::geometry) as latitude,
         ST_X(j.location::geometry) as longitude,
         u.first_name AS customer_first_name,
         u.last_name AS customer_last_name,
         sc.name AS category_name,
         sc.description AS category_description
       FROM jobs j
       JOIN users u ON j.customer_id = u.id
       JOIN service_categories sc ON j.category_id = sc.id
       WHERE ${whereField} = $1
       ORDER BY j.created_at DESC`,
      [userId]
    );

    res.json({ jobs: result.rows.map(formatJobWithDetails) });
  } catch (error) {
    console.error('Get my jobs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Permanently delete a cancelled job.
 * Only the customer who created the job can delete it, and only if it is cancelled.
 */
export async function deleteJob(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const jobResult = await query('SELECT * FROM jobs WHERE id = $1', [id]);
    if (jobResult.rows.length === 0) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const job = jobResult.rows[0];

    if (job.customer_id !== userId) {
      res.status(403).json({ error: 'Only the customer who posted this job can remove it' });
      return;
    }

    if (job.status !== 'cancelled') {
      res.status(400).json({ error: 'Job must be cancelled before it can be removed' });
      return;
    }

    await query('DELETE FROM messages WHERE job_id = $1', [id]);
    await query('DELETE FROM notifications WHERE related_job_id = $1', [id]);
    await query('DELETE FROM ratings WHERE job_id = $1', [id]);
    await query('DELETE FROM jobs WHERE id = $1', [id]);

    res.json({ deleted: true });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ── helpers ──────────────────────────────────────────────────

function formatJob(row: any) {
  return {
    id: row.id,
    customerId: row.customer_id,
    professionalId: row.professional_id,
    categoryId: row.category_id,
    title: row.title,
    description: row.description,
    address: row.address,
    location: row.latitude && row.longitude
      ? { latitude: parseFloat(row.latitude), longitude: parseFloat(row.longitude) }
      : null,
    status: row.status,
    urgency: row.urgency,
    estimatedBudget: row.estimated_budget ? parseFloat(row.estimated_budget) : null,
    scheduledDate: row.scheduled_date,
    acceptedAt: row.accepted_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatJobWithDetails(row: any) {
  return {
    ...formatJob(row),
    distanceKm: row.distance_km != null ? parseFloat(row.distance_km) : null,
    customer: {
      firstName: row.customer_first_name,
      lastName: row.customer_last_name,
    },
    category: {
      name: row.category_name,
      description: row.category_description,
    },
  };
}
