import axios from 'axios';

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

  // Add project headers from localStorage if present
  try {
      const projectStorage = localStorage.getItem('project-storage');
      if (projectStorage) {
          const { state } = JSON.parse(projectStorage);
          if (state.isProjectMode && state.activeProject) {
              config.headers['X-Project-Id'] = state.activeProject.id;
              config.headers['X-Project-Owner'] = state.activeProject.owner_id;
          }
      }
  } catch (e) {
      console.error('Failed to parse project storage', e);
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
