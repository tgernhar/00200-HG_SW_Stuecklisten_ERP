/**
 * OrderDetailView Component
 * Zeigt alle Details eines Auftrags/Angebots in einer 2-Spalten Ansicht.
 * Felder sind bearbeitbar (Vorbereitung für spätere Speicherfunktion).
 */
import React, { useState, useEffect } from 'react'
import { OrderDetailItem, getContacts, getAddresses, Contact, Address } from '../../services/ordersDataApi'

interface OrderDetailViewProps {
  order: OrderDetailItem
  documentTypeLabel: string  // z.B. "Auftrag", "Angebot", etc.
}

// Form data type for editable fields
interface OrderFormData {
  reference: string
  date1: string
  date2: string
  price: string
  currency: string
  text: string
  notiz: string
  productionText: string
  calculationText: string
  printPos: boolean
  // IDs for select fields
  techcont_id: number | null
  commercialcont_id: number | null
  lieferadresse_id: number | null
}

// Accordion item configuration
interface AccordionItem {
  id: string
  label: string
  field: 'text' | 'notiz' | 'productionText' | 'calculationText'
  placeholder: string
}

const textAccordionItems: AccordionItem[] = [
  { id: 'text', label: 'Text', field: 'text', placeholder: 'Auftragstext eingeben...' },
  { id: 'notiz', label: 'Notiz', field: 'notiz', placeholder: 'Notiz eingeben...' },
  { id: 'production', label: 'Notiz Produktion', field: 'productionText', placeholder: 'Produktionsnotiz eingeben...' },
  { id: 'calculation', label: 'Notiz Nachkalkulation', field: 'calculationText', placeholder: 'Nachkalkulationsnotiz eingeben...' },
]

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '12px',
    backgroundColor: '#f5f5f5',
    minHeight: '100%',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: '8px 14px',
    borderRadius: '6px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  headerTitle: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 600,
    color: '#333',
  },
  headerSubtitle: {
    margin: 0,
    fontSize: '12px',
    color: '#666',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '3px',
    fontSize: '11px',
    fontWeight: 500,
    color: 'white',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '6px',
    padding: '14px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
  },
  cardTitle: {
    margin: '0 0 10px 0',
    fontSize: '13px',
    fontWeight: 600,
    color: '#333',
    borderBottom: '1px solid #eee',
    paddingBottom: '6px',
  },
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: '140px 1fr',
    gap: '8px 12px',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: '12px',
    color: '#666',
    fontWeight: 500,
  },
  fieldValue: {
    fontSize: '13px',
    color: '#333',
    wordBreak: 'break-word',
  },
  fieldValueEmpty: {
    fontSize: '13px',
    color: '#999',
    fontStyle: 'italic',
  },
  input: {
    padding: '6px 10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '13px',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  inputReadonly: {
    padding: '6px 10px',
    border: '1px solid #eee',
    borderRadius: '4px',
    fontSize: '13px',
    width: '100%',
    boxSizing: 'border-box' as const,
    backgroundColor: '#f9f9f9',
    color: '#666',
  },
  select: {
    padding: '6px 10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '13px',
    width: '100%',
    boxSizing: 'border-box' as const,
    backgroundColor: 'white',
  },
  textarea: {
    padding: '10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '13px',
    width: '100%',
    minHeight: '80px',
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
  },
  priceInput: {
    padding: '6px 10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '16px',
    fontWeight: 600,
    color: '#2e7d32',
    width: '150px',
    textAlign: 'right' as const,
  },
  checkbox: {
    width: '16px',
    height: '16px',
  },
  metaInfo: {
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap',
    fontSize: '12px',
    color: '#666',
    marginTop: '16px',
    paddingTop: '12px',
    borderTop: '1px solid #eee',
  },
  textareaContainer: {
    marginBottom: '12px',
  },
  // Tabs styles
  tabsContainer: {
    border: '1px solid #ddd',
    borderRadius: '6px',
    overflow: 'hidden',
    marginBottom: '16px',
  },
  tabsHeader: {
    display: 'flex',
    backgroundColor: '#f8f9fa',
    borderBottom: '1px solid #ddd',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 14px',
    cursor: 'pointer',
    userSelect: 'none' as const,
    borderRight: '1px solid #eee',
    transition: 'background-color 0.15s',
    fontSize: '12px',
    color: '#666',
  },
  tabActive: {
    backgroundColor: 'white',
    borderBottom: '2px solid #1976d2',
    marginBottom: '-1px',
    color: '#1976d2',
    fontWeight: 500,
  },
  tabLabel: {
    whiteSpace: 'nowrap' as const,
  },
  tabBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    backgroundColor: '#28a745',
    color: 'white',
    borderRadius: '8px',
    fontSize: '9px',
    fontWeight: 600,
  },
  tabBadgeActive: {
    backgroundColor: '#1976d2',
  },
  tabContent: {
    padding: '12px',
    backgroundColor: 'white',
  },
  tabTextarea: {
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '13px',
    width: '100%',
    minHeight: '120px',
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
  },
}

// Helper functions
const formatDateForInput = (dateStr: string | null): string => {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    return date.toISOString().split('T')[0]
  } catch {
    return ''
  }
}

const formatDateTime = (dateStr: string | null): string => {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('de-DE') + ' ' + date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return dateStr
  }
}

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('de-DE')
  } catch {
    return dateStr
  }
}

// ReadOnly Field component
const ReadOnlyField: React.FC<{ label: string; value: string | null | undefined }> = ({ label, value }) => (
  <>
    <span style={styles.fieldLabel}>{label}</span>
    <input
      type="text"
      value={value || ''}
      readOnly
      style={styles.inputReadonly}
    />
  </>
)

// Editable Input Field
const InputField: React.FC<{ 
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
}> = ({ label, value, onChange, type = 'text', placeholder }) => (
  <>
    <span style={styles.fieldLabel}>{label}</span>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={styles.input}
      placeholder={placeholder}
    />
  </>
)

// Select Field
const SelectField: React.FC<{ 
  label: string
  value: number | null
  onChange: (value: number | null) => void
  options: { id: number; name: string }[]
  placeholder?: string
}> = ({ label, value, onChange, options, placeholder = 'Bitte wählen...' }) => (
  <>
    <span style={styles.fieldLabel}>{label}</span>
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : null)}
      style={styles.select}
    >
      <option value="">{placeholder}</option>
      {options.map(opt => (
        <option key={opt.id} value={opt.id}>{opt.name}</option>
      ))}
    </select>
  </>
)

// TextArea Field (kept for other uses)
const TextAreaField: React.FC<{ 
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}> = ({ label, value, onChange, placeholder }) => (
  <div style={styles.textareaContainer}>
    <div style={{ ...styles.fieldLabel, marginBottom: '4px' }}>{label}</div>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={styles.textarea}
      placeholder={placeholder}
    />
  </div>
)

// Text Tabs Component
const TextTabs: React.FC<{
  items: AccordionItem[]
  values: Record<string, string>
  onChange: (field: string, value: string) => void
  defaultTabId?: string
}> = ({ items, values, onChange, defaultTabId }) => {
  const [activeTab, setActiveTab] = useState<string>(defaultTabId || items[0]?.id || '')

  const hasContent = (field: string): boolean => {
    const value = values[field]
    return Boolean(value && value.trim().length > 0)
  }

  const activeItem = items.find(item => item.id === activeTab)

  return (
    <div style={styles.tabsContainer}>
      {/* Tab Headers */}
      <div style={styles.tabsHeader}>
        {items.map((item) => {
          const isActive = activeTab === item.id
          const hasValue = hasContent(item.field)

          return (
            <div
              key={item.id}
              style={{
                ...styles.tab,
                ...(isActive ? styles.tabActive : {}),
              }}
              onClick={() => setActiveTab(item.id)}
            >
              <span style={styles.tabLabel}>{item.label}</span>
              {hasValue && (
                <span style={{
                  ...styles.tabBadge,
                  ...(isActive ? styles.tabBadgeActive : {}),
                }}>✓</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Tab Content */}
      <div style={styles.tabContent}>
        {activeItem && (
          <textarea
            value={values[activeItem.field] || ''}
            onChange={(e) => onChange(activeItem.field, e.target.value)}
            style={styles.tabTextarea}
            placeholder={activeItem.placeholder}
          />
        )}
      </div>
    </div>
  )
}

export default function OrderDetailView({ order, documentTypeLabel }: OrderDetailViewProps) {
  // Form state for editable fields
  const [formData, setFormData] = useState<OrderFormData>({
    reference: order.reference || '',
    date1: formatDateForInput(order.date1),
    date2: formatDateForInput(order.date2),
    price: order.price?.toString() || '',
    currency: order.currency || 'EUR',
    text: order.text || '',
    notiz: order.notiz || '',
    productionText: order.productionText || '',
    calculationText: order.calculationText || '',
    printPos: order.printPos === 1,
    techcont_id: null,
    commercialcont_id: null,
    lieferadresse_id: null,
  })

  // Options for select fields
  const [contacts, setContacts] = useState<Contact[]>([])
  const [addresses, setAddresses] = useState<Address[]>([])

  // Load contacts and addresses for the customer
  useEffect(() => {
    if (order.kid) {
      loadCustomerData(order.kid)
    }
  }, [order.kid])

  const loadCustomerData = async (kid: number) => {
    try {
      const [contactsRes, addressesRes] = await Promise.all([
        getContacts(kid),
        getAddresses(kid)
      ])
      setContacts(contactsRes.items)
      setAddresses(addressesRes.items)
    } catch (error) {
      console.error('Error loading customer data:', error)
    }
  }

  // Update form field
  const updateField = <K extends keyof OrderFormData>(field: K, value: OrderFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Build customer display string
  const kundeDisplay = order.kunde_name 
    ? (order.kunde_kdn ? `${order.kunde_name} (${order.kunde_kdn})` : order.kunde_name)
    : ''

  // Currency options
  const currencyOptions = [
    { id: 1, name: 'EUR' },
    { id: 2, name: 'USD' },
    { id: 3, name: 'CHF' },
    { id: 4, name: 'GBP' },
  ]

  return (
    <div style={styles.container}>
      {/* Compact Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.headerTitle}>{order.name}</h1>
          <span style={styles.headerSubtitle}>
            {documentTypeLabel} {formData.reference ? `• ${formData.reference}` : ''}
          </span>
        </div>
        {order.status_name && (
          <span style={{
            ...styles.statusBadge,
            backgroundColor: order.status_color || '#888',
          }}>
            {order.status_name}
          </span>
        )}
      </div>

      {/* Main content in 2-column grid */}
      <div style={styles.contentGrid}>
        {/* Left column: Stammdaten */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Stammdaten</h2>
          <div style={styles.fieldGrid}>
            {/* Kunde - Listbox (read-only for now, shows current value) */}
            <ReadOnlyField label="Kunde" value={kundeDisplay} />
            
            {/* Angebotsadresse - Listbox */}
            <ReadOnlyField label="Angebotsadresse" value={order.kunde_name} />
            
            {/* Lieferadresse - Listbox */}
            <SelectField 
              label="Lieferadresse"
              value={formData.lieferadresse_id}
              onChange={(v) => updateField('lieferadresse_id', v)}
              options={addresses.map(a => ({ id: a.id, name: a.suchname }))}
              placeholder={order.lieferadresse_name || 'Bitte wählen...'}
            />
            
            {/* Techn. Kontakt - Listbox */}
            <SelectField 
              label="Techn. Kontakt"
              value={formData.techcont_id}
              onChange={(v) => updateField('techcont_id', v)}
              options={contacts.map(c => ({ id: c.id, name: c.suchname }))}
              placeholder={order.techkontakt_name || 'Bitte wählen...'}
            />
            
            {/* Kfm. Kontakt - Listbox */}
            <SelectField 
              label="Kfm. Kontakt"
              value={formData.commercialcont_id}
              onChange={(v) => updateField('commercialcont_id', v)}
              options={contacts.map(c => ({ id: c.id, name: c.suchname }))}
              placeholder={order.kfmkontakt_name || 'Bitte wählen...'}
            />
          </div>

          <h2 style={{ ...styles.cardTitle, marginTop: '14px' }}>Termine & Preis</h2>
          <div style={styles.fieldGrid}>
            {/* Kunden Liefertermin - Datumsfeld */}
            <InputField 
              label="Kunden Liefertermin"
              type="date"
              value={formData.date1}
              onChange={(v) => updateField('date1', v)}
            />
            
            {/* H+G Liefertermin - Datumsfeld */}
            <InputField 
              label="H+G Liefertermin"
              type="date"
              value={formData.date2}
              onChange={(v) => updateField('date2', v)}
            />
            
            {/* Gesamtpreis - Eingabefeld */}
            <span style={styles.fieldLabel}>Gesamtpreis</span>
            <input
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => updateField('price', e.target.value)}
              style={styles.priceInput}
            />
            
            {/* Währung - Listbox */}
            <span style={styles.fieldLabel}>Währung</span>
            <select
              value={formData.currency}
              onChange={(e) => updateField('currency', e.target.value)}
              style={{ ...styles.select, width: '100px' }}
            >
              {currencyOptions.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <h2 style={{ ...styles.cardTitle, marginTop: '14px' }}>Zuständigkeiten</h2>
          <div style={styles.fieldGrid}>
            <ReadOnlyField label="Backoffice" value={order.backoffice_name} />
            <ReadOnlyField label="Vertrieb" value={order.vertrieb_name} />
          </div>
        </div>

        {/* Right column: Texte & weitere Infos */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Beschreibung</h2>
          
          {/* Text fields as Tabs */}
          <TextTabs
            items={textAccordionItems}
            values={{
              text: formData.text,
              notiz: formData.notiz,
              productionText: formData.productionText,
              calculationText: formData.calculationText,
            }}
            onChange={(field, value) => updateField(field as keyof OrderFormData, value)}
            defaultTabId="text"
          />

          <h2 style={{ ...styles.cardTitle, marginTop: '14px' }}>Konditionen</h2>
          <div style={styles.fieldGrid}>
            <ReadOnlyField label="Sprache" value={order.sprache_name} />
            <ReadOnlyField label="Zahlungsziel" value={order.zahlungsziel_text} />
            <ReadOnlyField label="Steuer" value={order.taxtype} />
            <ReadOnlyField label="Factoring" value={order.factoring_text} />
            <ReadOnlyField label="Factoring Datum" value={formatDate(order.factDat)} />
            <ReadOnlyField label="Rechnungskonto" value={order.accounting?.toString()} />
          </div>

          <div style={{ marginTop: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#333', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.printPos}
                onChange={(e) => updateField('printPos', e.target.checked)}
                style={styles.checkbox}
              />
              Alle Positionen drucken
            </label>
          </div>

          {/* Meta info footer - read-only */}
          <div style={styles.metaInfo}>
            <span>Erstellt: {formatDateTime(order.created)} {order.creator_name ? `von ${order.creator_name}` : ''}</span>
            <span>Bearbeitet: {formatDate(order.lupdat)} {order.lupdfrom ? `von ${order.lupdfrom}` : ''}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
