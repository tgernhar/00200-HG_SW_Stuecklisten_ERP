/**
 * Authentication Context
 * Manages user authentication state and provides auth functions
 */
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import api from '../services/api'

// Types
interface User {
  id: number
  loginname: string
  vorname?: string
  nachname?: string
  email?: string
}

interface Role {
  id: number
  name: string
  isAdmin?: number
  isManagement?: number
  isFAS?: number
  isPersonal?: number
  isVerwaltung?: number
}

interface AuthState {
  user: User | null
  roles: Role[]
  isAuthenticated: boolean
  isLoading: boolean
  logId: number | null
}

interface AuthContextType extends AuthState {
  login: (loginname: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
}

// Create context
const AuthContext = createContext<AuthContextType | null>(null)

// Token storage keys
const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'
const ROLES_KEY = 'auth_roles'
const LOG_ID_KEY = 'auth_log_id'
const INACTIVITY_SHOWN_KEY = 'inactivity_logout_shown'

// Inactivity timeout (45 minutes in milliseconds)
const INACTIVITY_TIMEOUT = 45 * 60 * 1000

// Token refresh cooldown (5 minutes) - don't refresh more often than this
const REFRESH_COOLDOWN = 5 * 60 * 1000

// Token refresh interval (every 10 minutes as backup)
const REFRESH_INTERVAL = 10 * 60 * 1000

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    roles: [],
    isAuthenticated: false,
    isLoading: true,
    logId: null
  })

  // Activity tracking
  const [lastActivity, setLastActivity] = useState<number>(Date.now())
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now())
  const [inactivityTimer, setInactivityTimer] = useState<NodeJS.Timeout | null>(null)
  const [refreshTimer, setRefreshTimer] = useState<NodeJS.Timeout | null>(null)

  // Initialize from localStorage
  useEffect(() => {
    const initAuth = () => {
      try {
        const token = localStorage.getItem(TOKEN_KEY)
        const userStr = localStorage.getItem(USER_KEY)
        const rolesStr = localStorage.getItem(ROLES_KEY)
        const logIdStr = localStorage.getItem(LOG_ID_KEY)

        if (token && userStr) {
          const user = JSON.parse(userStr)
          const roles = rolesStr ? JSON.parse(rolesStr) : []
          const logId = logIdStr ? parseInt(logIdStr, 10) : null

          // Set auth header
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`

          setState({
            user,
            roles,
            isAuthenticated: true,
            isLoading: false,
            logId
          })

          // Start inactivity timer
          startInactivityTimer()
          startRefreshTimer()
        } else {
          setState(prev => ({ ...prev, isLoading: false }))
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        clearAuthData()
        setState(prev => ({ ...prev, isLoading: false }))
      }
    }

    initAuth()

    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer)
      if (refreshTimer) clearInterval(refreshTimer)
    }
  }, [])

  // Activity-based token refresh (with cooldown)
  const refreshTokenIfNeeded = useCallback(async () => {
    const now = Date.now()
    const timeSinceLastRefresh = now - lastRefresh
    
    // Only refresh if cooldown has passed
    if (timeSinceLastRefresh >= REFRESH_COOLDOWN) {
      try {
        const response = await api.post('/auth/refresh')
        const { access_token } = response.data
        
        // Update token
        localStorage.setItem(TOKEN_KEY, access_token)
        api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
        setLastRefresh(now)
        console.log('Token refreshed on activity')
      } catch (error) {
        console.error('Activity-based token refresh failed:', error)
        // Don't logout here - let the normal 401 handler deal with it
      }
    }
  }, [lastRefresh])

  // Track user activity
  useEffect(() => {
    if (!state.isAuthenticated) return

    const handleActivity = () => {
      setLastActivity(Date.now())
      resetInactivityTimer()
      // Refresh token on activity (with cooldown)
      refreshTokenIfNeeded()
    }

    // Track mouse and keyboard events
    window.addEventListener('mousemove', handleActivity)
    window.addEventListener('mousedown', handleActivity)
    window.addEventListener('keydown', handleActivity)
    window.addEventListener('scroll', handleActivity)
    window.addEventListener('touchstart', handleActivity)

    return () => {
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('mousedown', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      window.removeEventListener('scroll', handleActivity)
      window.removeEventListener('touchstart', handleActivity)
    }
  }, [state.isAuthenticated, refreshTokenIfNeeded])

  const startInactivityTimer = useCallback(() => {
    if (inactivityTimer) clearTimeout(inactivityTimer)

    const timer = setTimeout(() => {
      console.log('Inactivity timeout - logging out')
      handleLogout(true)
    }, INACTIVITY_TIMEOUT)

    setInactivityTimer(timer)
  }, [])

  const resetInactivityTimer = useCallback(() => {
    startInactivityTimer()
  }, [startInactivityTimer])

  const startRefreshTimer = useCallback(() => {
    if (refreshTimer) clearInterval(refreshTimer)

    const timer = setInterval(async () => {
      try {
        await refreshToken()
      } catch (error) {
        console.error('Token refresh failed:', error)
      }
    }, REFRESH_INTERVAL)

    setRefreshTimer(timer)
  }, [])

  const clearAuthData = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(ROLES_KEY)
    localStorage.removeItem(LOG_ID_KEY)
    delete api.defaults.headers.common['Authorization']
  }

  const login = async (loginname: string, password: string): Promise<void> => {
    try {
      const response = await api.post('/auth/login', { loginname, password })
      const { access_token, user, roles, log_id } = response.data

      // Clear inactivity flag on new login
      sessionStorage.removeItem(INACTIVITY_SHOWN_KEY)

      // Store in localStorage
      localStorage.setItem(TOKEN_KEY, access_token)
      localStorage.setItem(USER_KEY, JSON.stringify(user))
      localStorage.setItem(ROLES_KEY, JSON.stringify(roles))
      localStorage.setItem(LOG_ID_KEY, String(log_id))

      // Set auth header
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`

      // Update state
      setState({
        user,
        roles,
        isAuthenticated: true,
        isLoading: false,
        logId: log_id
      })

      // Start timers
      startInactivityTimer()
      startRefreshTimer()
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Login fehlgeschlagen'
      throw new Error(message)
    }
  }

  const handleLogout = async (isInactivity: boolean = false) => {
    // Prevent showing multiple inactivity alerts
    const alreadyShown = sessionStorage.getItem(INACTIVITY_SHOWN_KEY)
    if (isInactivity && alreadyShown) {
      return
    }
    
    try {
      // Call logout endpoint if we have a token
      if (state.isAuthenticated) {
        await api.post('/auth/logout').catch(() => {})
      }
    } finally {
      // Clear timers
      if (inactivityTimer) clearTimeout(inactivityTimer)
      if (refreshTimer) clearInterval(refreshTimer)

      // Clear auth data
      clearAuthData()

      // Reset state
      setState({
        user: null,
        roles: [],
        isAuthenticated: false,
        isLoading: false,
        logId: null
      })

      // Show message if due to inactivity (only once per session)
      if (isInactivity && !alreadyShown) {
        sessionStorage.setItem(INACTIVITY_SHOWN_KEY, 'true')
        alert('Sie wurden aufgrund von Inaktivität abgemeldet.')
      }
    }
  }

  const logout = async (): Promise<void> => {
    await handleLogout(false)
  }

  const refreshToken = async (): Promise<void> => {
    try {
      const response = await api.post('/auth/refresh')
      const { access_token } = response.data

      // Update token
      localStorage.setItem(TOKEN_KEY, access_token)
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
    } catch (error) {
      console.error('Token refresh failed:', error)
      // If refresh fails, log out
      await handleLogout(false)
      throw error
    }
  }

  const contextValue: AuthContextType = {
    ...state,
    login,
    logout,
    refreshToken
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
