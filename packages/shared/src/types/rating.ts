export interface Rating {
  id: string;
  jobId: string;
  customerId: string;
  professionalId: string;
  rating: number; // 1-5
  comment?: string;
  createdAt: Date;
}

export interface CreateRatingRequest {
  jobId: string;
  professionalId: string;
  rating: number;
  comment?: string;
}

export interface RatingWithDetails extends Rating {
  customer: {
    firstName: string;
    lastName: string;
  };
  job: {
    title: string;
    completedAt?: Date;
  };
}
