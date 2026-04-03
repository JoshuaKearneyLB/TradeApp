import { Response } from 'express';
import { query } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { getIO } from '../socket/index.js';
import { NotificationType } from '@tradeapp/shared';

export async function createJob(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { categoryId, title, description, location, address, urgency, estimatedBudget, scheduledDate } = req.body;

    if (!categoryId || !title || !description || !address) {
      res.status(400).json({ error: 'categoryId, title, description, and address are required' });
      return;
    }

    const catCheck = await query('SELECT id FROM service_categories WHERE id = $1', [categoryId]);
    if (catCheck.rows.length === 0) {
      res.status(400).json({ error: 'Invalid category' });
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
    const rawPage = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const rawLimit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
    const { status, categoryId } = req.query;
    const page = rawPage;
    const limit = rawLimit;
    const offset = (page - 1) * limit;

    // Validate optional location params
    const lat = req.query.lat !== undefined ? Number(req.query.lat) : undefined;
    const lng = req.query.lng !== undefined ? Number(req.query.lng) : undefined;
    const radiusKm = req.query.radiusKm !== undefined ? Math.min(200, Math.max(1, Number(req.query.radiusKm))) : undefined;

    if (lat !== undefined && (isNaN(lat) || lat < -90 || lat > 90)) {
      res.status(400).json({ error: 'lat must be between -90 and 90' });
      return;
    }
    if (lng !== undefined && (isNaN(lng) || lng < -180 || lng > 180)) {
      res.status(400).json({ error: 'lng must be between -180 and 180' });
      return;
    }

    const params: unknown[] = [];
    let paramIndex = 1;

    // Location filter — must be added before other params so positions are known
    let locationCondition = '';
    let distanceSelect = '';
    let orderBy = 'ORDER BY j.created_at DESC';

    if (lat !== undefined && lng !== undefined) {
      const latNum = lat;
      const lngNum = lng;
      const radiusMeters = (radiusKm ?? 50) * 1000;
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
       LEFT JOIN users u ON j.customer_id = u.id
       LEFT JOIN service_categories sc ON j.category_id = sc.id
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
      page,
      limit,
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getJobById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id)) {
      res.status(400).json({ error: 'Invalid job ID format' });
      return;
    }

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
    const requestingUserId = req.user!.userId;
    const isInvolved =
      requestingUserId === row.customer_id ||
      requestingUserId === row.professional_id;

    const job = {
      ...formatJob(row),
      customer: {
        firstName: row.customer_first_name,
        lastName: row.customer_last_name,
        phone: isInvolved ? row.customer_phone : undefined,
      },
      professional: row.professional_id
        ? {
            firstName: row.professional_first_name,
            lastName: row.professional_last_name,
            phone: isInvolved ? row.professional_phone : undefined,
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
    if (!UUID_RE.test(id)) {
      res.status(400).json({ error: 'Invalid job ID format' });
      return;
    }

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

    if (job.customer_id === userId) {
      res.status(403).json({ error: 'Cannot accept your own job' });
      return;
    }

    const result = await query(
      `UPDATE jobs SET professional_id = $1, status = 'accepted', accepted_at = NOW()
       WHERE id = $2 AND status = 'pending' AND professional_id IS NULL
       RETURNING *,
         ST_Y(location::geometry) as latitude,
         ST_X(location::geometry) as longitude`,
      [userId, id]
    );

    if (result.rows.length === 0) {
      res.status(400).json({ error: 'Job is no longer available' });
      return;
    }

    const acceptedJob = result.rows[0];

    // Fetch professional's name for the notification message
    const proResult = await query(
      'SELECT first_name, last_name FROM users WHERE id = $1',
      [userId]
    );
    const pro = proResult.rows[0];
    const proName = pro ? `${pro.first_name} ${pro.last_name}` : 'A professional';

    // Insert notification record for the customer
    const notifResult = await query(
      `INSERT INTO notifications (user_id, type, title, content, related_job_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [
        job.customer_id,
        NotificationType.JOB_ACCEPTED,
        'Job accepted',
        `${proName} has accepted your job: ${job.title}`,
        id,
      ]
    );

    // Emit real-time notification to the customer's socket room
    const notif = notifResult.rows[0];
    getIO().to(`user:${job.customer_id}`).emit('new_notification', {
      notificationId: notif.id,
      type: NotificationType.JOB_ACCEPTED,
      title: 'Job accepted',
      content: `${proName} has accepted your job: ${job.title}`,
      relatedJobId: id,
      createdAt: notif.created_at.toISOString(),
    });

    res.json(formatJob(acceptedJob));
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
    if (!UUID_RE.test(id)) {
      res.status(400).json({ error: 'Invalid job ID format' });
      return;
    }

    const validTransitions: Record<string, string[]> = {
      pending: ['cancelled'],
      accepted: ['in_progress', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
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
       WHERE id = $2 AND (customer_id = $3 OR professional_id = $3)
       RETURNING *,
         ST_Y(location::geometry) as latitude,
         ST_X(location::geometry) as longitude`,
      [status, id, userId]
    );

    if (status === 'completed' && job.professional_id) {
      await query(
        `UPDATE professional_profiles SET total_jobs_completed = total_jobs_completed + 1 WHERE user_id = $1`,
        [job.professional_id]
      );
    }

    // Notify customer when job starts or completes
    if ((status === 'in_progress' || status === 'completed') && job.professional_id) {
      const proResult = await query(
        'SELECT first_name, last_name FROM users WHERE id = $1',
        [job.professional_id]
      );
      const pro = proResult.rows[0];
      const proName = pro ? `${pro.first_name} ${pro.last_name}` : 'Your professional';

      const isStarted = status === 'in_progress';
      const notifType = isStarted ? NotificationType.JOB_STARTED : NotificationType.JOB_COMPLETED;
      const notifTitle = isStarted ? 'Job started' : 'Job completed';
      const notifContent = isStarted
        ? `${proName} has started work on your job: ${job.title}`
        : `${proName} has marked your job as complete: ${job.title}`;

      const notifResult = await query(
        `INSERT INTO notifications (user_id, type, title, content, related_job_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, created_at`,
        [job.customer_id, notifType, notifTitle, notifContent, id]
      );

      const notif = notifResult.rows[0];
      getIO().to(`user:${job.customer_id}`).emit('new_notification', {
        notificationId: notif.id,
        type: notifType,
        title: notifTitle,
        content: notifContent,
        relatedJobId: id,
        createdAt: notif.created_at.toISOString(),
      });
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
       LEFT JOIN users u ON j.customer_id = u.id
       LEFT JOIN service_categories sc ON j.category_id = sc.id
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
    if (!UUID_RE.test(id)) {
      res.status(400).json({ error: 'Invalid job ID format' });
      return;
    }

    // Atomic ownership + status check prevents TOCTOU race condition
    const jobResult = await query(
      'SELECT id FROM jobs WHERE id = $1 AND customer_id = $2',
      [id, userId]
    );
    if (jobResult.rows.length === 0) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    // Attempt atomic delete — only succeeds if status is still 'cancelled'
    const deleteResult = await query(
      'DELETE FROM jobs WHERE id = $1 AND customer_id = $2 AND status = $3 RETURNING id',
      [id, userId, 'cancelled']
    );

    if (deleteResult.rows.length === 0) {
      res.status(400).json({ error: 'Job must be cancelled before it can be removed' });
      return;
    }

    // Clean up related rows after confirmed deletion
    await query('DELETE FROM messages WHERE job_id = $1', [id]);
    await query('DELETE FROM notifications WHERE related_job_id = $1', [id]);
    await query('DELETE FROM ratings WHERE job_id = $1', [id]);

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
