/**
 * Logo Component
 * Displays the Hein + Gernhard logo
 * Falls back to text if image not available
 */
import React, { useState } from 'react'

interface LogoProps {
  height?: number
  showText?: boolean
}

export default function Logo({ height = 40, showText = false }: LogoProps) {
  const [imageError, setImageError] = useState(false)

  // If image fails to load, show text fallback
  if (imageError) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontFamily: 'Arial, sans-serif'
      }}>
        <span style={{
          fontSize: height * 0.6,
          fontWeight: 'bold',
          color: '#003399'
        }}>
          <span style={{ color: '#cc0000' }}>H</span>
          <span style={{ color: '#cc0000' }}>+</span>
          <span style={{ color: '#003399' }}>G</span>
        </span>
        {showText && (
          <span style={{
            fontSize: height * 0.35,
            fontWeight: 'bold'
          }}>
            <span style={{ color: '#cc0000' }}>HEIN</span>
            <span style={{ color: '#cc0000' }}>+</span>
            <br />
            <span style={{ color: '#003399' }}>GERNHARD</span>
          </span>
        )}
      </div>
    )
  }

  return (
    <img
      src="/logo.png"
      alt="Hein + Gernhard"
      style={{ height: `${height}px`, width: 'auto' }}
      onError={() => setImageError(true)}
    />
  )
}
