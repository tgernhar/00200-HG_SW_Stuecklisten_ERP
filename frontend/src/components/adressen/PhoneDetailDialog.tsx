/**
 * PhoneDetailDialog Component
 * Shows phone details in a dialog when clicking on a phone row.
 * Includes phone number formatting functionality.
 */
import React, { useState, useEffect, useMemo } from 'react'
import {
  ContactPhone,
  PhoneType,
  getPhoneTypes,
} from '../../services/adressenApi'

interface PhoneDetailDialogProps {
  phone: ContactPhone
  onClose: () => void
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  dialog: {
    backgroundColor: 'white',
    borderRadius: '4px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    width: '420px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '12px 16px',
    borderBottom: '1px solid #ddd',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px 4px 0 0',
    fontWeight: 'bold',
    fontSize: '14px',
  },
  content: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  section: {
    border: '1px solid #ddd',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  sectionHeader: {
    backgroundColor: '#f5f5f5',
    padding: '8px 12px',
    fontWeight: 'bold',
    fontSize: '12px',
    borderBottom: '1px solid #ddd',
  },
  sectionContent: {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  fieldRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  fieldLabel: {
    fontSize: '12px',
    color: '#333',
    minWidth: '100px',
  },
  input: {
    padding: '6px 8px',
    border: '1px solid #ccc',
    borderRadius: '3px',
    fontSize: '12px',
  },
  inputSmall: {
    width: '50px',
    padding: '6px 8px',
    border: '1px solid #ccc',
    borderRadius: '3px',
    fontSize: '12px',
    textAlign: 'center' as const,
  },
  inputMedium: {
    width: '60px',
    padding: '6px 8px',
    border: '1px solid #ccc',
    borderRadius: '3px',
    fontSize: '12px',
    textAlign: 'center' as const,
  },
  inputLarge: {
    width: '90px',
    padding: '6px 8px',
    border: '1px solid #ccc',
    borderRadius: '3px',
    fontSize: '12px',
  },
  inputReadonly: {
    flex: 1,
    padding: '6px 8px',
    border: '1px solid #ccc',
    borderRadius: '3px',
    fontSize: '12px',
    backgroundColor: '#f5f5f5',
    color: '#666',
  },
  select: {
    flex: 1,
    padding: '6px 8px',
    border: '1px solid #ccc',
    borderRadius: '3px',
    fontSize: '12px',
    backgroundColor: 'white',
  },
  hint: {
    fontSize: '11px',
    color: '#888',
  },
  phoneInputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  checkbox: {
    marginRight: '4px',
  },
  footer: {
    padding: '12px 16px',
    borderTop: '1px solid #ddd',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    backgroundColor: '#f5f5f5',
    borderRadius: '0 0 4px 4px',
  },
  button: {
    padding: '6px 16px',
    border: '1px solid #ccc',
    borderRadius: '3px',
    backgroundColor: '#f0f0f0',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
}

/**
 * Parses an existing phone number into components.
 * Tries to extract country code, area code, and number.
 */
function parsePhoneNumber(phone: string | null): { countryCode: string; areaCode: string; number: string } {
  if (!phone) return { countryCode: '49', areaCode: '', number: '' }
  
  // Remove spaces and other characters
  let cleaned = phone.replace(/[\s\-\/]/g, '')
  
  // Check for international format
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1)
    // Try to extract German country code
    if (cleaned.startsWith('49')) {
      cleaned = cleaned.substring(2)
      // Try to find area code (common German area codes are 2-5 digits)
      // Look for parentheses first
      const parenMatch = phone.match(/\((\d+)\)/)
      if (parenMatch) {
        const areaCode = parenMatch[1]
        const numberPart = cleaned.substring(areaCode.length)
        return { countryCode: '49', areaCode, number: numberPart }
      }
      // Otherwise assume first 3-4 digits are area code
      if (cleaned.length > 6) {
        return { countryCode: '49', areaCode: cleaned.substring(0, 3), number: cleaned.substring(3) }
      }
    }
  }
  
  // If starts with 0, it's a national number
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1)
    if (cleaned.length > 6) {
      return { countryCode: '49', areaCode: cleaned.substring(0, 3), number: cleaned.substring(3) }
    }
  }
  
  // Fallback: return as-is in number field
  return { countryCode: '49', areaCode: '', number: cleaned }
}

export default function PhoneDetailDialog({ phone, onClose }: PhoneDetailDialogProps) {
  const [phoneTypes, setPhoneTypes] = useState<PhoneType[]>([])
  
  // Parse initial phone number
  const parsed = parsePhoneNumber(phone.phonenumber)
  
  const [formData, setFormData] = useState({
    countryCode: parsed.countryCode,
    areaCode: parsed.areaCode,
    number: parsed.number,
    type: phone.type || 0,
    hotline: false,
  })

  useEffect(() => {
    loadPhoneTypes()
  }, [])

  const loadPhoneTypes = async () => {
    try {
      const types = await getPhoneTypes()
      setPhoneTypes(types)
    } catch (err) {
      console.error('Failed to load phone types:', err)
    }
  }

  // Format the phone number in international format
  const formattedPhone = useMemo(() => {
    const { countryCode, areaCode, number } = formData
    if (!countryCode && !areaCode && !number) return ''
    
    let formatted = '+'
    if (countryCode) formatted += countryCode
    if (areaCode) formatted += ` (${areaCode})`
    if (number) formatted += ` ${number}`
    
    return formatted.trim()
  }, [formData.countryCode, formData.areaCode, formData.number])

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div style={styles.overlay} onClick={handleOverlayClick}>
      <div style={styles.dialog}>
        <div style={styles.header}>Phone</div>
        
        <div style={styles.content}>
          <div style={styles.section}>
            <div style={styles.sectionHeader}>Phone</div>
            <div style={styles.sectionContent}>
              {/* Phone number input with 3 fields */}
              <div style={styles.fieldRow}>
                <span style={styles.fieldLabel}>Phone</span>
                <span style={styles.hint}>Bsp: + 49 (6172) 9365 0</span>
              </div>
              <div style={styles.fieldRow}>
                <span style={styles.fieldLabel}></span>
                <div style={styles.phoneInputRow}>
                  <span>+</span>
                  <input
                    type="text"
                    value={formData.countryCode}
                    onChange={(e) => setFormData({ ...formData, countryCode: e.target.value.replace(/\D/g, '') })}
                    style={styles.inputSmall}
                    maxLength={4}
                    placeholder="49"
                  />
                  <span>(</span>
                  <input
                    type="text"
                    value={formData.areaCode}
                    onChange={(e) => setFormData({ ...formData, areaCode: e.target.value.replace(/\D/g, '') })}
                    style={styles.inputMedium}
                    maxLength={6}
                    placeholder="211"
                  />
                  <span>)</span>
                  <input
                    type="text"
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value.replace(/\D/g, '') })}
                    style={styles.inputLarge}
                    placeholder="56150679"
                  />
                </div>
              </div>
              
              {/* Formatted phone display */}
              <div style={styles.fieldRow}>
                <span style={styles.fieldLabel}>Phone</span>
                <input
                  type="text"
                  value={formattedPhone}
                  readOnly
                  style={styles.inputReadonly}
                />
              </div>
              
              {/* Type dropdown */}
              <div style={styles.fieldRow}>
                <span style={styles.fieldLabel}>Art</span>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: parseInt(e.target.value) })}
                  style={styles.select}
                >
                  <option value={0}>Bitte wählen</option>
                  {/* Show current value if not in options list */}
                  {phone.type && !phoneTypes.some(t => t.id === phone.type) && (
                    <option key="current" value={phone.type}>{phone.type_name || `Typ ${phone.type}`}</option>
                  )}
                  {phoneTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name || '-'}</option>
                  ))}
                </select>
              </div>
              
              {/* Hotline checkbox */}
              <div style={styles.fieldRow}>
                <span style={styles.fieldLabel}>Hotline Direktanruf</span>
                <input
                  type="checkbox"
                  checked={formData.hotline}
                  onChange={(e) => setFormData({ ...formData, hotline: e.target.checked })}
                  style={styles.checkbox}
                />
              </div>
            </div>
          </div>
        </div>

        <div style={styles.footer}>
          <button style={styles.button} disabled>
            💾 Speichern
          </button>
          <button style={styles.button} disabled>
            🗑️ Löschen
          </button>
          <button style={styles.button} onClick={onClose}>
            ⊘ Schließen
          </button>
        </div>
      </div>
    </div>
  )
}
