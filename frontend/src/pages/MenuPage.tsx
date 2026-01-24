/**
 * Menu Page - Main layout with sidebar and content area
 * Based on HUGWAWI menu structure
 */
import React, { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../contexts/AuthContext'

const SIDEBAR_COLLAPSED_KEY = 'sidebar_collapsed'

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100vh',
    overflow: 'hidden'
  },
  main: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    position: 'relative' as const,
  },
  content: {
    flex: 1,
    overflow: 'auto',
    backgroundColor: '#ffffff'
  },
  sidebarWrapper: {
    display: 'flex',
    flexShrink: 0,
  },
  sidebarToggle: {
    width: '16px',
    height: '40px',
    backgroundColor: '#e8e8e8',
    border: '1px solid #cccccc',
    borderLeft: 'none',
    borderRadius: '0 4px 4px 0',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    color: '#666666',
    alignSelf: 'center',
    marginTop: 'auto',
    marginBottom: 'auto',
  },
  welcomeContent: {
    padding: '20px',
    fontFamily: 'Arial, sans-serif'
  },
  welcomeTitle: {
    fontSize: '16px',
    fontWeight: 'bold' as const,
    marginBottom: '20px',
    color: '#333333'
  },
  welcomeText: {
    fontSize: '14px',
    color: '#333333',
    lineHeight: '1.6'
  },
  infoBox: {
    backgroundColor: '#f9f9f9',
    border: '1px solid #dddddd',
    borderRadius: '4px',
    padding: '15px',
    marginBottom: '20px'
  },
  infoTitle: {
    fontSize: '14px',
    fontWeight: 'bold' as const,
    marginBottom: '10px',
    color: '#333333'
  },
  infoText: {
    fontSize: '13px',
    color: '#666666',
    lineHeight: '1.5'
  }
}

// Welcome/Dashboard content shown at /menu
function WelcomeContent() {
  const { user, roles } = useAuth()

  const getRoleNames = () => {
    return roles.map(r => r.name).filter(Boolean).join(', ') || 'Keine Rollen zugewiesen'
  }

  return (
    <div style={styles.welcomeContent}>
      <h2 style={styles.welcomeTitle}>Willkommen im Stücklisten-ERP System</h2>
      
      <div style={styles.infoBox}>
        <div style={styles.infoTitle}>Benutzerinformationen</div>
        <div style={styles.infoText}>
          <p><strong>Angemeldet als:</strong> {user?.loginname}</p>
          <p><strong>Rollen:</strong> {getRoleNames()}</p>
        </div>
      </div>

      <div style={styles.infoBox}>
        <div style={styles.infoTitle}>Verfügbare Module</div>
        <div style={styles.infoText}>
          <p><strong>Stücklisten → SW_Stücklistenimport:</strong></p>
          <p>Import und Verwaltung von SOLIDWORKS-Stücklisten mit ERP-Integration.</p>
          <br />
          <p><strong>Fertigungsplanung → Auftragsübersicht:</strong></p>
          <p>Übersicht aller Fertigungsaufträge mit Lieferterminen und Verantwortlichen.</p>
        </div>
      </div>

      <div style={styles.infoBox}>
        <div style={styles.infoTitle}>Hinweis</div>
        <div style={styles.infoText}>
          <p>Sie werden nach 45 Minuten Inaktivität automatisch abgemeldet.</p>
        </div>
      </div>
    </div>
  )
}

export default function MenuPage() {
  const location = useLocation()
  const isWelcomePage = location.pathname === '/menu' || location.pathname === '/menu/'
  
  // Sidebar collapse state with localStorage persistence
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    return saved === 'true'
  })
  
  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed))
  }, [sidebarCollapsed])
  
  const toggleSidebar = () => {
    setSidebarCollapsed(prev => !prev)
  }

  return (
    <div style={styles.container}>
      <Header />
      <div style={styles.main}>
        {/* Sidebar with toggle button attached */}
        <div style={styles.sidebarWrapper}>
          {!sidebarCollapsed && <Sidebar />}
          <button
            style={styles.sidebarToggle}
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Menü einblenden' : 'Menü ausblenden'}
          >
            {sidebarCollapsed ? '►' : '◄'}
          </button>
        </div>
        <div style={styles.content}>
          {isWelcomePage ? <WelcomeContent /> : <Outlet />}
        </div>
      </div>
    </div>
  )
}
