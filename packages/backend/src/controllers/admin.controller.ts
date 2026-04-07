import { Response } from 'express';
import { query } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getStats(req: AuthRequest, res: Response): Promise<void> {
  try {
    const [usersResult, jobsResult, revenueResult, prosResult] = await Promise.all([
      query(`SELECT role, COUNT(*) as count FROM users WHERE account_status != 'deleted' GROUP BY role`),
      query(`SELECT status, COUNT(*) as count FROM jobs GROUP BY status`),
      query(`SELECT COALESCE(SUM(amount), 0) as total, COALESCE(SUM(platform_fee), 0) as fees FROM payments WHERE status = 'succeeded'`),
      query(`SELECT COUNT(*) as count FROM professional_profiles WHERE stripe_onboarding_complete = true`),
    ]);

    const usersByRole: Record<string, number> = {};
    usersResult.rows.forEach((r: any) => { usersByRole[r.role] = parseInt(r.count); });

    const jobsByStatus: Record<string, number> = {};
    jobsResult.rows.forEach((r: any) => { jobsByStatus[r.status] = parseInt(r.count); });

    res.json({
      users: {
        total: Object.values(usersByRole).reduce((a, b) => a + b, 0),
        byRole: usersByRole,
      },
      jobs: {
        total: Object.values(jobsByStatus).reduce((a, b) => a + b, 0),
        byStatus: jobsByStatus,
      },
      revenue: {
        total: parseFloat(revenueResult.rows[0].total),
        platformFees: parseFloat(revenueResult.rows[0].fees),
      },
      professionalsWithPayments: parseInt(prosResult.rows[0].count),
    });
  } catch (error) {
    console.error('Admin get stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getUsers(req: AuthRequest, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
    const offset = (page - 1) * limit;
    const role = req.query.role as string | undefined;
    const search = req.query.search as string | undefined;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (role && ['customer', 'professional', 'admin'].includes(role)) {
      conditions.push(`role = $${idx++}`);
      params.push(role);
    }
    if (search && search.trim().length > 0) {
      const s = `%${search.trim()}%`;
      conditions.push(`(first_name ILIKE $${idx} OR last_name ILIKE $${idx} OR email ILIKE $${idx})`);
      params.push(s);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [usersResult, countResult] = await Promise.all([
      query(
        `SELECT id, email, role, first_name, last_name, phone, account_status, created_at
         FROM users ${where}
         ORDER BY created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset],
      ),
      query(`SELECT COUNT(*) FROM users ${where}`, params),
    ]);

    res.json({
      users: usersResult.rows.map((r: any) => ({
        id: r.id,
        email: r.email,
        role: r.role,
        firstName: r.first_name,
        lastName: r.last_name,
        phone: r.phone,
        accountStatus: r.account_status,
        createdAt: r.created_at,
      })),
      total: parseInt(countResult.rows[0].count),
      page,
      limit,
    });
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateUserStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const adminId = req.user!.userId;
    const { id } = req.params;
    const { accountStatus } = req.body;

    if (!UUID_RE.test(id)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }
    if (!['active', 'suspended', 'deleted'].includes(accountStatus)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }
    if (id === adminId) {
      res.status(400).json({ error: 'Cannot modify your own account' });
      return;
    }

    // Cannot target another admin
    const targetResult = await query('SELECT role FROM users WHERE id = $1', [id]);
    if (targetResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (targetResult.rows[0].role === 'admin') {
      res.status(403).json({ error: 'Cannot modify admin accounts' });
      return;
    }

    await query('UPDATE users SET account_status = $1 WHERE id = $2', [accountStatus, id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Admin update user status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getAdminJobs(req: AuthRequest, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
    const offset = (page - 1) * limit;
    const status = req.query.status as string | undefined;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (status) {
      conditions.push(`j.status = $${idx++}`);
      params.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [jobsResult, countResult] = await Promise.all([
      query(
        `SELECT j.id, j.title, j.status, j.estimated_budget, j.created_at,
                c.first_name AS customer_first, c.last_name AS customer_last,
                p.first_name AS pro_first, p.last_name AS pro_last,
                sc.name AS category_name
         FROM jobs j
         JOIN users c ON c.id = j.customer_id
         LEFT JOIN users p ON p.id = j.professional_id
         JOIN service_categories sc ON sc.id = j.category_id
         ${where}
         ORDER BY j.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset],
      ),
      query(`SELECT COUNT(*) FROM jobs j ${where}`, params),
    ]);

    res.json({
      jobs: jobsResult.rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        estimatedBudget: r.estimated_budget ? parseFloat(r.estimated_budget) : null,
        category: r.category_name,
        customer: `${r.customer_first} ${r.customer_last}`,
        professional: r.pro_first ? `${r.pro_first} ${r.pro_last}` : null,
        createdAt: r.created_at,
      })),
      total: parseInt(countResult.rows[0].count),
      page,
      limit,
    });
  } catch (error) {
    console.error('Admin get jobs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getAdminPayments(req: AuthRequest, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
    const offset = (page - 1) * limit;

    const [paymentsResult, countResult] = await Promise.all([
      query(
        `SELECT pay.id, pay.amount, pay.platform_fee, pay.professional_payout, pay.status, pay.created_at,
                j.title AS job_title,
                c.first_name AS customer_first, c.last_name AS customer_last,
                p.first_name AS pro_first, p.last_name AS pro_last
         FROM payments pay
         JOIN jobs j ON j.id = pay.job_id
         JOIN users c ON c.id = pay.customer_id
         JOIN users p ON p.id = pay.professional_id
         ORDER BY pay.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      query('SELECT COUNT(*) FROM payments'),
    ]);

    res.json({
      payments: paymentsResult.rows.map((r: any) => ({
        id: r.id,
        jobTitle: r.job_title,
        amount: parseFloat(r.amount),
        platformFee: parseFloat(r.platform_fee),
        professionalPayout: parseFloat(r.professional_payout),
        status: r.status,
        customer: `${r.customer_first} ${r.customer_last}`,
        professional: `${r.pro_first} ${r.pro_last}`,
        createdAt: r.created_at,
      })),
      total: parseInt(countResult.rows[0].count),
      page,
      limit,
    });
  } catch (error) {
    console.error('Admin get payments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
