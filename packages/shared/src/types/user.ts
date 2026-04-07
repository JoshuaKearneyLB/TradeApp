export enum UserRole {
  CUSTOMER = 'customer',
  PROFESSIONAL = 'professional',
  ADMIN = 'admin',
}

export enum AccountStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone?: string;
  accountStatus: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfessionalProfile {
  id: string;
  userId: string;
  bio?: string;
  hourlyRate?: number;
  availabilityRadiusKm: number;
  location?: {
    latitude: number;
    longitude: number;
    display?: string;
  };
  isAvailable: boolean;
  averageRating: number;
  totalJobsCompleted: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfessionalSkill {
  id: string;
  professionalId: string;
  categoryId: number;
  yearsExperience?: number;
  createdAt: Date;
}

export interface ServiceCategory {
  id: number;
  name: string;
  description?: string;
  iconUrl?: string;
  createdAt: Date;
}

// API Request/Response types
export interface RegisterRequest {
  email: string;
  password: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  professionalProfile?: ProfessionalProfile;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface UpdateProfessionalProfileRequest {
  bio?: string;
  hourlyRate?: number;
  availabilityRadiusKm?: number;
  location?: {
    latitude: number;
    longitude: number;
  };
  isAvailable?: boolean;
  skills?: Array<{
    categoryId: number;
    yearsExperience?: number;
  }>;
}
