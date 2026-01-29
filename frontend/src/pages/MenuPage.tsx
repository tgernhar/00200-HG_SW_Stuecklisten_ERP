/**
 * Menu Page - Main layout with sidebar and content area
 * Based on HUGWAWI menu structure
 */
import React, { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import WelcomeEditorDialog from '../components/WelcomeEditorDialog'

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
  editButton: {
    padding: '8px 16px',
    backgroundColor: '#4a90d9',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    marginBottom: '15px',
  },
  loadingText: {
    color: '#666',
    fontStyle: 'italic' as const,
  },
  welcomeHtmlContent: {
    fontSize: '14px',
    color: '#333333',
    lineHeight: '1.6',
  }
}

// Welcome/Dashboard content shown at /menu
function WelcomeContent() {
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MenuPage.tsx:WelcomeContent',message:'WelcomeContent render start',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
  const { roles } = useAuth()
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MenuPage.tsx:useAuth',message:'roles from useAuth',data:{roles:roles,rolesType:typeof roles,isArray:Array.isArray(roles)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
  const [welcomeText, setWelcomeText] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)

  // Prüfen ob User Verwaltungs-Rolle hat (isVerwaltung = 1)
  const canEdit = roles && Array.isArray(roles) ? roles.some(r => r.isVerwaltung === 1) : false

  useEffect(() => {
    loadWelcomeText()
  }, [])

  const loadWelcomeText = async () => {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MenuPage.tsx:loadWelcomeText',message:'loadWelcomeText called',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    try {
      const response = await api.get('/hugwawi/welcometext')
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MenuPage.tsx:loadWelcomeText',message:'API success',data:{hasText:!!response.data.text,textLength:response.data.text?.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      setWelcomeText(response.data.text || '')
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MenuPage.tsx:loadWelcomeText',message:'API error',data:{error:String(error)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      console.error('Error loading welcome text:', error)
      setWelcomeText('<p>Willkommen im System.</p>')
    } finally {
      setLoading(false)
    }
  }

  const handleEditorClose = () => {
    setEditorOpen(false)
  }

  const handleEditorSave = (html: string) => {
    // Speichern ist deaktiviert - wird später implementiert
    console.log('Save disabled - HTML would be:', html)
  }

  if (loading) {
    return (
      <div style={styles.welcomeContent}>
        <p style={styles.loadingText}>Lade Willkommenstext...</p>
      </div>
    )
  }

  return (
    <div style={styles.welcomeContent}>
      {canEdit && (
        <button 
          style={styles.editButton} 
          onClick={() => setEditorOpen(true)}
        >
          Bearbeiten
        </button>
      )}
      
      <div 
        style={styles.welcomeHtmlContent}
        dangerouslySetInnerHTML={{ __html: welcomeText }} 
      />

      {editorOpen && (
        <WelcomeEditorDialog
          initialContent={welcomeText}
          onClose={handleEditorClose}
          onSave={handleEditorSave}
        />
      )}
    </div>
  )
}

export default function MenuPage() {
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'MenuPage.tsx:MenuPage',message:'MenuPage render start',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
  // #endregion
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
