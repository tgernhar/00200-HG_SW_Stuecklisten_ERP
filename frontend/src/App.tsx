/**
 * Main App Component with Routing
 */
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import MenuPage from './pages/MenuPage'
import SWImportPage from './pages/SWImportPage'
import './App.css'

// Lazy load OrdersOverviewPage (will be created later)
const OrdersOverviewPage = React.lazy(() => import('./pages/OrdersOverviewPage'))

function App() {
  const { isAuthenticated, isLoading } = useAuth()

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        color: '#666666'
      }}>
        Lade...
      </div>
    )
  }

  return (
    <div className="app">
      <Routes>
        {/* Public routes */}
        <Route 
          path="/login" 
          element={
            isAuthenticated ? <Navigate to="/menu" replace /> : <LoginPage />
          } 
        />

        {/* Protected routes */}
        <Route
          path="/menu"
          element={
            <ProtectedRoute>
              <MenuPage />
            </ProtectedRoute>
          }
        >
          {/* Nested routes inside MenuPage */}
          <Route 
            path="stuecklisten/sw-import" 
            element={<SWImportPage />} 
          />
          <Route 
            path="fertigungsplanung/auftraege" 
            element={
              <React.Suspense fallback={<div style={{ padding: 20 }}>Lade Auftragsübersicht...</div>}>
                <OrdersOverviewPage />
              </React.Suspense>
            } 
          />
        </Route>

        {/* Default redirect */}
        <Route 
          path="/" 
          element={
            <Navigate to={isAuthenticated ? "/menu" : "/login"} replace />
          } 
        />

        {/* Catch all - redirect to menu or login */}
        <Route 
          path="*" 
          element={
            <Navigate to={isAuthenticated ? "/menu" : "/login"} replace />
          } 
        />
      </Routes>
    </div>
  )
}

export default App
