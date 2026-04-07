import { api } from './api';
import axios from 'axios';

export interface JobPhoto {
  id: string;
  jobId: string;
  uploadedBy: string;
  uploaderName: string;
  filename: string;
  originalName: string;
  photoType: 'problem' | 'completion';
  url: string;
  createdAt: string;
}

export const uploadService = {
  async uploadPhoto(jobId: string, file: File, photoType: 'problem' | 'completion'): Promise<JobPhoto> {
    const form = new FormData();
    form.append('photo', file);
    const res = await api.post<JobPhoto>(`/uploads/jobs/${jobId}/photos?type=${photoType}`, form, {
      headers: { 'Content-Type': undefined as any },
    });
    return res.data;
  },

  async getJobPhotos(jobId: string): Promise<JobPhoto[]> {
    const res = await api.get<{ photos: JobPhoto[] }>(`/uploads/jobs/${jobId}/photos`);
    return res.data.photos;
  },

  async deletePhoto(photoId: string): Promise<void> {
    await api.delete(`/uploads/photos/${photoId}`);
  },

  // Fetch a photo with the auth token and return a blob object URL for use in <img src>
  async fetchPhotoBlob(photoUrl: string): Promise<string> {
    const token = localStorage.getItem('token');
    const response = await axios.get(photoUrl, {
      responseType: 'blob',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return URL.createObjectURL(response.data);
  },
};
