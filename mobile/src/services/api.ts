import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;
if (!API_BASE_URL) {
  throw new Error('EXPO_PUBLIC_API_URL environment variable is missing. Setup your production static IP or domain name before running.');
}

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

export function getFriendlyErrorMessage(err: any): string {
  if (err.response) {
    const status = err.response.status;
    const msg = err.response.data?.error || err.message;
    const endpoint = err.config?.url || '';
    return `Server Error. Status: ${status}\nEndpoint: ${endpoint}\nDetail: ${msg}`;
  } else if (err.request) {
    const endpoint = err.config?.url || '';
    const timeoutMsg = err.code === 'ECONNABORTED' ? ' (Timeout after 15s)' : '';
    return `Cannot reach server${timeoutMsg}.\nVerify server is online and port 80/3000 is open.\nURL: ${endpoint}`;
  } else {
    return `Connection error: ${err.message}`;
  }
}

