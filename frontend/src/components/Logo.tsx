/**
 * Logo Component
 * Displays the Hein + Gernhard logo image
 */
import React from 'react'

interface LogoProps {
  height?: number
}

export default function Logo({ height = 60 }: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt="Hein + Gernhard"
      style={{ 
        height: `${height}px`, 
        width: 'auto' 
      }}
    />
  )
}
