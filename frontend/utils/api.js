import axios from 'axios';

const API_BASE_URL = 'https://food-app-debug.preview.emergentagent.com/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Note: Authorization header is set globally in AuthContext after login
// via axios.defaults.headers.common['Authorization']

export default api;
