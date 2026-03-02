import { Response } from 'express';
import { query } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { sanitisePhone } from '../utils/phone.js';

/**
 * Update basic user profile (any role): firstName, lastName, phone
 */
export async function updateProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { firstName, lastName, phone } = req.body;

    if (!firstName && !lastName && phone === undefined) {
      res.status(400).json({ error: 'At least one field is required' });
      return;
    }

    // Sanitise and validate phone when provided
    let sanitisedPhone: string | null | undefined;
    if (phone !== undefined) {
      try {
        sanitisedPhone = sanitisePhone(phone);
      } catch (err: any) {
        res.status(400).json({ error: err.message });
        return;
      }
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (firstName) { sets.push(`first_name = $${idx++}`); params.push(firstName); }
    if (lastName) { sets.push(`last_name = $${idx++}`); params.push(lastName); }
    if (phone !== undefined) { sets.push(`phone = $${idx++}`); params.push(sanitisedPhone); }

    params.push(userId);

    const result = await query(
      `UPDATE users SET ${sets.join(', ')}
       WHERE id = $${idx}
       RETURNING id, email, role, first_name, last_name, phone, account_status, created_at, updated_at`,
      params
    );

    const user = result.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      accountStatus: user.account_status,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Update professional profile: bio, hourlyRate, availabilityRadiusKm, isAvailable, location
 */
export async function updateProfessionalProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { bio, hourlyRate, availabilityRadiusKm, isAvailable, location, locationDisplay } = req.body;

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (bio !== undefined) { sets.push(`bio = $${idx++}`); params.push(bio || null); }
    if (hourlyRate !== undefined) { sets.push(`hourly_rate = $${idx++}`); params.push(hourlyRate || null); }
    if (availabilityRadiusKm !== undefined) { sets.push(`availability_radius_km = $${idx++}`); params.push(availabilityRadiusKm); }
    if (isAvailable !== undefined) { sets.push(`is_available = $${idx++}`); params.push(isAvailable); }
    if (location !== undefined) {
      if (location && location.latitude && location.longitude) {
        sets.push(`location = ST_SetSRID(ST_MakePoint($${idx++}, $${idx++}), 4326)::geography`);
        params.push(location.longitude, location.latitude);
        sets.push(`location_display = $${idx++}`);
        params.push(locationDisplay || null);
      } else {
        sets.push(`location = NULL`);
        sets.push(`location_display = NULL`);
      }
    }

    if (sets.length === 0) {
      res.status(400).json({ error: 'At least one field is required' });
      return;
    }

    params.push(userId);

    const result = await query(
      `UPDATE professional_profiles SET ${sets.join(', ')}
       WHERE user_id = $${idx}
       RETURNING id, user_id, bio, hourly_rate, availability_radius_km, is_available, average_rating, total_jobs_completed,
         ST_Y(location::geometry) as latitude, ST_X(location::geometry) as longitude, location_display,
         created_at, updated_at`,
      params
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Professional profile not found' });
      return;
    }

    const p = result.rows[0];
    res.json({
      id: p.id,
      userId: p.user_id,
      bio: p.bio,
      hourlyRate: p.hourly_rate ? parseFloat(p.hourly_rate) : null,
      availabilityRadiusKm: p.availability_radius_km,
      isAvailable: p.is_available,
      averageRating: parseFloat(p.average_rating),
      totalJobsCompleted: p.total_jobs_completed,
      location: p.latitude && p.longitude
        ? { latitude: parseFloat(p.latitude), longitude: parseFloat(p.longitude), display: p.location_display || undefined }
        : null,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    });
  } catch (error) {
    console.error('Update professional profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get professional's skills
 */
export async function getSkills(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;

    const result = await query(
      `SELECT ps.id, ps.category_id, ps.years_experience, sc.name AS category_name
       FROM professional_skills ps
       JOIN professional_profiles pp ON ps.professional_id = pp.id
       JOIN service_categories sc ON ps.category_id = sc.id
       WHERE pp.user_id = $1
       ORDER BY sc.name`,
      [userId]
    );

    res.json({
      skills: result.rows.map((r: any) => ({
        id: r.id,
        categoryId: r.category_id,
        categoryName: r.category_name,
        yearsExperience: r.years_experience,
      })),
    });
  } catch (error) {
    console.error('Get skills error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Replace all skills for a professional.
 * Body: { skills: [{ categoryId: number, yearsExperience?: number }] }
 */
export async function updateSkills(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { skills } = req.body;

    if (!Array.isArray(skills)) {
      res.status(400).json({ error: 'skills must be an array' });
      return;
    }

    // Get professional profile id
    const profileResult = await query(
      'SELECT id FROM professional_profiles WHERE user_id = $1',
      [userId]
    );
    if (profileResult.rows.length === 0) {
      res.status(404).json({ error: 'Professional profile not found' });
      return;
    }
    const professionalId = profileResult.rows[0].id;

    // Delete existing skills
    await query('DELETE FROM professional_skills WHERE professional_id = $1', [professionalId]);

    // Insert new skills
    for (const skill of skills) {
      if (!skill.categoryId) continue;
      await query(
        `INSERT INTO professional_skills (professional_id, category_id, years_experience)
         VALUES ($1, $2, $3)
         ON CONFLICT (professional_id, category_id) DO UPDATE SET years_experience = $3`,
        [professionalId, skill.categoryId, skill.yearsExperience || null]
      );
    }

    // Return updated skills
    const result = await query(
      `SELECT ps.id, ps.category_id, ps.years_experience, sc.name AS category_name
       FROM professional_skills ps
       JOIN service_categories sc ON ps.category_id = sc.id
       WHERE ps.professional_id = $1
       ORDER BY sc.name`,
      [professionalId]
    );

    res.json({
      skills: result.rows.map((r: any) => ({
        id: r.id,
        categoryId: r.category_id,
        categoryName: r.category_name,
        yearsExperience: r.years_experience,
      })),
    });
  } catch (error) {
    console.error('Update skills error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
