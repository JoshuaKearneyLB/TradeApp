import api from './api';

export interface Skill {
  id?: string;
  categoryId: number;
  categoryName?: string;
  yearsExperience: number | null;
}

export const profileService = {
  async updateProfile(data: { firstName?: string; lastName?: string; phone?: string }) {
    const res = await api.put('/profile', data);
    return res.data;
  },

  async updateProfessionalProfile(data: {
    bio?: string | null;
    hourlyRate?: number | null;
    availabilityRadiusKm?: number;
    isAvailable?: boolean;
    location?: { latitude: number; longitude: number } | null;
  }) {
    const res = await api.put('/profile/professional', data);
    return res.data;
  },

  async getSkills(): Promise<{ skills: Skill[] }> {
    const res = await api.get('/profile/skills');
    return res.data;
  },

  async updateSkills(skills: { categoryId: number; yearsExperience?: number | null }[]) {
    const res = await api.put('/profile/skills', { skills });
    return res.data;
  },
};
