/**
 * OrderDetailView Component
 * Zeigt alle Details eines Auftrags/Angebots in einer 3-Spalten Ansicht.
 * Felder sind bearbeitbar (Vorbereitung für spätere Speicherfunktion).
 */
import React, { useState, useEffect } from 'react'
import { 
  OrderDetailItem, 
  getContacts, 
  getAddresses, 
  getBackofficeUsers,
  getSalesUsers,
  getLanguages,
  getPaymentTerms,
  getTaxTypes,
  getFactoringOptions,
  Contact, 
  Address,
  BackofficeUser,
  SalesUser,
  Language,
  PaymentTerm,
  TaxType,
  FactoringOption,
} from '../../services/ordersDataApi'
import PaperlessDocumentsPanel from '../dms/PaperlessDocumentsPanel'

interface OrderDetailViewProps {
  order: OrderDetailItem
  documentTypeLabel: string  // z.B. "Auftrag", "Angebot", etc.
  orderType?: number  // Order type for document type mapping
}

// Dokumenttyp-Mapping based on orderType
const getDefaultDocTypeName = (orderType: number | undefined): string | undefined => {
  switch (orderType) {
    case 3: return 'Kunden-Anfrage'           // Angebote
    case 5: return 'Lieferanten-Bestellung'   // Bestellungen
    case 14: return 'Kunden-Beistellung'      // Beistellungen
    default: return undefined
  }
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
    gridTemplateColumns: '1fr 1fr 1fr',
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
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  fieldGridSingle: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '12px',
  },
  fieldBlock: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
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
  // Main Tabs (Artikel, Dokumente, etc.)
  mainTabsContainer: {
    backgroundColor: 'white',
    borderRadius: '6px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  mainTabsHeader: {
    display: 'flex',
    backgroundColor: '#f8f9fa',
    borderBottom: '1px solid #ddd',
    padding: '0 8px',
  },
  mainTab: {
    padding: '12px 16px',
    cursor: 'pointer',
    userSelect: 'none' as const,
    fontSize: '13px',
    fontWeight: 500,
    color: '#666',
    borderBottom: '2px solid transparent',
    transition: 'all 0.15s',
  },
  mainTabActive: {
    color: '#1976d2',
    borderBottomColor: '#1976d2',
    backgroundColor: 'white',
  },
  mainTabContent: {
    padding: '16px',
    minHeight: '300px',
  },
  // Toolbar buttons
  toolbar: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
    padding: '8px',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
  },
  toolbarButton: {
    padding: '6px 12px',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'not-allowed',
    opacity: 0.7,
  },
  toolbarButtonRed: {
    backgroundColor: '#dc3545',
    color: 'white',
  },
  // Simple table
  simpleTable: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '12px',
  },
  tableTh: {
    textAlign: 'left' as const,
    padding: '8px 12px',
    backgroundColor: '#f8f9fa',
    borderBottom: '1px solid #ddd',
    fontWeight: 600,
    color: '#333',
  },
  tableTd: {
    padding: '8px 12px',
    borderBottom: '1px solid #eee',
    color: '#666',
  },
  placeholder: {
    color: '#999',
    fontStyle: 'italic' as const,
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

// ReadOnly Field component - Label ABOVE field
const ReadOnlyField: React.FC<{ label: string; value: string | null | undefined }> = ({ label, value }) => (
  <div style={styles.fieldBlock}>
    <span style={styles.fieldLabel}>{label}</span>
    <input
      type="text"
      value={value || ''}
      readOnly
      style={styles.inputReadonly}
    />
  </div>
)

// Editable Input Field - Label ABOVE field
const InputField: React.FC<{ 
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
}> = ({ label, value, onChange, type = 'text', placeholder }) => (
  <div style={styles.fieldBlock}>
    <span style={styles.fieldLabel}>{label}</span>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={styles.input}
      placeholder={placeholder}
    />
  </div>
)

// Select Field - Label ABOVE field
const SelectField: React.FC<{ 
  label: string
  value: number | string | null
  onChange: (value: number | string | null) => void
  options: { id: number | string; name: string }[]
  placeholder?: string
}> = ({ label, value, onChange, options, placeholder = 'Bitte wählen...' }) => (
  <div style={styles.fieldBlock}>
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
      style={styles.select}
    >
      <option value="">{placeholder}</option>
      {options.map(opt => (
        <option key={opt.id} value={opt.id}>{opt.name}</option>
      ))}
    </select>
  </div>
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

export default function OrderDetailView({ order, documentTypeLabel, orderType }: OrderDetailViewProps) {
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
  const [backofficeUsers, setBackofficeUsers] = useState<BackofficeUser[]>([])
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([])
  const [languages, setLanguages] = useState<Language[]>([])
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([])
  const [taxTypes, setTaxTypes] = useState<TaxType[]>([])
  const [factoringOptions, setFactoringOptions] = useState<FactoringOption[]>([])

  // Main tabs state
  const [activeMainTab, setActiveMainTab] = useState<string>('artikel')

  // Load data
  useEffect(() => {
    loadStammdaten()
    if (order.kid) {
      loadCustomerData(order.kid)
    }
  }, [order.kid])

  const loadStammdaten = async () => {
    try {
      const [backofficeRes, salesRes, langRes, paymentRes, taxRes, factRes] = await Promise.all([
        getBackofficeUsers(),
        getSalesUsers(),
        getLanguages(),
        getPaymentTerms(),
        getTaxTypes(),
        getFactoringOptions(),
      ])
      setBackofficeUsers(backofficeRes.items)
      setSalesUsers(salesRes.items)
      setLanguages(langRes.items)
      setPaymentTerms(paymentRes.items)
      setTaxTypes(taxRes.items)
      setFactoringOptions(factRes.items)
    } catch (error) {
      console.error('Error loading stammdaten:', error)
    }
  }

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
    { id: 'EUR', name: 'EUR' },
    { id: 'USD', name: 'USD' },
    { id: 'CHF', name: 'CHF' },
    { id: 'GBP', name: 'GBP' },
  ]

  // Main tabs configuration
  const mainTabs = [
    { id: 'artikel', label: 'Artikel' },
    { id: 'dokumente', label: 'Dokumente' },
    { id: 'paperless', label: 'Paperless' },
    { id: 'email', label: 'Email' },
    { id: 'arbeitszeit', label: 'Ist-Arbeitszeit' },
  ]

  return (
    <div style={styles.container}>
      {/* Header with Auftragsnr + Referenz */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.headerTitle}>{order.name}</h1>
          <span style={styles.headerSubtitle}>
            {documentTypeLabel} • Bestellnummer: {formData.reference || '-'}
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

      {/* Main content in 3-column grid */}
      <div style={styles.contentGrid}>
        {/* Column 1: Stammdaten */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Stammdaten</h2>
          <div style={styles.fieldGrid}>
            <ReadOnlyField label="Kunde" value={kundeDisplay} />
            <ReadOnlyField label="Angebotsadresse" value={order.kunde_name} />
            <SelectField 
              label="Lieferadresse"
              value={formData.lieferadresse_id}
              onChange={(v) => updateField('lieferadresse_id', v as number | null)}
              options={addresses.map(a => ({ id: a.id, name: a.suchname }))}
              placeholder={order.lieferadresse_name || 'Bitte wählen...'}
            />
            <SelectField 
              label="Techn. Kontakt"
              value={formData.techcont_id}
              onChange={(v) => updateField('techcont_id', v as number | null)}
              options={contacts.map(c => ({ id: c.id, name: c.suchname }))}
              placeholder={order.techkontakt_name || 'Bitte wählen...'}
            />
            <SelectField 
              label="Kfm. Kontakt"
              value={formData.commercialcont_id}
              onChange={(v) => updateField('commercialcont_id', v as number | null)}
              options={contacts.map(c => ({ id: c.id, name: c.suchname }))}
              placeholder={order.kfmkontakt_name || 'Bitte wählen...'}
            />
            <SelectField 
              label="Backoffice"
              value={null}
              onChange={() => {}}
              options={backofficeUsers.map(u => ({ id: u.id, name: u.loginname }))}
              placeholder={order.backoffice_name || 'Bitte wählen...'}
            />
            <SelectField 
              label="Vertrieb"
              value={null}
              onChange={() => {}}
              options={salesUsers.map(u => ({ id: u.id, name: u.loginname }))}
              placeholder={order.vertrieb_name || 'Bitte wählen...'}
            />
          </div>

          <h2 style={{ ...styles.cardTitle, marginTop: '14px' }}>Termine & Preis</h2>
          <div style={styles.fieldGrid}>
            <InputField 
              label="Kunden Liefertermin"
              type="date"
              value={formData.date1}
              onChange={(v) => updateField('date1', v)}
            />
            <InputField 
              label="H+G Liefertermin"
              type="date"
              value={formData.date2}
              onChange={(v) => updateField('date2', v)}
            />
            <div style={styles.fieldBlock}>
              <span style={styles.fieldLabel}>Gesamtpreis</span>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => updateField('price', e.target.value)}
                style={styles.priceInput}
              />
            </div>
            <SelectField 
              label="Währung"
              value={formData.currency}
              onChange={(v) => updateField('currency', v as string)}
              options={currencyOptions}
            />
          </div>
        </div>

        {/* Column 2: Text + Abrechnung */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Beschreibung</h2>
          <div style={styles.fieldBlock}>
            <span style={styles.fieldLabel}>Text</span>
            <textarea
              value={formData.text}
              onChange={(e) => updateField('text', e.target.value)}
              style={{ ...styles.textarea, minHeight: '120px' }}
              placeholder="Auftragstext eingeben..."
            />
          </div>

          <h2 style={{ ...styles.cardTitle, marginTop: '14px' }}>Abrechnung</h2>
          <div style={styles.fieldGrid}>
            <SelectField 
              label="Sprache"
              value={null}
              onChange={() => {}}
              options={languages.map(l => ({ id: l.shortName, name: l.name }))}
              placeholder={order.sprache_name || 'Bitte wählen...'}
            />
            <SelectField 
              label="Zahlungsziel"
              value={null}
              onChange={() => {}}
              options={paymentTerms.map(p => ({ id: p.id, name: p.text }))}
              placeholder={order.zahlungsziel_text || 'Bitte wählen...'}
            />
            <SelectField 
              label="Steuer"
              value={null}
              onChange={() => {}}
              options={taxTypes.map(t => ({ id: t.id, name: t.name }))}
              placeholder={order.taxtype || 'Bitte wählen...'}
            />
            <SelectField 
              label="Factoring"
              value={null}
              onChange={() => {}}
              options={factoringOptions.map(f => ({ id: f.fact, name: f.text }))}
              placeholder={order.factoring_text || 'Bitte wählen...'}
            />
            <InputField 
              label="Factoring Datum"
              type="date"
              value={formatDateForInput(order.factDat)}
              onChange={() => {}}
            />
            <div style={styles.fieldBlock}>
              <span style={styles.fieldLabel}>Rechnungskonto</span>
              <input
                type="number"
                value={order.accounting || ''}
                onChange={() => {}}
                style={styles.input}
              />
            </div>
          </div>
        </div>

        {/* Column 3: Notizen + Dokumenten-Einstellungen */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Notizen</h2>
          <div style={styles.fieldGridSingle}>
            <div style={styles.fieldBlock}>
              <span style={styles.fieldLabel}>Notiz</span>
              <textarea
                value={formData.notiz}
                onChange={(e) => updateField('notiz', e.target.value)}
                style={{ ...styles.textarea, minHeight: '80px' }}
                placeholder="Notiz eingeben..."
              />
            </div>
            <div style={styles.fieldBlock}>
              <span style={styles.fieldLabel}>Notiz Produktion</span>
              <textarea
                value={formData.productionText}
                onChange={(e) => updateField('productionText', e.target.value)}
                style={{ ...styles.textarea, minHeight: '80px' }}
                placeholder="Produktionsnotiz eingeben..."
              />
            </div>
            <div style={styles.fieldBlock}>
              <span style={styles.fieldLabel}>Notiz Nachkalkulation</span>
              <textarea
                value={formData.calculationText}
                onChange={(e) => updateField('calculationText', e.target.value)}
                style={{ ...styles.textarea, minHeight: '80px' }}
                placeholder="Nachkalkulationsnotiz eingeben..."
              />
            </div>
          </div>

          <h2 style={{ ...styles.cardTitle, marginTop: '14px' }}>Dokumenten-Einstellungen</h2>
          <div style={{ marginBottom: '12px' }}>
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

          {/* Meta info footer */}
          <div style={styles.metaInfo}>
            <span>Erstellt: {formatDateTime(order.created)} {order.creator_name ? `von ${order.creator_name}` : ''}</span>
            <span>Bearbeitet: {formatDate(order.lupdat)} {order.lupdfrom ? `von ${order.lupdfrom}` : ''}</span>
          </div>
        </div>
      </div>
      
      {/* Main Tabs: Artikel, Dokumente, Paperless, Email, Ist-Arbeitszeit */}
      <div style={styles.mainTabsContainer}>
        <div style={styles.mainTabsHeader}>
          {mainTabs.map(tab => (
            <div
              key={tab.id}
              style={{
                ...styles.mainTab,
                ...(activeMainTab === tab.id ? styles.mainTabActive : {}),
              }}
              onClick={() => setActiveMainTab(tab.id)}
            >
              {tab.label}
            </div>
          ))}
        </div>
        <div style={styles.mainTabContent}>
          {activeMainTab === 'artikel' && (
            <>
              {/* Toolbar with red buttons */}
              <div style={styles.toolbar}>
                <button style={{ ...styles.toolbarButton, ...styles.toolbarButtonRed }} disabled>Neu</button>
                <button style={{ ...styles.toolbarButton, ...styles.toolbarButtonRed }} disabled>Hinzufügen</button>
                <button style={{ ...styles.toolbarButton, ...styles.toolbarButtonRed }} disabled>Bearbeiten</button>
                <button style={{ ...styles.toolbarButton, ...styles.toolbarButtonRed }} disabled>Berechnen</button>
                <button style={{ ...styles.toolbarButton, ...styles.toolbarButtonRed }} disabled>Barcode drucken</button>
              </div>
              {/* Articles table placeholder */}
              <table style={styles.simpleTable}>
                <thead>
                  <tr>
                    <th style={styles.tableTh}>Artikel-Nr</th>
                    <th style={styles.tableTh}>Bezeichnung</th>
                    <th style={styles.tableTh}>Menge</th>
                    <th style={styles.tableTh}>Einheit</th>
                    <th style={styles.tableTh}>Lieferschein</th>
                    <th style={styles.tableTh}>Geliefert am</th>
                    <th style={styles.tableTh}>Preis</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={styles.tableTd} colSpan={7}>
                      <span style={styles.placeholder}>Artikeldaten werden noch geladen...</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </>
          )}
          {activeMainTab === 'dokumente' && (
            <div style={styles.placeholder}>HUGWAWI Dokumente - Platzhalter</div>
          )}
          {activeMainTab === 'paperless' && (
            <PaperlessDocumentsPanel
              entityType="order"
              entityId={order.id}
              entityNumber={order.name}
              title="Dokumente (Paperless)"
              defaultCollapsed={false}
              defaultDocumentTypeName={getDefaultDocTypeName(orderType)}
            />
          )}
          {activeMainTab === 'email' && (
            <div style={styles.placeholder}>Email-Integration - Platzhalter für spätere Implementierung</div>
          )}
          {activeMainTab === 'arbeitszeit' && (
            <div style={styles.placeholder}>Ist-Arbeitszeit - Platzhalter für spätere Implementierung</div>
          )}
        </div>
      </div>
    </div>
  )
}
