/**
 * AddressLineDetailDialog Component
 * Shows detailed address line information in a dialog when clicking on an address row.
 * Layout based on HUGWAWI Adress Details view.
 */
import React, { useState, useEffect } from 'react'
import {
  AddressLineDetailItem,
  AddressLineAccount,
  AddressLineMLine,
  Country,
  FactoringOption,
  getAddressLineDetail,
  getAddressLineAccounts,
  getAddressLineMLine,
  getCountries,
  getFactoringOptions,
} from '../../services/adressenApi'
import BankAccountDetailDialog from './BankAccountDetailDialog'

interface AddressLineDetailDialogProps {
  lineId: number
  addressKdn: string
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
    width: '1000px',
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
  columnsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1.5fr',
    gap: '16px',
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  columnTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#333',
    marginBottom: '4px',
    borderBottom: '1px solid #eee',
    paddingBottom: '4px',
  },
  fieldBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  fieldRow: {
    display: 'flex',
    gap: '8px',
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
  inputReadonly: {
    padding: '4px 6px',
    border: '1px solid #ccc',
    borderRadius: '3px',
    fontSize: '11px',
    width: '100%',
    boxSizing: 'border-box',
    height: '24px',
    backgroundColor: '#f5f5f5',
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
  tableSection: {
    marginTop: '16px',
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
    maxHeight: '180px',
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
  readonly?: boolean
  width?: string
}> = ({ label, value, onChange, type = 'text', readonly = false, width }) => (
  <div style={{ ...styles.fieldBlock, width: width || '100%' }}>
    <span style={styles.fieldLabel}>{label}</span>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={readonly ? styles.inputReadonly : styles.input}
      readOnly={readonly}
    />
  </div>
)

// Select field component
const SelectField: React.FC<{
  label: string
  value: number | string | null
  onChange: (value: number | null) => void
  options: { id: number; name: string | null }[]
  placeholder?: string
}> = ({ label, value, onChange, options, placeholder = 'Bitte wählen' }) => (
  <div style={styles.fieldBlock}>
    <span style={styles.fieldLabel}>{label}</span>
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : null)}
      style={styles.select}
    >
      <option value="">{placeholder}</option>
      {options.map(opt => (
        <option key={opt.id} value={opt.id}>{opt.name || '-'}</option>
      ))}
    </select>
  </div>
)

// Form data type
interface AddressLineFormData {
  kdn: string
  suchname: string
  isPrivate: boolean
  salestax: string
  steuernum: string
  line1: string
  line2: string
  line3: string
  line4: string
  street: string
  zipcode: string
  city: string
  country: number | null
  email: string
  islsv: boolean
  directDebitMandateDate: string
  directDebitMandateId: string
  fact: number | null
}

export default function AddressLineDetailDialog({ lineId, addressKdn, onClose }: AddressLineDetailDialogProps) {
  const [lineDetail, setLineDetail] = useState<AddressLineDetailItem | null>(null)
  const [accounts, setAccounts] = useState<AddressLineAccount[]>([])
  const [mlineData, setMlineData] = useState<AddressLineMLine | null>(null)
  const [countries, setCountries] = useState<Country[]>([])
  const [factoringOptions, setFactoringOptions] = useState<FactoringOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Bank account detail dialog
  const [selectedAccount, setSelectedAccount] = useState<AddressLineAccount | null>(null)

  // Form state
  const [formData, setFormData] = useState<AddressLineFormData>({
    kdn: '',
    suchname: '',
    isPrivate: false,
    salestax: '',
    steuernum: '',
    line1: '',
    line2: '',
    line3: '',
    line4: '',
    street: '',
    zipcode: '',
    city: '',
    country: null,
    email: '',
    islsv: false,
    directDebitMandateDate: '',
    directDebitMandateId: '',
    fact: null,
  })

  // Load data
  useEffect(() => {
    loadData()
  }, [lineId])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [detailData, accountsData, mlineResult, countriesData, factoringData] = await Promise.all([
        getAddressLineDetail(lineId),
        getAddressLineAccounts(lineId),
        getAddressLineMLine(lineId),
        getCountries(),
        getFactoringOptions(),
      ])
      
      setLineDetail(detailData)
      setAccounts(accountsData)
      setMlineData(mlineResult)
      setCountries(countriesData)
      setFactoringOptions(factoringData)

      // Initialize form data
      setFormData({
        kdn: detailData.kdn || addressKdn || '',
        suchname: detailData.suchname || '',
        isPrivate: detailData.isPrivate === 1,
        salestax: detailData.salestax || '',
        steuernum: detailData.steuernum || '',
        line1: detailData.line1 || '',
        line2: detailData.line2 || '',
        line3: detailData.line3 || '',
        line4: detailData.line4 || '',
        street: detailData.street || '',
        zipcode: detailData.zipcode || '',
        city: detailData.city || '',
        country: detailData.country,
        email: detailData.email || '',
        islsv: mlineResult?.islsv === 1,
        directDebitMandateDate: mlineResult?.directDebitMandateDate ? mlineResult.directDebitMandateDate.split('T')[0] : '',
        directDebitMandateId: mlineResult?.directDebitMandateId || '',
        fact: mlineResult?.fact || null,
      })
    } catch (err: any) {
      console.error('Error loading address line detail:', err)
      setError(err.response?.data?.detail || 'Fehler beim Laden der Adressdaten')
    } finally {
      setLoading(false)
    }
  }

  // Update form field
  const updateField = <K extends keyof AddressLineFormData>(field: K, value: AddressLineFormData[K]) => {
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
          <h2 style={styles.headerTitle}>Adress Details</h2>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div style={styles.body}>
          {loading ? (
            <div style={styles.loading}>Lade Adressdaten...</div>
          ) : error ? (
            <div style={{ ...styles.loading, color: '#c00' }}>{error}</div>
          ) : (
            <>
              {/* Three Column Layout */}
              <div style={styles.columnsGrid}>
                {/* Column 1: Details */}
                <div style={styles.column}>
                  <div style={styles.columnTitle}>Details</div>
                  <InputField
                    label="Kdn"
                    value={formData.kdn}
                    onChange={() => {}}
                    readonly
                  />
                  <InputField
                    label="Suchname"
                    value={formData.suchname}
                    onChange={(v) => updateField('suchname', v)}
                  />
                  <div style={styles.fieldBlock}>
                    <label style={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={formData.isPrivate}
                        onChange={(e) => updateField('isPrivate', e.target.checked)}
                        style={styles.checkbox}
                      />
                      Privat
                    </label>
                  </div>
                  <InputField
                    label="USt-Id"
                    value={formData.salestax}
                    onChange={(v) => updateField('salestax', v)}
                  />
                  <InputField
                    label="SteuerNr"
                    value={formData.steuernum}
                    onChange={(v) => updateField('steuernum', v)}
                  />
                </div>

                {/* Column 2: Adresse */}
                <div style={styles.column}>
                  <div style={styles.columnTitle}>Adresse</div>
                  <InputField
                    label="Adresskopfzeile 1"
                    value={formData.line1}
                    onChange={(v) => updateField('line1', v)}
                  />
                  <InputField
                    label="Adresskopfzeile 2"
                    value={formData.line2}
                    onChange={(v) => updateField('line2', v)}
                  />
                  <InputField
                    label="Adresskopfzeile 3"
                    value={formData.line3}
                    onChange={(v) => updateField('line3', v)}
                  />
                  <InputField
                    label="Adresskopfzeile 4"
                    value={formData.line4}
                    onChange={(v) => updateField('line4', v)}
                  />
                  <InputField
                    label="Straße"
                    value={formData.street}
                    onChange={(v) => updateField('street', v)}
                  />
                  <div style={styles.fieldRow}>
                    <InputField
                      label="PLZ"
                      value={formData.zipcode}
                      onChange={(v) => updateField('zipcode', v)}
                      width="80px"
                    />
                    <InputField
                      label="Stadt"
                      value={formData.city}
                      onChange={(v) => updateField('city', v)}
                    />
                  </div>
                  <SelectField
                    label="Land"
                    value={formData.country}
                    onChange={(v) => updateField('country', v)}
                    options={countries}
                  />
                </div>

                {/* Column 3: Buchhaltungskonto */}
                <div style={styles.column}>
                  <div style={styles.columnTitle}>Buchhaltungskonto</div>
                  <div style={styles.fieldBlock}>
                    <label style={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={formData.islsv}
                        onChange={(e) => updateField('islsv', e.target.checked)}
                        style={styles.checkbox}
                      />
                      Lastschrift
                    </label>
                  </div>
                  <InputField
                    label="LSV Datum des Vertragbeginn"
                    value={formData.directDebitMandateDate}
                    onChange={(v) => updateField('directDebitMandateDate', v)}
                    type="date"
                  />
                  <InputField
                    label="SEPA-Lastschrift-Mandat"
                    value={formData.directDebitMandateId}
                    onChange={(v) => updateField('directDebitMandateId', v)}
                  />
                  <SelectField
                    label="Factoring"
                    value={formData.fact}
                    onChange={(v) => updateField('fact', v)}
                    options={factoringOptions}
                  />
                  <InputField
                    label="Email"
                    value={formData.email}
                    onChange={(v) => updateField('email', v)}
                  />
                </div>
              </div>

              {/* Bank Table Section */}
              <div style={styles.tableSection}>
                <div style={styles.tableHeader}>Bank</div>
                <div style={styles.tableWrapper}>
                  {accounts.length === 0 ? (
                    <div style={styles.placeholder}>Keine Bankkonten vorhanden</div>
                  ) : (
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>SteuerNr</th>
                          <th style={styles.th}>BLZ</th>
                          <th style={styles.th}>KtoNr</th>
                          <th style={styles.th}>IBAN</th>
                          <th style={styles.th}>Swift</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accounts.map(account => (
                          <tr 
                            key={account.id}
                            onClick={() => setSelectedAccount(account)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td style={styles.td}>{account.taxnumber || '-'}</td>
                            <td style={styles.td}>{account.bankcode || '-'}</td>
                            <td style={styles.td}>{account.accountnumber || '-'}</td>
                            <td style={{ ...styles.td, ...styles.tdText }} title={account.iban || ''}>
                              {account.iban || '-'}
                            </td>
                            <td style={styles.td}>{account.swift || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button style={styles.button} onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>

      {/* Bank Account Detail Dialog */}
      {selectedAccount && (
        <BankAccountDetailDialog
          account={selectedAccount}
          onClose={() => setSelectedAccount(null)}
        />
      )}
    </div>
  )
}
