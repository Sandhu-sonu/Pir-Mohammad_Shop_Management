import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

// For local testing: 10.0.2.2 maps to the host machine's localhost under Android Emulators
export const API_BASE_URL = 'http://10.0.2.2:3000/api/v1/mobile';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear expired or invalidated session token
      useAuthStore.getState().clearSession();
    }
    return Promise.reject(error);
  }
);
