/**
 * Header Component
 * Based on HUGWAWI header design
 * 
 * Includes database switch functionality when DB_SWITCH_ENABLED is true.
 */
import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useDatabase } from '../contexts/DatabaseContext'
import Logo from './Logo'

const styles = {
  header: {
    height: '50px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #cccccc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    fontFamily: 'Arial, sans-serif'
  },
  headerTestMode: {
    height: '50px',
    backgroundColor: '#fff5f5',
    borderBottom: '2px solid #ff0000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    fontFamily: 'Arial, sans-serif'
  },
  leftSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px'
  },
  logo: {
    height: '35px',
    width: 'auto'
  },
  title: {
    fontSize: '18px',
    fontWeight: 'normal' as const,
    color: '#333333'
  },
  rightSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '30px'
  },
  clock: {
    fontSize: '20px',
    fontWeight: 'bold' as const,
    color: '#333333',
    fontFamily: 'Arial, sans-serif'
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '13px',
    color: '#666666'
  },
  slogan: {
    fontSize: '11px',
    color: '#999999',
    fontStyle: 'italic' as const
  },
  // Database Switch Styles
  dbSwitchContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 10px',
    backgroundColor: '#f0f0f0',
    borderRadius: '4px',
    border: '1px solid #ccc'
  },
  dbSwitchLabel: {
    fontSize: '11px',
    color: '#666',
    fontWeight: 500
  },
  dbSwitchToggle: {
    position: 'relative' as const,
    width: '44px',
    height: '22px',
    cursor: 'pointer'
  },
  dbSwitchTrack: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#28a745',
    borderRadius: '11px',
    transition: 'background-color 0.2s'
  },
  dbSwitchTrackTest: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#dc3545',
    borderRadius: '11px',
    transition: 'background-color 0.2s'
  },
  dbSwitchThumb: {
    position: 'absolute' as const,
    top: '2px',
    left: '2px',
    width: '18px',
    height: '18px',
    backgroundColor: '#ffffff',
    borderRadius: '50%',
    transition: 'transform 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
  },
  dbSwitchThumbActive: {
    position: 'absolute' as const,
    top: '2px',
    left: '2px',
    width: '18px',
    height: '18px',
    backgroundColor: '#ffffff',
    borderRadius: '50%',
    transition: 'transform 0.2s',
    transform: 'translateX(22px)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
  },
  dbSwitchHostLabel: {
    fontSize: '10px',
    color: '#888',
    minWidth: '90px',
    textAlign: 'right' as const
  },
  // Test Mode Warning Banner
  testModeBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 12px',
    backgroundColor: '#dc3545',
    color: '#ffffff',
    borderRadius: '4px',
    fontSize: '13px',
    fontWeight: 'bold' as const,
    animation: 'pulse 2s infinite'
  },
  testModeText: {
    fontSize: '14px',
    fontWeight: 'bold' as const,
    letterSpacing: '1px'
  }
}

export default function Header() {
  const { user } = useAuth()
  const { isTestMode, isFeatureEnabled, currentHost, setTestMode, isLoading } = useDatabase()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isSwitching, setIsSwitching] = useState(false)

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getUserDisplayName = () => {
    if (user?.vorname || user?.nachname) {
      return `${user.vorname || ''} ${user.nachname || ''}`.trim()
    }
    return user?.loginname || ''
  }

  const handleToggleDbMode = async () => {
    if (isSwitching || isLoading) return
    
    const newMode = !isTestMode
    const confirmMessage = newMode
      ? 'Wechsel zur TEST-Datenbank (10.233.159.39)?\n\nSchreiboperationen werden in der Test-Datenbank durchgeführt.'
      : 'Wechsel zur LIVE-Datenbank (10.233.159.44)?\n\nAlle Operationen sind nur lesend.'
    
    if (window.confirm(confirmMessage)) {
      setIsSwitching(true)
      try {
        await setTestMode(newMode)
      } catch (error) {
        console.error('Failed to switch database mode:', error)
        alert('Fehler beim Umschalten der Datenbank')
      } finally {
        setIsSwitching(false)
      }
    }
  }

  return (
    <header style={isTestMode ? styles.headerTestMode : styles.header}>
      <div style={styles.leftSection}>
        <Logo height={35} />
        
        {/* Database Switch - only visible when feature is enabled */}
        {isFeatureEnabled && (
          <div style={styles.dbSwitchContainer}>
            <span style={styles.dbSwitchLabel}>DB:</span>
            <div 
              style={styles.dbSwitchToggle}
              onClick={handleToggleDbMode}
              title={isTestMode ? 'Test-DB aktiv - Klicken für Live-DB' : 'Live-DB aktiv - Klicken für Test-DB'}
            >
              <div style={isTestMode ? styles.dbSwitchTrackTest : styles.dbSwitchTrack} />
              <div style={isTestMode ? styles.dbSwitchThumbActive : styles.dbSwitchThumb} />
            </div>
            <span style={styles.dbSwitchHostLabel}>
              {isSwitching ? '...' : currentHost}
            </span>
          </div>
        )}
        
        {/* Test Mode Warning Banner */}
        {isFeatureEnabled && isTestMode && (
          <div style={styles.testModeBanner}>
            <span style={styles.testModeText}>TEST-DATENBANK</span>
          </div>
        )}
        
        <span style={styles.title}>Willkommen</span>
        <span style={styles.userInfo}>
          {user?.loginname}
        </span>
      </div>
      
      <div style={styles.rightSection}>
        <span style={styles.clock}>{formatTime(currentTime)}</span>
        <span style={styles.slogan}>...mehr als Metallverarbeitung</span>
      </div>
    </header>
  )
}
