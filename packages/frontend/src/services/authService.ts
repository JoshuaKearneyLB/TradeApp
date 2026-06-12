import api from './api';
import type { RegisterRequest, LoginRequest, AuthResponse } from '@tradeapp/shared';

export const authService = {
  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/register', data);
    return response.data;
  },

  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await api.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  async getMe(): Promise<AuthResponse> {
    const response = await api.get<AuthResponse>('/auth/me');
    return response.data;
  },

  async logout() {
    // SEC-AUTH-01: revoke the token server-side (blacklists its JTI) before
    // clearing local state. Fire-and-forget — a network failure must not block
    // the user from logging out locally, but the happy path now actually
    // invalidates the session instead of leaving it valid until expiry.
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore — local logout proceeds regardless
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
};
