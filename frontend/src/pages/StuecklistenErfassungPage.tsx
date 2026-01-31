/**
 * Stücklistenerfassung Page
 * Placeholder page for future implementation
 */
import React from 'react'

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    fontFamily: 'Arial, sans-serif'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    padding: '8px 15px',
    backgroundColor: '#f0f0f0',
    borderBottom: '1px solid #cccccc'
  },
  headerTitle: {
    fontSize: '16px',
    fontWeight: 'bold' as const
  },
  content: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff'
  },
  placeholder: {
    textAlign: 'center' as const,
    color: '#666666'
  },
  title: {
    fontSize: '24px',
    marginBottom: '10px'
  },
  subtitle: {
    fontSize: '14px'
  }
}

export default function StuecklistenErfassungPage() {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.headerTitle}>Stücklistenerfassung</span>
      </div>
      
      <div style={styles.content}>
        <div style={styles.placeholder}>
          <div style={styles.title}>Stücklistenerfassung</div>
          <div style={styles.subtitle}>Diese Funktion wird in einer zukünftigen Version implementiert.</div>
        </div>
      </div>
    </div>
  )
}
