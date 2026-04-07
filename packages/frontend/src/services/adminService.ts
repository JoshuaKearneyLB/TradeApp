import { api } from './api';

export interface AdminStats {
  users: { total: number; byRole: Record<string, number> };
  jobs: { total: number; byStatus: Record<string, number> };
  revenue: { total: number; platformFees: number };
  professionalsWithPayments: number;
}

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  phone?: string;
  accountStatus: string;
  createdAt: string;
}

export interface AdminJob {
  id: string;
  title: string;
  status: string;
  estimatedBudget: number | null;
  category: string;
  customer: string;
  professional: string | null;
  createdAt: string;
}

export interface AdminPayment {
  id: string;
  jobTitle: string;
  amount: number;
  platformFee: number;
  professionalPayout: number;
  status: string;
  customer: string;
  professional: string;
  createdAt: string;
}

export const adminService = {
  async getStats(): Promise<AdminStats> {
    const res = await api.get<AdminStats>('/admin/stats');
    return res.data;
  },

  async getUsers(page = 1, role?: string, search?: string): Promise<{ users: AdminUser[]; total: number; page: number; limit: number }> {
    const params: Record<string, any> = { page };
    if (role) params.role = role;
    if (search) params.search = search;
    const res = await api.get('/admin/users', { params });
    return res.data;
  },

  async updateUserStatus(id: string, accountStatus: string): Promise<void> {
    await api.put(`/admin/users/${id}`, { accountStatus });
  },

  async getJobs(page = 1, status?: string): Promise<{ jobs: AdminJob[]; total: number; page: number; limit: number }> {
    const params: Record<string, any> = { page };
    if (status) params.status = status;
    const res = await api.get('/admin/jobs', { params });
    return res.data;
  },

  async getPayments(page = 1): Promise<{ payments: AdminPayment[]; total: number; page: number; limit: number }> {
    const res = await api.get('/admin/payments', { params: { page } });
    return res.data;
  },
};
