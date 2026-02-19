import { Request, Response } from 'express';
import { query } from '../config/database.js';

export async function getCategories(_req: Request, res: Response): Promise<void> {
  try {
    const result = await query(
      'SELECT id, name, description, icon_url, created_at FROM service_categories ORDER BY name'
    );
    res.json({ categories: result.rows });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
