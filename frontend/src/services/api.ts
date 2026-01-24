/**
 * API Service
 */
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Token storage key
const TOKEN_KEY = 'auth_token'

// Initialize auth header from localStorage on module load
const storedToken = localStorage.getItem(TOKEN_KEY)
if (storedToken) {
  api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`
}

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If we get a 401, the token might be expired
    if (error.response?.status === 401) {
      // Check if we're not already on the login page
      if (!window.location.pathname.includes('/login')) {
        // Clear auth data
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem('auth_user')
        localStorage.removeItem('auth_roles')
        localStorage.removeItem('auth_log_id')
        delete api.defaults.headers.common['Authorization']
        
        // Redirect to login
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
