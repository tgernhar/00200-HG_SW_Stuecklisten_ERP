/**
 * Document Status Cell Renderer
 */
import React from 'react'

interface DocumentStatusProps {
  value?: string
  exists?: boolean
  filePath?: string
}

export const DocumentStatusRenderer: React.FC<DocumentStatusProps> = ({ value, exists, filePath }) => {
  const getStyle = () => {
    if (value === 'x' && exists) {
      return { backgroundColor: '#90EE90', color: '#000' } // Grün
    } else if (value === '1') {
      return { backgroundColor: '#FFD700', color: '#000' } // Gelb/Orange
    } else {
      return { backgroundColor: '#FFB6C1', color: '#000' } // Rot
    }
  }

  const getIcon = () => {
    if (value === 'x' && exists) {
      return '✓'
    } else if (value === '1') {
      return '⚠'
    } else {
      return '✗'
    }
  }

  return (
    <div style={{ ...getStyle(), padding: '5px', textAlign: 'center', cursor: value === 'x' && exists ? 'pointer' : 'default' }}>
      {getIcon()} {value || ''}
    </div>
  )
}
