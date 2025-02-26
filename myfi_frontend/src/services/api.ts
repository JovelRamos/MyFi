// api.ts
import axios from 'axios';

const API_URL = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_URL
});

// Add token to requests when available
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const addToReadingList = async (bookId: string) => {
  const response = await api.post('/user/reading-list', { bookId });
  return response.data;
};

export const markAsCurrentlyReading = async (bookId: string) => {
  const response = await api.post('/user/currently-reading', { bookId });
  return response.data;
};

export const rateBook = async (bookId: string, rating: number) => {
  const response = await api.post('/user/rate-book', { bookId, rating });
  return response.data;
};

export default api;
