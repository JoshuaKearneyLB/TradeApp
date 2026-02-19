import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../config/database.js';
import { generateToken } from '../middleware/auth.js';
import {
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  UserRole,
} from '@tradeapp/shared';

const SALT_ROUNDS = 10;

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, role, firstName, lastName, phone }: RegisterRequest = req.body;

    // Validate required fields
    if (!email || !password || !role || !firstName || !lastName) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const userResult = await query(
      `INSERT INTO users (email, password_hash, role, first_name, last_name, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, role, first_name, last_name, phone, account_status, created_at, updated_at`,
      [email, passwordHash, role, firstName, lastName, phone || null]
    );

    const user = userResult.rows[0];

    // If professional, create professional profile
    let professionalProfile = undefined;
    if (role === UserRole.PROFESSIONAL) {
      const profileResult = await query(
        `INSERT INTO professional_profiles (user_id)
         VALUES ($1)
         RETURNING id, user_id, bio, hourly_rate, availability_radius_km, is_available, average_rating, total_jobs_completed, created_at, updated_at`,
        [user.id]
      );
      const profile = profileResult.rows[0];
      professionalProfile = {
        id: profile.id,
        userId: profile.user_id,
        bio: profile.bio,
        hourlyRate: profile.hourly_rate,
        availabilityRadiusKm: profile.availability_radius_km,
        isAvailable: profile.is_available,
        averageRating: parseFloat(profile.average_rating),
        totalJobsCompleted: profile.total_jobs_completed,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      };
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const response: AuthResponse = {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        accountStatus: user.account_status,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
      professionalProfile,
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password }: LoginRequest = req.body;

    // Validate required fields
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Find user
    const userResult = await query(
      `SELECT id, email, password_hash, role, first_name, last_name, phone, account_status, created_at, updated_at
       FROM users
       WHERE email = $1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const user = userResult.rows[0];

    // Check if account is active
    if (user.account_status !== 'active') {
      res.status(403).json({ error: 'Account is suspended or deleted' });
      return;
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Get professional profile if applicable
    let professionalProfile = undefined;
    if (user.role === 'professional') {
      const profileResult = await query(
        `SELECT id, user_id, bio, hourly_rate, availability_radius_km,
                ST_Y(location::geometry) as latitude,
                ST_X(location::geometry) as longitude,
                is_available, average_rating, total_jobs_completed, created_at, updated_at
         FROM professional_profiles
         WHERE user_id = $1`,
        [user.id]
      );

      if (profileResult.rows.length > 0) {
        const profile = profileResult.rows[0];
        professionalProfile = {
          id: profile.id,
          userId: profile.user_id,
          bio: profile.bio,
          hourlyRate: profile.hourly_rate ? parseFloat(profile.hourly_rate) : undefined,
          availabilityRadiusKm: profile.availability_radius_km,
          location: profile.latitude && profile.longitude
            ? { latitude: parseFloat(profile.latitude), longitude: parseFloat(profile.longitude) }
            : undefined,
          isAvailable: profile.is_available,
          averageRating: parseFloat(profile.average_rating),
          totalJobsCompleted: profile.total_jobs_completed,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
        };
      }
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const response: AuthResponse = {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        accountStatus: user.account_status,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
      professionalProfile,
    };

    res.json(response);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as any;
    const userId = authReq.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Get user
    const userResult = await query(
      `SELECT id, email, role, first_name, last_name, phone, account_status, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const user = userResult.rows[0];

    // Get professional profile if applicable
    let professionalProfile = undefined;
    if (user.role === 'professional') {
      const profileResult = await query(
        `SELECT id, user_id, bio, hourly_rate, availability_radius_km,
                ST_Y(location::geometry) as latitude,
                ST_X(location::geometry) as longitude,
                is_available, average_rating, total_jobs_completed, created_at, updated_at
         FROM professional_profiles
         WHERE user_id = $1`,
        [user.id]
      );

      if (profileResult.rows.length > 0) {
        const profile = profileResult.rows[0];
        professionalProfile = {
          id: profile.id,
          userId: profile.user_id,
          bio: profile.bio,
          hourlyRate: profile.hourly_rate ? parseFloat(profile.hourly_rate) : undefined,
          availabilityRadiusKm: profile.availability_radius_km,
          location: profile.latitude && profile.longitude
            ? { latitude: parseFloat(profile.latitude), longitude: parseFloat(profile.longitude) }
            : undefined,
          isAvailable: profile.is_available,
          averageRating: parseFloat(profile.average_rating),
          totalJobsCompleted: profile.total_jobs_completed,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
        };
      }
    }

    const response: AuthResponse = {
      token: '', // Token not needed for /me endpoint
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        accountStatus: user.account_status,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
      professionalProfile,
    };

    res.json(response);
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
