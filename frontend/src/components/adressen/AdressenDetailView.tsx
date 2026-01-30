/**
 * AdressenDetailView Component
 * Shows all details of an address in a 3-column layout with contact and address tables below.
 * Fields are editable (save functionality prepared for future implementation).
 */
import React, { useState, useEffect, useMemo } from 'react'
import {
  AddressDetailItem,
  AddressContact,
  AddressLine,
  PaymentTerm,
  PackingCondition,
  getAddressContacts,
  getAddressLines,
  getPaymentTerms,
  getPackingConditions,
} from '../../services/adressenApi'
import ContactDetailDialog from './ContactDetailDialog'
import AddressLineDetailDialog from './AddressLineDetailDialog'

interface AdressenDetailViewProps {
  address: AddressDetailItem
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '10px',
    backgroundColor: '#f5f5f5',
    height: '100%',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: '6px 12px',
    borderRadius: '6px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  headerTitle: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 600,
    color: '#333',
  },
  headerSubtitle: {
    margin: 0,
    fontSize: '11px',
    color: '#666',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '8px',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '6px',
    padding: '10px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
  },
  cardTitle: {
    margin: '0 0 6px 0',
    fontSize: '12px',
    fontWeight: 600,
    color: '#333',
    borderBottom: '1px solid #eee',
    paddingBottom: '4px',
  },
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '4px',
  },
  fieldGridSingle: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '4px',
  },
  fieldRow: {
    display: 'flex',
    gap: '6px',
    alignItems: 'flex-end',
  },
  fieldBlock: {
    display: 'flex',
    flexDirection: 'column' as const,
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
    boxSizing: 'border-box' as const,
    height: '24px',
  },
  inputReadonly: {
    padding: '4px 6px',
    border: '1px solid #eee',
    borderRadius: '3px',
    fontSize: '11px',
    width: '100%',
    boxSizing: 'border-box' as const,
    backgroundColor: '#f9f9f9',
    color: '#666',
    height: '24px',
  },
  inputShort: {
    padding: '4px 6px',
    border: '1px solid #ccc',
    borderRadius: '3px',
    fontSize: '11px',
    boxSizing: 'border-box' as const,
    height: '24px',
  },
  select: {
    padding: '4px 6px',
    border: '1px solid #ccc',
    borderRadius: '3px',
    fontSize: '11px',
    width: '100%',
    boxSizing: 'border-box' as const,
    backgroundColor: 'white',
    height: '24px',
  },
  textarea: {
    padding: '6px',
    border: '1px solid #ccc',
    borderRadius: '3px',
    fontSize: '11px',
    width: '100%',
    minHeight: '50px',
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
  },
  checkbox: {
    width: '14px',
    height: '14px',
  },
  checkboxRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginTop: '4px',
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
    gap: '8px',
    flex: 1,
    minHeight: 0,
  },
  tableCard: {
    backgroundColor: 'white',
    borderRadius: '6px',
    padding: '10px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: 0,
  },
  tableWrapper: {
    flex: 1,
    overflow: 'auto',
    minHeight: 0,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '12px',
  },
  tableHead: {
    position: 'sticky' as const,
    top: 0,
    zIndex: 2,
    backgroundColor: 'white',
  },
  tableTh: {
    textAlign: 'left' as const,
    padding: '5px 6px',
    backgroundColor: '#f8f9fa',
    borderBottom: '1px solid #ddd',
    fontWeight: 600,
    color: '#333',
  },
  tableFilterTh: {
    padding: '3px 4px',
    backgroundColor: '#f0f0f0',
    borderBottom: '1px solid #ddd',
  },
  tableFilterInput: {
    width: '100%',
    padding: '3px 4px',
    fontSize: '11px',
    border: '1px solid #ccc',
    borderRadius: '2px',
    boxSizing: 'border-box' as const,
  },
  tableTd: {
    padding: '5px 6px',
    borderBottom: '1px solid #eee',
    color: '#333',
  },
  tableTdText: {
    maxWidth: '120px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  checkboxCell: {
    textAlign: 'center' as const,
  },
  placeholder: {
    color: '#999',
    fontStyle: 'italic' as const,
    padding: '12px',
    textAlign: 'center' as const,
    fontSize: '11px',
  },
}

// Helper function to format date for input
const formatDateForInput = (dateStr: string | null): string => {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    return date.toISOString().split('T')[0]
  } catch {
    return ''
  }
}

// ReadOnly Field component
const ReadOnlyField: React.FC<{ label: string; value: string | number | null | undefined; style?: React.CSSProperties }> = ({ label, value, style }) => (
  <div style={{ ...styles.fieldBlock, ...style }}>
    <span style={styles.fieldLabel}>{label}</span>
    <input
      type="text"
      value={value ?? ''}
      readOnly
      style={styles.inputReadonly}
    />
  </div>
)

// Editable Input Field with optional width
const InputField: React.FC<{
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  width?: string
  style?: React.CSSProperties
}> = ({ label, value, onChange, type = 'text', placeholder, width, style }) => (
  <div style={{ ...styles.fieldBlock, ...(width ? { width } : {}), ...style }}>
    <span style={styles.fieldLabel}>{label}</span>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...styles.input, ...(width ? { width: '100%' } : {}) }}
      placeholder={placeholder}
    />
  </div>
)

// Select Field with optional width
const SelectField: React.FC<{
  label: string
  value: number | string | null
  onChange: (value: number | string | null) => void
  options: { id: number | string; name: string | null }[]
  placeholder?: string
  width?: string
  style?: React.CSSProperties
}> = ({ label, value, onChange, options, placeholder = 'Bitte wählen...', width, style }) => (
  <div style={{ ...styles.fieldBlock, ...(width ? { width } : {}), ...style }}>
    <span style={styles.fieldLabel}>{label}</span>
    <select
      value={value ?? ''}
      onChange={(e) => {
        const val = e.target.value
        if (!val) {
          onChange(null)
        } else if (typeof options[0]?.id === 'number') {
          onChange(parseInt(val))
        } else {
          onChange(val)
        }
      }}
      style={{ ...styles.select, ...(width ? { width: '100%' } : {}) }}
    >
      <option value="">{placeholder}</option>
      {options.map(opt => (
        <option key={opt.id} value={opt.id}>{opt.name || '-'}</option>
      ))}
    </select>
  </div>
)

// Form data type for editable fields
interface AddressFormData {
  suchname: string
  url: string
  comment: string
  currency: string
  termofpayment: number | null
  packingConditions: number | null
  tage: string
  stage: string
  skonto: string
  butext: string
  invlid: string
  dnlid: string
  oldSupplierId: string
  code: string
  materialgroupid: string
  distriMaterialgroup: string
  upsAccount: string
  kdnAtDistributor: string
  sendUpsEmail: boolean
  notificationInfo: string
  notificationDate: string
  customer: boolean
  distributor: boolean
  salesprospect: boolean
  reminderstop: boolean
  blocked: boolean
  employee: boolean
  concern: boolean
}

export default function AdressenDetailView({ address }: AdressenDetailViewProps) {
  // Form state
  const [formData, setFormData] = useState<AddressFormData>({
    suchname: address.suchname || '',
    url: address.url || '',
    comment: address.comment || '',
    currency: address.currency || '',
    termofpayment: address.termofpayment,
    packingConditions: address.packingConditions,
    tage: address.tage?.toString() || '',
    stage: address.stage?.toString() || '',
    skonto: address.skonto?.toString() || '',
    butext: address.butext || '',
    invlid: address.invlid?.toString() || '',
    dnlid: address.dnlid?.toString() || '',
    oldSupplierId: address.oldSupplierId || '',
    code: address.code || '',
    materialgroupid: address.materialgroupid || '',
    distriMaterialgroup: address.distriMaterialgroup || '',
    upsAccount: address.upsAccount || '',
    kdnAtDistributor: address.kdnAtDistributor || '',
    sendUpsEmail: address.sendUpsEmail === 1,
    notificationInfo: address.notificationInfo || '',
    notificationDate: formatDateForInput(address.notificationDate),
    customer: address.customer === 1,
    distributor: address.distributor === 1,
    salesprospect: address.salesprospect === 1,
    reminderstop: address.reminderstop === 1,
    blocked: address.blocked === 1,
    employee: address.employee === 1,
    concern: address.concern != null && address.concern > 0,
  })

  // Dropdown options
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([])
  const [packingConditions, setPackingConditions] = useState<PackingCondition[]>([])

  // Related data
  const [contacts, setContacts] = useState<AddressContact[]>([])
  const [addressLines, setAddressLines] = useState<AddressLine[]>([])
  const [loadingRelated, setLoadingRelated] = useState(true)

  // Contact detail dialog
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null)

  // Address line detail dialog
  const [selectedAddressLineId, setSelectedAddressLineId] = useState<number | null>(null)

  // Table filters
  const [contactFilters, setContactFilters] = useState({
    suchname: '',
    type_name: '',
    phones: '',
    emails: '',
    function: '',
  })
  const [addressFilters, setAddressFilters] = useState({
    kdn: '',
    suchname: '',
    street: '',
    zipcode: '',
    city: '',
  })

  // Load dropdown options and related data
  useEffect(() => {
    loadDropdownOptions()
    loadRelatedData()
  }, [address.id])

  const loadDropdownOptions = async () => {
    try {
      const [terms, conditions] = await Promise.all([
        getPaymentTerms(),
        getPackingConditions(),
      ])
      setPaymentTerms(terms)
      setPackingConditions(conditions)
    } catch (error) {
      console.error('Error loading dropdown options:', error)
    }
  }

  const loadRelatedData = async () => {
    setLoadingRelated(true)
    try {
      const [contactsData, linesData] = await Promise.all([
        getAddressContacts(address.id),
        getAddressLines(address.id),
      ])
      setContacts(contactsData)
      setAddressLines(linesData)
    } catch (error) {
      console.error('Error loading related data:', error)
    } finally {
      setLoadingRelated(false)
    }
  }

  // Update form field
  const updateField = <K extends keyof AddressFormData>(field: K, value: AddressFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      if (contactFilters.suchname && !(c.suchname || '').toLowerCase().includes(contactFilters.suchname.toLowerCase())) return false
      if (contactFilters.type_name && !(c.type_name || '').toLowerCase().includes(contactFilters.type_name.toLowerCase())) return false
      if (contactFilters.phones && !(c.phones || '').toLowerCase().includes(contactFilters.phones.toLowerCase())) return false
      if (contactFilters.emails && !(c.emails || '').toLowerCase().includes(contactFilters.emails.toLowerCase())) return false
      if (contactFilters.function && !(c.function || '').toLowerCase().includes(contactFilters.function.toLowerCase())) return false
      return true
    })
  }, [contacts, contactFilters])

  // Filtered address lines
  const filteredAddressLines = useMemo(() => {
    return addressLines.filter(l => {
      if (addressFilters.kdn && !(l.kdn || '').toLowerCase().includes(addressFilters.kdn.toLowerCase())) return false
      if (addressFilters.suchname && !(l.suchname || '').toLowerCase().includes(addressFilters.suchname.toLowerCase())) return false
      if (addressFilters.street && !(l.street || '').toLowerCase().includes(addressFilters.street.toLowerCase())) return false
      if (addressFilters.zipcode && !(l.zipcode || '').toLowerCase().includes(addressFilters.zipcode.toLowerCase())) return false
      if (addressFilters.city && !(l.city || '').toLowerCase().includes(addressFilters.city.toLowerCase())) return false
      return true
    })
  }, [addressLines, addressFilters])

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.headerTitle}>{address.suchname || 'Adresse'}</h1>
          <span style={styles.headerSubtitle}>
            KDN: {address.kdn || '-'}
          </span>
        </div>
      </div>

      {/* Main content in 3-column grid */}
      <div style={styles.contentGrid}>
        {/* Column 1: Details */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Details</h2>
          <div style={styles.fieldGridSingle}>
            <ReadOnlyField label="KDN" value={address.kdn} />
            <InputField
              label="Suchname"
              value={formData.suchname}
              onChange={(v) => updateField('suchname', v)}
            />
            <InputField
              label="URL"
              value={formData.url}
              onChange={(v) => updateField('url', v)}
            />
            <div style={styles.fieldBlock}>
              <span style={styles.fieldLabel}>Kommentar</span>
              <textarea
                value={formData.comment}
                onChange={(e) => updateField('comment', e.target.value)}
                style={{ ...styles.textarea, minHeight: '80px' }}
                placeholder="Kommentar eingeben..."
              />
            </div>
          </div>

          {/* Checkboxes */}
          <div style={styles.checkboxRow}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.customer}
                onChange={(e) => updateField('customer', e.target.checked)}
                style={styles.checkbox}
              />
              Kunde
            </label>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.distributor}
                onChange={(e) => updateField('distributor', e.target.checked)}
                style={styles.checkbox}
              />
              Lieferant
            </label>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.salesprospect}
                onChange={(e) => updateField('salesprospect', e.target.checked)}
                style={styles.checkbox}
              />
              Interessent
            </label>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.reminderstop}
                onChange={(e) => updateField('reminderstop', e.target.checked)}
                style={styles.checkbox}
              />
              Mahnstop
            </label>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.concern}
                onChange={(e) => updateField('concern', e.target.checked)}
                style={styles.checkbox}
              />
              Konzern
            </label>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.employee}
                onChange={(e) => updateField('employee', e.target.checked)}
                style={styles.checkbox}
              />
              Mitarbeiter
            </label>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={formData.blocked}
                onChange={(e) => updateField('blocked', e.target.checked)}
                style={styles.checkbox}
              />
              Geblockt
            </label>
          </div>
        </div>

        {/* Column 2: Rechnungsdetails */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Rechnungsdetails</h2>
          <div style={styles.fieldGridSingle}>
            {/* Zahlziel, Versandbedingungen, Währung - moved here */}
            <SelectField
              label="Zahlziel"
              value={formData.termofpayment}
              onChange={(v) => updateField('termofpayment', v as number | null)}
              options={paymentTerms.map(t => ({ id: t.id, name: t.text ? `${t.days} Tage - ${t.text}` : `${t.days} Tage` }))}
              placeholder={address.zahlziel_text || 'Bitte wählen...'}
            />
            <SelectField
              label="Versandbedingungen"
              value={formData.packingConditions}
              onChange={(v) => updateField('packingConditions', v as number | null)}
              options={packingConditions.map(p => ({ id: p.id, name: p.name }))}
              placeholder={address.versandbedingung_name || 'Bitte wählen...'}
            />
            
            {/* Währung (80% shorter), Tage, Skonto Tage, Skonto - in one row */}
            <div style={styles.fieldRow}>
              <InputField
                label="Währung"
                value={formData.currency}
                onChange={(v) => updateField('currency', v)}
                width="45px"
              />
              <InputField
                label="Tage"
                value={formData.tage}
                onChange={(v) => updateField('tage', v)}
                type="number"
                width="45px"
              />
              <InputField
                label="Skonto T."
                value={formData.stage}
                onChange={(v) => updateField('stage', v)}
                type="number"
                width="45px"
              />
              <InputField
                label="Skonto %"
                value={formData.skonto}
                onChange={(v) => updateField('skonto', v)}
                type="number"
                width="45px"
              />
            </div>
            
            <div style={styles.fieldBlock}>
              <span style={styles.fieldLabel}>Eingehende Rechnung Defaulttext</span>
              <textarea
                value={formData.butext}
                onChange={(e) => updateField('butext', e.target.value)}
                style={{ ...styles.textarea, minHeight: '40px' }}
                placeholder="Text eingeben..."
              />
            </div>
            
            {/* Rechnungsadresse, Lieferadresse - in one row */}
            <div style={styles.fieldRow}>
              <ReadOnlyField
                label="Rechnungsadresse"
                value={address.rechnungsadresse_name || '-'}
                style={{ flex: 1 }}
              />
              <ReadOnlyField
                label="Lieferadresse"
                value={address.lieferadresse_name || '-'}
                style={{ flex: 1 }}
              />
            </div>
          </div>
        </div>

        {/* Column 3: Informationen */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Informationen</h2>
          <div style={styles.fieldGridSingle}>
            {/* Alte Lieferantennummer, Code - in one row, 80% shorter */}
            <div style={styles.fieldRow}>
              <InputField
                label="Alte LieferantenNr"
                value={formData.oldSupplierId}
                onChange={(v) => updateField('oldSupplierId', v)}
                width="70px"
              />
              <InputField
                label="Code"
                value={formData.code}
                onChange={(v) => updateField('code', v)}
                width="70px"
              />
            </div>
            
            {/* Warengruppe Kunde, Warengruppe Lieferant - in one row, 60% shorter */}
            <div style={styles.fieldRow}>
              <InputField
                label="WG Kunde"
                value={formData.materialgroupid}
                onChange={(v) => updateField('materialgroupid', v)}
                width="90px"
              />
              <InputField
                label="WG Lieferant"
                value={formData.distriMaterialgroup}
                onChange={(v) => updateField('distriMaterialgroup', v)}
                width="90px"
              />
            </div>
            
            {/* UPS Kundennummer (40% shorter), Kundennummer beim Lieferanten (60% shorter) - in one row */}
            <div style={styles.fieldRow}>
              <InputField
                label="UPS KundenNr"
                value={formData.upsAccount}
                onChange={(v) => updateField('upsAccount', v)}
                width="100px"
              />
              <InputField
                label="KdnNr b. Lief."
                value={formData.kdnAtDistributor}
                onChange={(v) => updateField('kdnAtDistributor', v)}
                width="80px"
              />
            </div>
            
            <label style={{ ...styles.checkboxLabel, marginTop: '2px' }}>
              <input
                type="checkbox"
                checked={formData.sendUpsEmail}
                onChange={(e) => updateField('sendUpsEmail', e.target.checked)}
                style={styles.checkbox}
              />
              Versandbenachrichtigung per Mail
            </label>
            <div style={styles.fieldBlock}>
              <span style={styles.fieldLabel}>Information bei Neuanlage</span>
              <textarea
                value={formData.notificationInfo}
                onChange={(e) => updateField('notificationInfo', e.target.value)}
                style={{ ...styles.textarea, minHeight: '40px' }}
                placeholder="Hinweis eingeben..."
              />
            </div>
            <InputField
              label="Benachrichtigung bis"
              value={formData.notificationDate}
              onChange={(v) => updateField('notificationDate', v)}
              type="date"
            />
          </div>
        </div>
      </div>

      {/* Tables section: Kontakt and Adresse */}
      <div style={styles.tablesGrid}>
        {/* Kontakt Table */}
        <div style={styles.tableCard}>
          <h2 style={styles.cardTitle}>Kontakt</h2>
          {loadingRelated ? (
            <div style={styles.placeholder}>Lade Kontakte...</div>
          ) : contacts.length === 0 ? (
            <div style={styles.placeholder}>Keine Kontakte vorhanden</div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead style={styles.tableHead}>
                  <tr>
                    <th style={styles.tableTh}>Suchname</th>
                    <th style={styles.tableTh}>Typ</th>
                    <th style={styles.tableTh}>Telefon</th>
                    <th style={styles.tableTh}>Email</th>
                    <th style={styles.tableTh}>Funktion</th>
                    <th style={styles.tableTh}>Fav</th>
                  </tr>
                  <tr>
                    <th style={styles.tableFilterTh}>
                      <input
                        type="text"
                        placeholder="Filter..."
                        value={contactFilters.suchname}
                        onChange={(e) => setContactFilters(prev => ({ ...prev, suchname: e.target.value }))}
                        style={styles.tableFilterInput}
                      />
                    </th>
                    <th style={styles.tableFilterTh}>
                      <input
                        type="text"
                        placeholder="Filter..."
                        value={contactFilters.type_name}
                        onChange={(e) => setContactFilters(prev => ({ ...prev, type_name: e.target.value }))}
                        style={styles.tableFilterInput}
                      />
                    </th>
                    <th style={styles.tableFilterTh}>
                      <input
                        type="text"
                        placeholder="Filter..."
                        value={contactFilters.phones}
                        onChange={(e) => setContactFilters(prev => ({ ...prev, phones: e.target.value }))}
                        style={styles.tableFilterInput}
                      />
                    </th>
                    <th style={styles.tableFilterTh}>
                      <input
                        type="text"
                        placeholder="Filter..."
                        value={contactFilters.emails}
                        onChange={(e) => setContactFilters(prev => ({ ...prev, emails: e.target.value }))}
                        style={styles.tableFilterInput}
                      />
                    </th>
                    <th style={styles.tableFilterTh}>
                      <input
                        type="text"
                        placeholder="Filter..."
                        value={contactFilters.function}
                        onChange={(e) => setContactFilters(prev => ({ ...prev, function: e.target.value }))}
                        style={styles.tableFilterInput}
                      />
                    </th>
                    <th style={styles.tableFilterTh}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.map(contact => (
                    <tr 
                      key={contact.id} 
                      onClick={() => setSelectedContactId(contact.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={styles.tableTd}>{contact.suchname || '-'}</td>
                      <td style={styles.tableTd}>{contact.type_name || '-'}</td>
                      <td style={{ ...styles.tableTd, ...styles.tableTdText }} title={contact.phones || ''}>
                        {contact.phones || '-'}
                      </td>
                      <td style={{ ...styles.tableTd, ...styles.tableTdText }} title={contact.emails || ''}>
                        {contact.emails || '-'}
                      </td>
                      <td style={styles.tableTd}>{contact.function || '-'}</td>
                      <td style={{ ...styles.tableTd, ...styles.checkboxCell }}>
                        <input type="checkbox" checked={contact.favorite === 1} disabled />
                      </td>
                    </tr>
                  ))}
                  {filteredContacts.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ ...styles.tableTd, textAlign: 'center', color: '#999' }}>
                        Keine Ergebnisse
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Adresse Table */}
        <div style={styles.tableCard}>
          <h2 style={styles.cardTitle}>Adresse</h2>
          {loadingRelated ? (
            <div style={styles.placeholder}>Lade Adressen...</div>
          ) : addressLines.length === 0 ? (
            <div style={styles.placeholder}>Keine Adresszeilen vorhanden</div>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead style={styles.tableHead}>
                  <tr>
                    <th style={styles.tableTh}>KDN</th>
                    <th style={styles.tableTh}>Suchname</th>
                    <th style={styles.tableTh}>Straße</th>
                    <th style={styles.tableTh}>PLZ</th>
                    <th style={styles.tableTh}>Stadt</th>
                  </tr>
                  <tr>
                    <th style={styles.tableFilterTh}>
                      <input
                        type="text"
                        placeholder="Filter..."
                        value={addressFilters.kdn}
                        onChange={(e) => setAddressFilters(prev => ({ ...prev, kdn: e.target.value }))}
                        style={styles.tableFilterInput}
                      />
                    </th>
                    <th style={styles.tableFilterTh}>
                      <input
                        type="text"
                        placeholder="Filter..."
                        value={addressFilters.suchname}
                        onChange={(e) => setAddressFilters(prev => ({ ...prev, suchname: e.target.value }))}
                        style={styles.tableFilterInput}
                      />
                    </th>
                    <th style={styles.tableFilterTh}>
                      <input
                        type="text"
                        placeholder="Filter..."
                        value={addressFilters.street}
                        onChange={(e) => setAddressFilters(prev => ({ ...prev, street: e.target.value }))}
                        style={styles.tableFilterInput}
                      />
                    </th>
                    <th style={styles.tableFilterTh}>
                      <input
                        type="text"
                        placeholder="Filter..."
                        value={addressFilters.zipcode}
                        onChange={(e) => setAddressFilters(prev => ({ ...prev, zipcode: e.target.value }))}
                        style={styles.tableFilterInput}
                      />
                    </th>
                    <th style={styles.tableFilterTh}>
                      <input
                        type="text"
                        placeholder="Filter..."
                        value={addressFilters.city}
                        onChange={(e) => setAddressFilters(prev => ({ ...prev, city: e.target.value }))}
                        style={styles.tableFilterInput}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAddressLines.map(line => (
                    <tr 
                      key={line.id}
                      onClick={() => setSelectedAddressLineId(line.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={styles.tableTd}>{line.kdn || '-'}</td>
                      <td style={styles.tableTd}>{line.suchname || '-'}</td>
                      <td style={{ ...styles.tableTd, ...styles.tableTdText }} title={line.street || ''}>
                        {line.street || '-'}
                      </td>
                      <td style={styles.tableTd}>{line.zipcode || '-'}</td>
                      <td style={styles.tableTd}>{line.city || '-'}</td>
                    </tr>
                  ))}
                  {filteredAddressLines.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ ...styles.tableTd, textAlign: 'center', color: '#999' }}>
                        Keine Ergebnisse
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Contact Detail Dialog */}
      {selectedContactId && (
        <ContactDetailDialog
          contactId={selectedContactId}
          onClose={() => setSelectedContactId(null)}
        />
      )}

      {/* Address Line Detail Dialog */}
      {selectedAddressLineId && (
        <AddressLineDetailDialog
          lineId={selectedAddressLineId}
          addressKdn={address.kdn}
          onClose={() => setSelectedAddressLineId(null)}
        />
      )}
    </div>
  )
}
