'use client';

import { create } from 'zustand';
import type { UserSelf, RegisterRequest } from '@dail-game/types';
import { api, setAccessToken } from '@/lib/api';

interface AuthState {
  user: UserSelf | null;
  accessToken: string | null;
  isLoading: boolean;
  isInitialized: boolean;

  login(email: string, password: string): Promise<void>;
  register(input: RegisterRequest): Promise<void>;
  verifyEmail(token: string): Promise<void>;
  resendVerification(email: string, locale: 'tr' | 'en'): Promise<void>;
  forgotPassword(email: string, locale: 'tr' | 'en'): Promise<void>;
  resetPassword(token: string, password: string): Promise<void>;
  logout(): Promise<void>;
  refresh(): Promise<boolean>;
  updateUser(updates: Partial<UserSelf>): void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isLoading: false,
  isInitialized: false,

  async login(email: string, password: string): Promise<void> {
    set({ isLoading: true });
    try {
      const { data } = await api.post<{ data: { user: UserSelf; accessToken: string } }>('/auth/login', {
        email,
        password,
      });
      const { user, accessToken } = data.data;
      setAccessToken(accessToken);
      set({ user, accessToken, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  // Registration never logs the user in — they must click the emailed link.
  async register(input: RegisterRequest): Promise<void> {
    set({ isLoading: true });
    try {
      await api.post('/auth/register', input);
    } finally {
      set({ isLoading: false });
    }
  },

  // The verification link doubles as a login: the server issues tokens on success.
  async verifyEmail(token: string): Promise<void> {
    const { data } = await api.post<{ data: { user: UserSelf; accessToken: string } }>(
      '/auth/verify-email',
      { token },
    );
    const { user, accessToken } = data.data;
    setAccessToken(accessToken);
    set({ user, accessToken, isInitialized: true });
  },

  async resendVerification(email: string, locale: 'tr' | 'en'): Promise<void> {
    await api.post('/auth/resend-verification', { email, locale });
  },

  async forgotPassword(email: string, locale: 'tr' | 'en'): Promise<void> {
    await api.post('/auth/forgot-password', { email, locale });
  },

  // Deliberately does not log the user in: the reset revokes every session on
  // the account, so they sign in again with the new password.
  async resetPassword(token: string, password: string): Promise<void> {
    await api.post('/auth/reset-password', { token, password });
    setAccessToken(null);
    set({ user: null, accessToken: null });
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      set({ user: null, accessToken: null });
    }
  },

  async refresh(): Promise<boolean> {
    try {
      const { data } = await api.post<{ data: { accessToken: string } }>('/auth/refresh');
      const { accessToken } = data.data;
      setAccessToken(accessToken);

      // Fetch user profile
      const userRes = await api.get<{ data: UserSelf }>('/users/me');
      set({ user: userRes.data.data, accessToken, isInitialized: true });
      return true;
    } catch {
      set({ user: null, accessToken: null, isInitialized: true });
      return false;
    }
  },

  updateUser(updates: Partial<UserSelf>): void {
    const current = get().user;
    if (current) set({ user: { ...current, ...updates } });
  },
}));
