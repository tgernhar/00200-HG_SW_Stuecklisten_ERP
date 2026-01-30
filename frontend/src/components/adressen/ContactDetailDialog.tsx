/**
 * ContactDetailDialog Component
 * Shows detailed contact information in a dialog when clicking on a contact row.
 * Layout based on HUGWAWI Kontakt Details view.
 */
import React, { useState, useEffect } from 'react'
import {
  ContactDetailItem,
  ContactEmail,
  ContactPhone,
  ContactType,
  Salutation,
  getContactDetail,
  getContactEmails,
  getContactPhones,
  getContactTypes,
  getSalutations,
} from '../../services/adressenApi'
import EmailDetailDialog from './EmailDetailDialog'
import PhoneDetailDialog from './PhoneDetailDialog'

interface ContactDetailDialogProps {
  contactId: number
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
    zIndex: 1000,
  },
  dialog: {
    backgroundColor: '#fff',
    borderRadius: '4px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    width: '900px',
    maxWidth: '95vw',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '10px 16px',
    backgroundColor: '#f5f5f5',
    borderBottom: '1px solid #ddd',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 600,
    color: '#333',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    color: '#666',
    padding: '0 4px',
    lineHeight: 1,
  },
  body: {
    padding: '12px',
    overflow: 'auto',
    flex: 1,
  },
  section: {
    marginBottom: '12px',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#333',
    marginBottom: '8px',
    borderBottom: '1px solid #eee',
    paddingBottom: '4px',
  },
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
  },
  fieldBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  fieldLabel: {
    fontSize: '10px',
    color: '#666',
    fontWeight: 500,
  },
  input: {
    padding: '4px 6px',
    border: '1px solid #ccc',
    borderRadius: '3px',
    fontSize: '11px',
    width: '100%',
    boxSizing: 'border-box',
    height: '24px',
  },
  select: {
    padding: '4px 6px',
    border: '1px solid #ccc',
    borderRadius: '3px',
    fontSize: '11px',
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: 'white',
    height: '24px',
  },
  checkbox: {
    width: '14px',
    height: '14px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    color: '#333',
    cursor: 'pointer',
  },
  tablesGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    marginTop: '12px',
  },
  tableSection: {
    border: '1px solid #ddd',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  tableHeader: {
    backgroundColor: '#f5f5f5',
    padding: '6px 10px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#333',
    borderBottom: '1px solid #ddd',
  },
  tableWrapper: {
    maxHeight: '200px',
    overflow: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '11px',
  },
  th: {
    textAlign: 'left',
    padding: '6px 8px',
    backgroundColor: '#f8f9fa',
    borderBottom: '1px solid #ddd',
    fontWeight: 600,
    color: '#333',
    position: 'sticky',
    top: 0,
  },
  td: {
    padding: '6px 8px',
    borderBottom: '1px solid #eee',
    color: '#333',
  },
  tdText: {
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  checkboxCell: {
    textAlign: 'center',
  },
  footer: {
    padding: '10px 16px',
    backgroundColor: '#f5f5f5',
    borderTop: '1px solid #ddd',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
  },
  button: {
    padding: '6px 14px',
    borderRadius: '3px',
    fontSize: '12px',
    cursor: 'pointer',
    border: '1px solid #ccc',
    backgroundColor: '#f0f0f0',
    color: '#333',
  },
  buttonPrimary: {
    padding: '6px 14px',
    borderRadius: '3px',
    fontSize: '12px',
    cursor: 'pointer',
    border: 'none',
    backgroundColor: '#4a90d9',
    color: 'white',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    color: '#666',
    fontSize: '13px',
  },
  placeholder: {
    color: '#999',
    fontStyle: 'italic',
    padding: '12px',
    textAlign: 'center',
    fontSize: '11px',
  },
}

// Input field component
const InputField: React.FC<{
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}> = ({ label, value, onChange, type = 'text' }) => (
  <div style={styles.fieldBlock}>
    <span style={styles.fieldLabel}>{label}</span>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={styles.input}
    />
  </div>
)

// Select field component for dropdowns
const SelectField: React.FC<{
  label: string
  value: string
  onChange: (value: string) => void
  options: { id: number; name: string | null }[]
  placeholder?: string
}> = ({ label, value, onChange, options, placeholder = 'Bitte wählen' }) => {
  // Check if current value exists in options
  const valueExistsInOptions = options.some(opt => opt.name === value)
  
  return (
    <div style={styles.fieldBlock}>
      <span style={styles.fieldLabel}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={styles.select}
      >
        <option value="">{placeholder}</option>
        {/* If current value doesn't exist in options but has a value, show it */}
        {value && !valueExistsInOptions && (
          <option key="current" value={value}>{value}</option>
        )}
        {options.map(opt => (
          <option key={opt.id} value={opt.name || ''}>{opt.name || '-'}</option>
        ))}
      </select>
    </div>
  )
}

// Form data type
interface ContactFormData {
  lastname: string
  firstname: string
  suchname: string
  addname: string
  salutation: string
  title: string
  url: string
  birthdate: string
  function: string
  description: string
  type_name: string
  favorite: boolean
}

export default function ContactDetailDialog({ contactId, onClose }: ContactDetailDialogProps) {
  const [contact, setContact] = useState<ContactDetailItem | null>(null)
  const [emails, setEmails] = useState<ContactEmail[]>([])
  const [phones, setPhones] = useState<ContactPhone[]>([])
  const [contactTypes, setContactTypes] = useState<ContactType[]>([])
  const [salutations, setSalutations] = useState<Salutation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Selected items for detail dialogs
  const [selectedEmail, setSelectedEmail] = useState<ContactEmail | null>(null)
  const [selectedPhone, setSelectedPhone] = useState<ContactPhone | null>(null)

  // Form state
  const [formData, setFormData] = useState<ContactFormData>({
    lastname: '',
    firstname: '',
    suchname: '',
    addname: '',
    salutation: '',
    title: '',
    url: '',
    birthdate: '',
    function: '',
    description: '',
    type_name: '',
    favorite: false,
  })

  // Load data
  useEffect(() => {
    loadData()
  }, [contactId])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [contactData, emailsData, phonesData, typesData, salutationsData] = await Promise.all([
        getContactDetail(contactId),
        getContactEmails(contactId),
        getContactPhones(contactId),
        getContactTypes(),
        getSalutations(),
      ])
      
      setContact(contactData)
      setEmails(emailsData)
      setPhones(phonesData)
      setContactTypes(typesData)
      setSalutations(salutationsData)

      // Initialize form data
      setFormData({
        lastname: contactData.lastname || '',
        firstname: contactData.firstname || '',
        suchname: contactData.suchname || '',
        addname: contactData.addname || '',
        salutation: contactData.salutation || '',
        title: contactData.title || '',
        url: contactData.url || '',
        birthdate: contactData.birthdate ? contactData.birthdate.split('T')[0] : '',
        function: contactData.function || '',
        description: contactData.description || '',
        type_name: contactData.type_name || '',
        favorite: contactData.favorite === 1,
      })
    } catch (err: any) {
      console.error('Error loading contact detail:', err)
      setError(err.response?.data?.detail || 'Fehler beim Laden der Kontaktdaten')
    } finally {
      setLoading(false)
    }
  }

  // Update form field
  const updateField = <K extends keyof ContactFormData>(field: K, value: ContactFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Handle overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div style={styles.overlay} onClick={handleOverlayClick}>
      <div style={styles.dialog} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.headerTitle}>Kontakt Details</h2>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div style={styles.body}>
          {loading ? (
            <div style={styles.loading}>Lade Kontaktdaten...</div>
          ) : error ? (
            <div style={{ ...styles.loading, color: '#c00' }}>{error}</div>
          ) : (
            <>
              {/* Details Section */}
              <div style={styles.section}>
                <div style={styles.sectionTitle}>Details</div>
                <div style={styles.fieldGrid}>
                  <InputField
                    label="Name"
                    value={formData.lastname}
                    onChange={(v) => updateField('lastname', v)}
                  />
                  <InputField
                    label="Vorname"
                    value={formData.firstname}
                    onChange={(v) => updateField('firstname', v)}
                  />
                  <InputField
                    label="Suchname"
                    value={formData.suchname}
                    onChange={(v) => updateField('suchname', v)}
                  />
                  <SelectField
                    label="Typ"
                    value={formData.type_name}
                    onChange={(v) => updateField('type_name', v)}
                    options={contactTypes}
                  />
                </div>
                <div style={{ ...styles.fieldGrid, marginTop: '8px' }}>
                  <InputField
                    label="Funktion"
                    value={formData.function}
                    onChange={(v) => updateField('function', v)}
                  />
                  <InputField
                    label="Titel"
                    value={formData.title}
                    onChange={(v) => updateField('title', v)}
                  />
                  <SelectField
                    label="Anrede"
                    value={formData.salutation}
                    onChange={(v) => updateField('salutation', v)}
                    options={salutations}
                  />
                  <InputField
                    label="Geburtstag"
                    value={formData.birthdate}
                    onChange={(v) => updateField('birthdate', v)}
                    type="date"
                  />
                </div>
                <div style={{ ...styles.fieldGrid, marginTop: '8px', gridTemplateColumns: '2fr 1fr 1fr' }}>
                  <InputField
                    label="URL"
                    value={formData.url}
                    onChange={(v) => updateField('url', v)}
                  />
                  <InputField
                    label="Zus. Name"
                    value={formData.addname}
                    onChange={(v) => updateField('addname', v)}
                  />
                  <div style={{ ...styles.fieldBlock, justifyContent: 'flex-end' }}>
                    <label style={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={formData.favorite}
                        onChange={(e) => updateField('favorite', e.target.checked)}
                        style={styles.checkbox}
                      />
                      Favorit
                    </label>
                  </div>
                </div>
                <div style={{ ...styles.fieldGrid, marginTop: '8px', gridTemplateColumns: '1fr' }}>
                  <InputField
                    label="Beschreibung"
                    value={formData.description}
                    onChange={(v) => updateField('description', v)}
                  />
                </div>
              </div>

              {/* Tables Section */}
              <div style={styles.tablesGrid}>
                {/* Email Table */}
                <div style={styles.tableSection}>
                  <div style={styles.tableHeader}>EMail</div>
                  <div style={styles.tableWrapper}>
                    {emails.length === 0 ? (
                      <div style={styles.placeholder}>Diese Suche brachte keine Ergebnisse!</div>
                    ) : (
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>EMail</th>
                            <th style={styles.th}>Typ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {emails.map(email => (
                            <tr 
                              key={email.id}
                              onClick={() => setSelectedEmail(email)}
                              style={{ cursor: 'pointer' }}
                              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#e8f4fc')}
                              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '')}
                            >
                              <td style={{ ...styles.td, ...styles.tdText }} title={email.email || ''}>
                                {email.email || '-'}
                              </td>
                              <td style={styles.td}>{email.type_name || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* Phone Table */}
                <div style={styles.tableSection}>
                  <div style={styles.tableHeader}>Telefon/Fax</div>
                  <div style={styles.tableWrapper}>
                    {phones.length === 0 ? (
                      <div style={styles.placeholder}>Keine Telefonnummern vorhanden</div>
                    ) : (
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Telefon/Fax</th>
                            <th style={styles.th}>Typ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {phones.map(phone => (
                            <tr 
                              key={phone.id}
                              onClick={() => setSelectedPhone(phone)}
                              style={{ cursor: 'pointer' }}
                              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#e8f4fc')}
                              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '')}
                            >
                              <td style={{ ...styles.td, ...styles.tdText }} title={phone.phonenumber || ''}>
                                {phone.phonenumber || '-'}
                              </td>
                              <td style={styles.td}>{phone.type_name || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button style={styles.button} disabled>
            💾 Speichern
          </button>
          <button style={styles.button} disabled title="Setzt adrcont.blocked = 1">
            🚫 Sperren
          </button>
          <button style={styles.button} onClick={onClose}>
            ⊘ Schließen
          </button>
        </div>
      </div>

      {/* Email Detail Dialog */}
      {selectedEmail && (
        <EmailDetailDialog
          email={selectedEmail}
          onClose={() => setSelectedEmail(null)}
        />
      )}

      {/* Phone Detail Dialog */}
      {selectedPhone && (
        <PhoneDetailDialog
          phone={selectedPhone}
          onClose={() => setSelectedPhone(null)}
        />
      )}
    </div>
  )
}
