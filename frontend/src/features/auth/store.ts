import { create } from 'zustand';
import { apiClient } from '../../shared/api/client';

export type Role = 'admin' | 'manager' | 'client';

interface User {
    id: string;
    username: string;
    role: Role;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    error: string | null;
    login: (username: string, password: string) => Promise<void>;
    restoreSession: () => Promise<void>;
    logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    token: localStorage.getItem('access_token'),
    isLoading: false,
    error: null,

    login: async (username, password) => {
        set({ isLoading: true, error: null });
        try {
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);

            const { data } = await apiClient.post('/auth/token', formData, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });

            localStorage.setItem('access_token', data.access_token);

            const { data: me } = await apiClient.get('/auth/me', {
                headers: { Authorization: `Bearer ${data.access_token}` },
            });

            set({ token: data.access_token, user: me, isLoading: false });
        } catch (err: any) {
            set({ error: err.response?.data?.detail || 'Login failed', isLoading: false });
        }
    },

    restoreSession: async () => {
        const token = localStorage.getItem('access_token');
        if (!token) return;

        set({ isLoading: true });
        try {
            const { data: me } = await apiClient.get('/auth/me');
            set({ user: me, token, isLoading: false });
        } catch {
            localStorage.removeItem('access_token');
            set({ user: null, token: null, isLoading: false });
        }
    },

    logout: () => {
        localStorage.removeItem('access_token');
        set({ user: null, token: null });
        window.location.href = '/login';
    },
}));
