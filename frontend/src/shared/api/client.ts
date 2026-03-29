import axios from 'axios';
import { useProjectStore } from '../../features/projects/store';

const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  const { hostname, protocol } = window.location;
  // If we are on mobile (accessing via IP or custom domain), use that same host for API
  return `${protocol}//${hostname}:8000`;
};

export const API_BASE_URL = getBaseUrl();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token and project headers to every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Handle Project Context Overrides
  if (config.headers['X-Project-Skip']) {
      delete config.headers['X-Project-Skip'];
      return config;
  }

  const forcedProjectId = config.headers['X-Force-Project-Id'];
  if (forcedProjectId) {
      config.headers['X-Project-Id'] = forcedProjectId;
      delete config.headers['X-Force-Project-Id'];
      // We'd ideally need the owner_id too, but for now let's hope the backend 
      // can resolve it or doesn't strictly require it for all operations.
      // (Alternatively, we'd need to pass the full project object in config).
      return config;
  }

  // Fallback to baseProject from store (Stable Sidebar Selection)
  try {
      const state = useProjectStore.getState();
      const baseProject = state.baseProject;
      if (baseProject) {
          config.headers['X-Project-Id'] = baseProject.id;
          config.headers['X-Project-Owner'] = baseProject.owner_id;
      }
  } catch (e) {
      // Ignore
  }

  return config;
});

// Handle 401 globally
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
