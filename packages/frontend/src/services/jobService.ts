import api from './api';

export interface JobResponse {
  id: string;
  customerId: string;
  professionalId: string | null;
  categoryId: number;
  title: string;
  description: string;
  address: string;
  location: { latitude: number; longitude: number } | null;
  status: string;
  urgency: string;
  estimatedBudget: number | null;
  scheduledDate: string | null;
  acceptedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { firstName: string; lastName: string; phone?: string };
  professional?: { firstName: string; lastName: string; phone?: string; averageRating: number } | null;
  category?: { name: string; description: string };
}

export interface Category {
  id: number;
  name: string;
  description: string;
  icon_url: string | null;
}

export const jobService = {
  async getCategories(): Promise<Category[]> {
    const res = await api.get<{ categories: Category[] }>('/categories');
    return res.data.categories;
  },

  async getJobs(params?: { status?: string; categoryId?: number; page?: number }): Promise<{ jobs: JobResponse[]; total: number }> {
    const res = await api.get('/jobs', { params });
    return res.data;
  },

  async getJobById(id: string): Promise<JobResponse> {
    const res = await api.get<JobResponse>(`/jobs/${id}`);
    return res.data;
  },

  async getMyJobs(): Promise<{ jobs: JobResponse[] }> {
    const res = await api.get('/jobs/mine');
    return res.data;
  },

  async createJob(data: {
    categoryId: number;
    title: string;
    description: string;
    address: string;
    urgency: string;
    estimatedBudget?: number;
    scheduledDate?: string;
    location?: { latitude: number; longitude: number };
  }): Promise<JobResponse> {
    const res = await api.post<JobResponse>('/jobs', data);
    return res.data;
  },

  async acceptJob(id: string): Promise<JobResponse> {
    const res = await api.post<JobResponse>(`/jobs/${id}/accept`);
    return res.data;
  },

  async updateJobStatus(id: string, status: string): Promise<JobResponse> {
    const res = await api.put<JobResponse>(`/jobs/${id}/status`, { status });
    return res.data;
  },

  async deleteJob(id: string): Promise<void> {
    await api.delete(`/jobs/${id}`);
  },
};
