import api from './api';

export interface RatingResponse {
  id: string;
  jobId: string;
  customerId: string;
  professionalId: string;
  rating: number;
  comment?: string;
  createdAt: string;
  customer?: {
    firstName: string;
    lastName: string;
  };
}

export const ratingService = {
  async createRating(data: { jobId: string; rating: number; comment?: string }): Promise<RatingResponse> {
    const res = await api.post<RatingResponse>('/ratings', data);
    return res.data;
  },

  async getJobRating(jobId: string): Promise<{ rating: RatingResponse | null }> {
    const res = await api.get<{ rating: RatingResponse | null }>(`/ratings/job/${jobId}`);
    return res.data;
  },
};
