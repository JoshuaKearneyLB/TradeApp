export enum JobStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum JobUrgency {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  EMERGENCY = 'emergency',
}

export interface Job {
  id: string;
  customerId: string;
  professionalId?: string;
  categoryId: number;
  title: string;
  description: string;
  location: {
    latitude: number;
    longitude: number;
  };
  address: string;
  status: JobStatus;
  urgency: JobUrgency;
  estimatedBudget?: number;
  scheduledDate?: Date;
  acceptedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobWithDetails extends Job {
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
  };
  professional?: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
    averageRating: number;
  };
  category: {
    id: number;
    name: string;
  };
  distance?: number; // in kilometers, for professionals
}

// API Request/Response types
export interface CreateJobRequest {
  categoryId: number;
  title: string;
  description: string;
  location: {
    latitude: number;
    longitude: number;
  };
  address: string;
  urgency: JobUrgency;
  estimatedBudget?: number;
  scheduledDate?: string; // ISO date string
}

export interface UpdateJobStatusRequest {
  status: JobStatus;
}

export interface GetNearbyJobsQuery {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  categoryId?: number;
  urgency?: JobUrgency;
}

export interface JobListQuery {
  status?: JobStatus;
  customerId?: string;
  professionalId?: string;
  categoryId?: number;
  limit?: number;
  offset?: number;
}
