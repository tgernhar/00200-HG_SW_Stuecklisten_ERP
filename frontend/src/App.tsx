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

// Lazy load pages
const OrdersOverviewPage = React.lazy(() => import('./pages/OrdersOverviewPage'))
const ProductionPlanningPage = React.lazy(() => import('./pages/ProductionPlanningPage'))
const TodoListPage = React.lazy(() => import('./pages/TodoListPage'))
const PPSConfigPage = React.lazy(() => import('./pages/PPSConfigPage'))

// CRM Pages
const CRMDashboardPage = React.lazy(() => import('./pages/CRMDashboardPage'))
const CRMTimelinePage = React.lazy(() => import('./pages/CRMTimelinePage'))
const CRMLeadPipelinePage = React.lazy(() => import('./pages/CRMLeadPipelinePage'))
const CRMTasksPage = React.lazy(() => import('./pages/CRMTasksPage'))
const CRMSearchPage = React.lazy(() => import('./pages/CRMSearchPage'))

// Auftragsdaten Pages
const AuftragsdatenGesamtListePage = React.lazy(() => import('./pages/AuftragsdatenGesamtListePage'))
const AuftragsdatenAuftraegePage = React.lazy(() => import('./pages/AuftragsdatenAuftraegePage'))
const AuftragsdatenAngebotePage = React.lazy(() => import('./pages/AuftragsdatenAngebotePage'))
const AuftragsdatenBestellungenPage = React.lazy(() => import('./pages/AuftragsdatenBestellungenPage'))
const AuftragsdatenBeistellungenPage = React.lazy(() => import('./pages/AuftragsdatenBeistellungenPage'))

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
          <Route 
            path="produktionsplanung/planboard" 
            element={
              <React.Suspense fallback={<div style={{ padding: 20 }}>Lade Planboard...</div>}>
                <ProductionPlanningPage />
              </React.Suspense>
            } 
          />
          <Route 
            path="produktionsplanung/todos" 
            element={
              <React.Suspense fallback={<div style={{ padding: 20 }}>Lade ToDo-Liste...</div>}>
                <TodoListPage />
              </React.Suspense>
            } 
          />
          <Route 
            path="administration/pps-config" 
            element={
              <React.Suspense fallback={<div style={{ padding: 20 }}>Lade Konfiguration...</div>}>
                <PPSConfigPage />
              </React.Suspense>
            } 
          />
          {/* CRM Routes */}
          <Route 
            path="crm/dashboard" 
            element={
              <React.Suspense fallback={<div style={{ padding: 20 }}>Lade CRM Dashboard...</div>}>
                <CRMDashboardPage />
              </React.Suspense>
            } 
          />
          <Route 
            path="crm/timeline" 
            element={
              <React.Suspense fallback={<div style={{ padding: 20 }}>Lade Vorgangsakte...</div>}>
                <CRMTimelinePage />
              </React.Suspense>
            } 
          />
          <Route 
            path="crm/leads" 
            element={
              <React.Suspense fallback={<div style={{ padding: 20 }}>Lade Lead-Pipeline...</div>}>
                <CRMLeadPipelinePage />
              </React.Suspense>
            } 
          />
          <Route 
            path="crm/tasks" 
            element={
              <React.Suspense fallback={<div style={{ padding: 20 }}>Lade Aufgaben...</div>}>
                <CRMTasksPage />
              </React.Suspense>
            } 
          />
          <Route 
            path="crm/search" 
            element={
              <React.Suspense fallback={<div style={{ padding: 20 }}>Lade Suche...</div>}>
                <CRMSearchPage />
              </React.Suspense>
            } 
          />
          {/* Auftragsdaten Routes */}
          <Route 
            path="auftragsdaten/gesamtliste" 
            element={
              <React.Suspense fallback={<div style={{ padding: 20 }}>Lade GesamtListe...</div>}>
                <AuftragsdatenGesamtListePage />
              </React.Suspense>
            } 
          />
          <Route 
            path="auftragsdaten/auftraege" 
            element={
              <React.Suspense fallback={<div style={{ padding: 20 }}>Lade Aufträge...</div>}>
                <AuftragsdatenAuftraegePage />
              </React.Suspense>
            } 
          />
          <Route 
            path="auftragsdaten/angebote" 
            element={
              <React.Suspense fallback={<div style={{ padding: 20 }}>Lade Angebote...</div>}>
                <AuftragsdatenAngebotePage />
              </React.Suspense>
            } 
          />
          <Route 
            path="auftragsdaten/bestellungen" 
            element={
              <React.Suspense fallback={<div style={{ padding: 20 }}>Lade Bestellungen...</div>}>
                <AuftragsdatenBestellungenPage />
              </React.Suspense>
            } 
          />
          <Route 
            path="auftragsdaten/beistellungen" 
            element={
              <React.Suspense fallback={<div style={{ padding: 20 }}>Lade Beistellungen...</div>}>
                <AuftragsdatenBeistellungenPage />
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
