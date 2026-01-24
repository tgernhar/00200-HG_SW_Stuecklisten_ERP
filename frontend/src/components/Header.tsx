/**
 * Header Component
 * Based on HUGWAWI header design
 */
import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
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
  leftSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px'
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
  }
}

export default function Header() {
  const { user } = useAuth()
  const [currentTime, setCurrentTime] = useState(new Date())

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

  return (
    <header style={styles.header}>
      <div style={styles.leftSection}>
        <Logo height={35} />
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
