import api from './api';

export interface Payment {
  id: string;
  jobId: string;
  amount: number;
  platformFee: number;
  professionalPayout: number;
  status: string;
  createdAt: string;
}

export async function onboardProfessional(): Promise<{ url: string }> {
  const res = await api.post('/payments/onboard');
  return res.data;
}

export async function getOnboardingStatus(): Promise<{ complete: boolean }> {
  const res = await api.get('/payments/onboard/status');
  return res.data;
}

export async function createPaymentIntent(jobId: string): Promise<{ clientSecret: string; amount: number }> {
  const res = await api.post(`/payments/jobs/${jobId}/intent`);
  return res.data;
}

export async function confirmPayment(jobId: string, paymentIntentId: string): Promise<void> {
  await api.post(`/payments/jobs/${jobId}/confirm`, { paymentIntentId });
}

export async function getJobPayment(jobId: string): Promise<Payment | null> {
  const res = await api.get(`/payments/jobs/${jobId}`);
  return res.data;
}
