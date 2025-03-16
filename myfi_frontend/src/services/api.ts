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
  const response = await api.post('/user/reading-list', { bookId, action: 'add' });
  return response.data;
};

export const removeFromReadingList = async (bookId: string) => {
  const response = await api.post('/user/reading-list', { bookId, action: 'remove' });
  return response.data;
};

export const removeFromCurrentlyReading = async (bookId: string) => {
  const response = await api.post('/user/currently-reading', { 
    bookId, 
    action: 'remove' 
  });
  return response.data;
};


export const markAsCurrentlyReading = async (bookId: string) => {
  const response = await api.post('/user/currently-reading', { bookId, action: 'add' });
  return response.data;
};

export const markAsFinished = async (bookId: string) => {
  const response = await api.post('/user/currently-reading', { bookId, action: 'finish' });
  return response.data;
};

export const rateBook = async (bookId: string, rating: number) => {
  const response = await api.post('/user/rate-book', { bookId, rating });
  return response.data;
};

export const getBookDetails = async (bookId: string) => {
  const response = await api.get(`/books/${bookId}`);
  return response.data;
};

export default api;
