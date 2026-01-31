/**
 * ArtikelDetailView Component
 * Shows all details of an article in a 2-column layout.
 * Left: Standard fields, Right: Dynamic custom fields based on materialgroup.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ArticleDetailItem,
  CustomFieldLabel,
  Department,
  CalculationType,
  Calculation,
  MaterialgroupDropdownItem,
  CustomerSearchResult,
  SelectlistValue,
  ArticleDistributor,
  DistributorPriceinfo,
  getArticleDetail,
  getCustomFieldLabels,
  getCalculationsForArticle,
  getDepartments,
  getCalculationTypes,
  getMaterialgroupsForDropdown,
  searchCustomers,
  getSelectlistValues,
  getArticleDistributors,
  getDistributorPriceinfos,
} from '../../services/artikelApi'
import LieferantDetailDialog from './LieferantDetailDialog'
import PreisinfoDetailDialog from './PreisinfoDetailDialog'

interface ArtikelDetailViewProps {
  articleId: number
  onClose?: () => void
  onToggleFullscreen?: () => void
  isFullscreen?: boolean
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 12px',
    backgroundColor: 'white',
    borderBottom: '1px solid #ddd',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  headerTitle: {
    margin: 0,
    fontSize: '13px',
    fontWeight: 600,
    color: '#333',
  },
  headerSubtitle: {
    fontSize: '11px',
    color: '#666',
  },
  headerButtons: {
    display: 'flex',
    gap: '8px',
  },
  headerButton: {
    padding: '3px 10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: '#f5f5f5',
    cursor: 'pointer',
    fontSize: '11px',
  },
  body: {
    flex: 1,
    overflow: 'auto',
    padding: '10px',
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    marginBottom: '10px',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '6px',
    padding: '10px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  cardTitle: {
    margin: '0 0 8px 0',
    fontSize: '12px',
    fontWeight: 600,
    color: '#333',
    borderBottom: '1px solid #eee',
    paddingBottom: '4px',
  },
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '5px 8px',
  },
  fieldGridSingle: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '5px',
  },
  fieldRow: {
    display: 'flex',
    gap: '6px',
    alignItems: 'flex-end',
  },
  fieldBlock: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1px',
  },
  fieldLabel: {
    fontSize: '9px',
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
    height: '22px',
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
    height: '22px',
  },
  select: {
    padding: '4px 6px',
    border: '1px solid #ccc',
    borderRadius: '3px',
    fontSize: '11px',
    width: '100%',
    boxSizing: 'border-box' as const,
    backgroundColor: 'white',
    height: '22px',
  },
  autocompleteContainer: {
    position: 'relative' as const,
    width: '100%',
  },
  autocompleteDropdown: {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    border: '1px solid #ccc',
    borderRadius: '4px',
    maxHeight: '200px',
    overflow: 'auto',
    zIndex: 100,
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },
  autocompleteItem: {
    padding: '6px 8px',
    cursor: 'pointer',
    fontSize: '11px',
    borderBottom: '1px solid #eee',
  },
  tablesGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },
  tableCard: {
    backgroundColor: 'white',
    borderRadius: '6px',
    padding: '10px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    minHeight: '120px',
  },
  tablePlaceholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '80px',
    color: '#999',
    fontSize: '10px',
    fontStyle: 'italic',
  },
  tabsContainer: {
    display: 'flex',
    borderBottom: '1px solid #ddd',
    backgroundColor: '#f9f9f9',
  },
  tab: {
    padding: '8px 16px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '11px',
    color: '#666',
    borderBottom: '2px solid transparent',
  },
  tabActive: {
    padding: '8px 16px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '11px',
    color: '#333',
    fontWeight: 600,
    borderBottom: '2px solid #4a90d9',
  },
  distributorTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '10px',
  },
  distributorTh: {
    padding: '6px 8px',
    textAlign: 'left' as const,
    borderBottom: '1px solid #ddd',
    backgroundColor: '#f5f5f5',
    fontWeight: 600,
    fontSize: '10px',
  },
  distributorTd: {
    padding: '5px 8px',
    borderBottom: '1px solid #eee',
    fontSize: '10px',
  },
  distributorRowHover: {
    backgroundColor: '#f5f9ff',
    cursor: 'pointer',
  },
  distributorRowSelected: {
    backgroundColor: '#e3f2fd',
  },
  priceTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '10px',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    fontSize: '12px',
    color: '#666',
  },
  error: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '10px',
  },
  errorText: {
    fontSize: '12px',
    color: '#c00',
  },
  checkbox: {
    marginRight: '4px',
    transform: 'scale(0.9)',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '11px',
    cursor: 'pointer',
    height: '22px',
  },
}

// Input field component
const InputField: React.FC<{
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  readonly?: boolean
  style?: React.CSSProperties
}> = ({ label, value, onChange, type = 'text', readonly = false, style }) => (
  <div style={{ ...styles.fieldBlock, ...style }}>
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
  style?: React.CSSProperties
  currentValueName?: string | null  // Name to display when value is not in options
}> = ({ label, value, onChange, options, placeholder = 'Bitte wählen...', style, currentValueName }) => {
  const valueExistsInOptions = options.some(opt => opt.id === value)
  
  return (
    <div style={{ ...styles.fieldBlock, ...style }}>
      <span style={styles.fieldLabel}>{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : null)}
        style={styles.select}
      >
        <option value="">{placeholder}</option>
        {value && !valueExistsInOptions && (
          <option key="current" value={value}>{currentValueName || `ID: ${value}`}</option>
        )}
        {options.map(opt => (
          <option key={opt.id} value={opt.id}>{opt.name || '-'}</option>
        ))}
      </select>
    </div>
  )
}

// Checkbox field component
const CheckboxField: React.FC<{
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}> = ({ label, checked, onChange }) => (
  <label style={styles.checkboxLabel}>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      style={styles.checkbox}
    />
    {label}
  </label>
)

export default function ArtikelDetailView({ articleId, onClose, onToggleFullscreen, isFullscreen }: ArtikelDetailViewProps) {
  // Data states
  const [article, setArticle] = useState<ArticleDetailItem | null>(null)
  const [customFieldLabels, setCustomFieldLabels] = useState<CustomFieldLabel[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [calculationTypes, setCalculationTypes] = useState<CalculationType[]>([])
  const [calculations, setCalculations] = useState<Calculation[]>([])
  const [selectlistValuesCache, setSelectlistValuesCache] = useState<Record<number, SelectlistValue[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Tab and distributor states
  const [activeTab, setActiveTab] = useState<'lagerbestand' | 'anhaenge' | 'lieferanten' | 'seriennummern'>('lieferanten')
  const [distributors, setDistributors] = useState<ArticleDistributor[]>([])
  const [selectedDistributorId, setSelectedDistributorId] = useState<number | null>(null)
  const [distributorPriceinfos, setDistributorPriceinfos] = useState<DistributorPriceinfo[]>([])
  const [selectedPriceinfo, setSelectedPriceinfo] = useState<DistributorPriceinfo | null>(null)
  const [showLieferantDialog, setShowLieferantDialog] = useState(false)
  const [showPreisinfoDialog, setShowPreisinfoDialog] = useState(false)

  // Autocomplete states
  const [materialgroupSearch, setMaterialgroupSearch] = useState('')
  const [materialgroupOptions, setMaterialgroupOptions] = useState<MaterialgroupDropdownItem[]>([])
  const [showMaterialgroupDropdown, setShowMaterialgroupDropdown] = useState(false)
  
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerOptions, setCustomerOptions] = useState<CustomerSearchResult[]>([])
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)

  // Form state for editable fields
  const [formData, setFormData] = useState<Record<string, any>>({})

  // Load article data
  useEffect(() => {
    loadData()
  }, [articleId])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [articleData, deptData, calcTypeData] = await Promise.all([
        getArticleDetail(articleId),
        getDepartments(),
        getCalculationTypes(),
      ])
      
      setArticle(articleData)
      setDepartments(deptData)
      setCalculationTypes(calcTypeData)
      
      // Set search field values
      setMaterialgroupSearch(articleData.materialgroup_name || '')
      setCustomerSearch(articleData.customer_name || '')
      
      // Initialize form data
      setFormData({
        articlenumber: articleData.articlenumber || '',
        index: articleData.index || '',
        description: articleData.description || '',
        sparepart: articleData.sparepart || '',
        materialgroup: articleData.materialgroup,
        kid: articleData.kid,
        department: articleData.department,
        calculation: articleData.calculation,
        purchasecalctype: articleData.purchasecalctype,
        salescalctype: articleData.salescalctype,
        purchasegrade: articleData.purchasegrade?.toString() || '',
        salesgrade: articleData.salesgrade?.toString() || '',
        weight: articleData.weight?.toString() || '',
        ekdatum: articleData.ekdatum ? articleData.ekdatum.split('T')[0] : '',
        ekmenge: articleData.ekmenge?.toString() || '',
        salesfactor: articleData.salesfactor?.toString() || '',
        wastefactor: articleData.wastefactor?.toString() || '',
        din: articleData.din || '',
        en: articleData.en || '',
        iso: articleData.iso || '',
        // Custom fields
        ...Object.fromEntries(
          Array.from({ length: 15 }, (_, i) => [`customtext${i + 1}`, articleData[`customtext${i + 1}` as keyof ArticleDetailItem] || ''])
        ),
        ...Object.fromEntries(
          Array.from({ length: 5 }, (_, i) => {
            const val = articleData[`customdate${i + 1}` as keyof ArticleDetailItem]
            return [`customdate${i + 1}`, val ? String(val).split('T')[0] : '']
          })
        ),
        ...Object.fromEntries(
          Array.from({ length: 6 }, (_, i) => [`customint${i + 1}`, articleData[`customint${i + 1}` as keyof ArticleDetailItem]?.toString() || ''])
        ),
        ...Object.fromEntries(
          Array.from({ length: 10 }, (_, i) => [`customfloat${i + 1}`, articleData[`customfloat${i + 1}` as keyof ArticleDetailItem]?.toString() || ''])
        ),
        ...Object.fromEntries(
          Array.from({ length: 6 }, (_, i) => [`customboolean${i + 1}`, articleData[`customboolean${i + 1}` as keyof ArticleDetailItem] === 1])
        ),
      })
      
      // Load custom field labels and calculations
      const [labelsData, calcsData] = await Promise.all([
        getCustomFieldLabels(articleId),
        getCalculationsForArticle(articleId),
      ])
      setCustomFieldLabels(labelsData)
      setCalculations(calcsData)
      
      // Load selectlist values for custom fields that have a selectlist assigned
      const selectlistIds = [...new Set(
        labelsData
          .filter(label => label.selectlist != null)
          .map(label => label.selectlist as number)
      )]
      
      if (selectlistIds.length > 0) {
        const selectlistPromises = selectlistIds.map(async (id) => {
          const values = await getSelectlistValues(id)
          return { id, values }
        })
        const selectlistResults = await Promise.all(selectlistPromises)
        const newCache: Record<number, SelectlistValue[]> = {}
        selectlistResults.forEach(({ id, values }) => {
          newCache[id] = values
        })
        setSelectlistValuesCache(newCache)
      }
      
      // Load distributors for the article
      const distributorsData = await getArticleDistributors(articleId)
      setDistributors(distributorsData)
      
      // Load priceinfos for first distributor if available
      if (distributorsData.length > 0) {
        setSelectedDistributorId(distributorsData[0].id)
        const priceinfos = await getDistributorPriceinfos(distributorsData[0].id)
        setDistributorPriceinfos(priceinfos)
      }
      
    } catch (err: any) {
      console.error('Error loading article detail:', err)
      setError(err.response?.data?.detail || 'Fehler beim Laden der Artikeldaten')
    } finally {
      setLoading(false)
    }
  }
  
  // Load priceinfos when distributor selection changes
  const loadDistributorPriceinfos = async (distributorId: number) => {
    setSelectedDistributorId(distributorId)
    try {
      const priceinfos = await getDistributorPriceinfos(distributorId)
      setDistributorPriceinfos(priceinfos)
    } catch (err) {
      console.error('Error loading priceinfos:', err)
      setDistributorPriceinfos([])
    }
  }

  // Update form field
  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Materialgroup search
  const handleMaterialgroupSearch = useCallback(async (search: string) => {
    setMaterialgroupSearch(search)
    if (search.length >= 2) {
      const results = await getMaterialgroupsForDropdown(search)
      setMaterialgroupOptions(results)
      setShowMaterialgroupDropdown(true)
    } else {
      setShowMaterialgroupDropdown(false)
    }
  }, [])

  const selectMaterialgroup = (item: MaterialgroupDropdownItem) => {
    setMaterialgroupSearch(item.name || '')
    updateField('materialgroup', item.id)
    setShowMaterialgroupDropdown(false)
  }

  // Customer search
  const handleCustomerSearch = useCallback(async (search: string) => {
    setCustomerSearch(search)
    if (search.length >= 2) {
      const results = await searchCustomers(search)
      setCustomerOptions(results)
      setShowCustomerDropdown(true)
    } else {
      setShowCustomerDropdown(false)
    }
  }, [])

  const selectCustomer = (item: CustomerSearchResult) => {
    setCustomerSearch(item.suchname || '')
    updateField('kid', item.id)
    setShowCustomerDropdown(false)
  }

  // Render custom field based on type
  const renderCustomField = (label: CustomFieldLabel) => {
    const fieldName = label.field_name
    const fieldType = label.field_type
    const displayLabel = label.label || fieldName
    
    // 1. Boolean -> Checkbox
    if (fieldType === 'java.lang.Boolean') {
      return (
        <CheckboxField
          key={label.id}
          label={displayLabel}
          checked={formData[fieldName] === true}
          onChange={(v) => updateField(fieldName, v)}
        />
      )
    }
    
    // 2. Date -> Date input with calendar
    if (fieldType === 'java.util.Date') {
      return (
        <InputField
          key={label.id}
          label={displayLabel}
          value={formData[fieldName] || ''}
          onChange={(v) => updateField(fieldName, v)}
          type="date"
        />
      )
    }
    
    // 3. Selectlist assigned -> Dropdown
    if (label.selectlist != null) {
      const selectlistOptions = selectlistValuesCache[label.selectlist] || []
      return (
        <div key={label.id} style={styles.fieldBlock}>
          <span style={styles.fieldLabel}>{displayLabel}</span>
          <select
            value={formData[fieldName] || ''}
            onChange={(e) => updateField(fieldName, e.target.value)}
            style={styles.select}
          >
            <option value="">Bitte wählen...</option>
            {selectlistOptions.map(opt => (
              <option key={opt.id} value={opt.value || ''}>{opt.value || '-'}</option>
            ))}
          </select>
        </div>
      )
    }
    
    // 4. Default: text/number input
    return (
      <InputField
        key={label.id}
        label={displayLabel}
        value={formData[fieldName] || ''}
        onChange={(v) => updateField(fieldName, v)}
        type={fieldType.includes('Integer') || fieldType.includes('Float') ? 'number' : 'text'}
      />
    )
  }

  if (loading) {
    return <div style={styles.loading}>Lade Artikeldaten...</div>
  }

  if (error) {
    return (
      <div style={styles.error}>
        <span style={styles.errorText}>{error}</span>
        {onClose && (
          <button style={styles.headerButton} onClick={onClose}>
            Zurück
          </button>
        )}
      </div>
    )
  }

  if (!article) return null

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.headerTitle}>
            Artikel: {article.articlenumber || '-'} / {article.index || '-'}
          </h1>
          <span style={styles.headerSubtitle}>
            {article.description || 'Keine Bezeichnung'}
          </span>
        </div>
        <div style={styles.headerButtons}>
          {onToggleFullscreen && (
            <button style={styles.headerButton} onClick={onToggleFullscreen}>
              {isFullscreen ? '◫ Split' : '⬜ Vollbild'}
            </button>
          )}
          {onClose && (
            <button style={styles.headerButton} onClick={onClose}>
              ✕ Schließen
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={styles.body}>
        {/* Main content grid */}
        <div style={styles.contentGrid}>
          {/* Left column: Standard fields */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Artikeldaten</h2>
            <div style={styles.fieldGrid}>
              {/* Warengruppensuche */}
              <div style={styles.autocompleteContainer}>
                <InputField
                  label="Warengruppensuche"
                  value={materialgroupSearch}
                  onChange={handleMaterialgroupSearch}
                />
                {showMaterialgroupDropdown && materialgroupOptions.length > 0 && (
                  <div style={styles.autocompleteDropdown}>
                    {materialgroupOptions.map(item => (
                      <div
                        key={item.id}
                        style={styles.autocompleteItem}
                        onClick={() => selectMaterialgroup(item)}
                        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
                        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                      >
                        {item.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Kundensuche */}
              <div style={styles.autocompleteContainer}>
                <InputField
                  label="Kundensuche"
                  value={customerSearch}
                  onChange={handleCustomerSearch}
                />
                {showCustomerDropdown && customerOptions.length > 0 && (
                  <div style={styles.autocompleteDropdown}>
                    {customerOptions.map(item => (
                      <div
                        key={item.id}
                        style={styles.autocompleteItem}
                        onClick={() => selectCustomer(item)}
                        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
                        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                      >
                        {item.suchname} ({item.kdn})
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <InputField
                label="Artikelnummer"
                value={formData.articlenumber}
                onChange={(v) => updateField('articlenumber', v)}
              />
              <InputField
                label="Index"
                value={formData.index}
                onChange={(v) => updateField('index', v)}
              />

              <InputField
                label="Bezeichnung"
                value={formData.description}
                onChange={(v) => updateField('description', v)}
              />
              <InputField
                label="Teilenummer"
                value={formData.sparepart}
                onChange={(v) => updateField('sparepart', v)}
              />

              <SelectField
                label="Abteilung"
                value={formData.department}
                onChange={(v) => updateField('department', v)}
                options={departments}
                currentValueName={article?.department_name}
              />
              <SelectField
                label="VK-Berechnung"
                value={formData.calculation}
                onChange={(v) => updateField('calculation', v)}
                options={calculations}
                currentValueName={article?.calculation_name}
              />

              <SelectField
                label="Einkaufseinheit"
                value={formData.purchasecalctype}
                onChange={(v) => updateField('purchasecalctype', v)}
                options={calculationTypes}
                currentValueName={article?.purchasecalctype_name}
              />
              <SelectField
                label="Verkaufseinheit"
                value={formData.salescalctype}
                onChange={(v) => updateField('salescalctype', v)}
                options={calculationTypes}
                currentValueName={article?.salescalctype_name}
              />

              <InputField
                label="EK VPE"
                value={formData.purchasegrade}
                onChange={(v) => updateField('purchasegrade', v)}
                type="number"
              />
              <InputField
                label="VK VPE"
                value={formData.salesgrade}
                onChange={(v) => updateField('salesgrade', v)}
                type="number"
              />

              <InputField
                label="Gewicht"
                value={formData.weight}
                onChange={(v) => updateField('weight', v)}
                type="number"
              />
              <InputField
                label="EK-Datum"
                value={formData.ekdatum}
                onChange={(v) => updateField('ekdatum', v)}
                type="date"
              />

              <InputField
                label="EK-Menge"
                value={formData.ekmenge}
                onChange={(v) => updateField('ekmenge', v)}
                type="number"
              />
              <InputField
                label="Verkaufsfaktor"
                value={formData.salesfactor}
                onChange={(v) => updateField('salesfactor', v)}
                type="number"
              />

              <InputField
                label="Verschnittfaktor"
                value={formData.wastefactor}
                onChange={(v) => updateField('wastefactor', v)}
                type="number"
              />
              <InputField
                label="DIN"
                value={formData.din}
                onChange={(v) => updateField('din', v)}
              />

              <InputField
                label="EN"
                value={formData.en}
                onChange={(v) => updateField('en', v)}
              />
              <InputField
                label="ISO"
                value={formData.iso}
                onChange={(v) => updateField('iso', v)}
              />
            </div>
          </div>

          {/* Right column: Custom fields */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Zusatzfelder</h2>
            <div style={styles.fieldGrid}>
              {customFieldLabels.length === 0 ? (
                <div style={{ ...styles.tablePlaceholder, gridColumn: '1 / -1' }}>
                  Keine Zusatzfelder für diese Warengruppe konfiguriert
                </div>
              ) : (
                customFieldLabels.map(label => renderCustomField(label))
              )}
            </div>
          </div>
        </div>

        {/* Bottom tables with tabs */}
        <div style={styles.tablesGrid}>
          {/* Left: Tab panel */}
          <div style={styles.tableCard}>
            <div style={styles.tabsContainer}>
              <button
                style={activeTab === 'lagerbestand' ? styles.tabActive : styles.tab}
                onClick={() => setActiveTab('lagerbestand')}
              >
                Lagerbestand
              </button>
              <button
                style={activeTab === 'anhaenge' ? styles.tabActive : styles.tab}
                onClick={() => setActiveTab('anhaenge')}
              >
                Anhänge
              </button>
              <button
                style={activeTab === 'lieferanten' ? styles.tabActive : styles.tab}
                onClick={() => setActiveTab('lieferanten')}
              >
                Lieferanten
              </button>
              <button
                style={activeTab === 'seriennummern' ? styles.tabActive : styles.tab}
                onClick={() => setActiveTab('seriennummern')}
              >
                Seriennummern
              </button>
            </div>

            {activeTab === 'lieferanten' && (
              <div style={{ overflow: 'auto', maxHeight: '200px' }}>
                <table style={styles.distributorTable}>
                  <thead>
                    <tr>
                      <th style={styles.distributorTh}>Lieferant</th>
                      <th style={styles.distributorTh}>Bewertung</th>
                      <th style={styles.distributorTh}>Lieferzeit</th>
                      <th style={styles.distributorTh}>Artikel-Nr</th>
                    </tr>
                  </thead>
                  <tbody>
                    {distributors.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ ...styles.distributorTd, textAlign: 'center', color: '#999' }}>
                          Keine Lieferanten vorhanden
                        </td>
                      </tr>
                    ) : (
                      distributors.map(dist => (
                        <tr
                          key={dist.id}
                          style={selectedDistributorId === dist.id ? styles.distributorRowSelected : undefined}
                          onClick={() => loadDistributorPriceinfos(dist.id)}
                          onDoubleClick={() => {
                            setSelectedDistributorId(dist.id)
                            setShowLieferantDialog(true)
                          }}
                          onMouseOver={(e) => {
                            if (selectedDistributorId !== dist.id) {
                              e.currentTarget.style.backgroundColor = '#f5f9ff'
                            }
                          }}
                          onMouseOut={(e) => {
                            if (selectedDistributorId !== dist.id) {
                              e.currentTarget.style.backgroundColor = ''
                            }
                          }}
                        >
                          <td style={{ ...styles.distributorTd, cursor: 'pointer' }}>{dist.distributor_name || '-'}</td>
                          <td style={{ ...styles.distributorTd, cursor: 'pointer' }}>{dist.rating || '-'}</td>
                          <td style={{ ...styles.distributorTd, cursor: 'pointer' }}>{dist.deliverytime ? `${dist.deliverytime} Tage` : '-'}</td>
                          <td style={{ ...styles.distributorTd, cursor: 'pointer' }}>{dist.distributorarticlenumber || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'lagerbestand' && (
              <div style={styles.tablePlaceholder}>Lagerbestand - Zukünftige Erweiterung</div>
            )}
            {activeTab === 'anhaenge' && (
              <div style={styles.tablePlaceholder}>Anhänge - Zukünftige Erweiterung</div>
            )}
            {activeTab === 'seriennummern' && (
              <div style={styles.tablePlaceholder}>Seriennummern - Zukünftige Erweiterung</div>
            )}
          </div>

          {/* Right: Price info table */}
          <div style={styles.tableCard}>
            <h2 style={styles.cardTitle}>Preisstaffel</h2>
            <div style={{ overflow: 'auto', maxHeight: '200px' }}>
              <table style={styles.priceTable}>
                <thead>
                  <tr>
                    <th style={styles.distributorTh}>Staffel</th>
                    <th style={styles.distributorTh}>EK-Preis</th>
                    <th style={styles.distributorTh}>Int. VP</th>
                    <th style={styles.distributorTh}>Datum</th>
                  </tr>
                </thead>
                <tbody>
                  {distributorPriceinfos.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ ...styles.distributorTd, textAlign: 'center', color: '#999' }}>
                        {selectedDistributorId ? 'Keine Preisinformationen' : 'Bitte Lieferant auswählen'}
                      </td>
                    </tr>
                  ) : (
                    distributorPriceinfos.map(price => (
                      <tr
                        key={price.id}
                        onClick={() => {
                          setSelectedPriceinfo(price)
                          setShowPreisinfoDialog(true)
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f5f9ff'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = ''}
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={styles.distributorTd}>{price.grade || '-'}</td>
                        <td style={styles.distributorTd}>{price.price?.toFixed(2) || '-'}</td>
                        <td style={styles.distributorTd}>{price.variablePrice?.toFixed(2) || '-'}</td>
                        <td style={styles.distributorTd}>
                          {price.purchasedate ? new Date(price.purchasedate).toLocaleDateString('de-DE') : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Dialogs */}
        {showLieferantDialog && selectedDistributorId && (
          <LieferantDetailDialog
            distributorId={selectedDistributorId}
            onClose={() => setShowLieferantDialog(false)}
          />
        )}
        {showPreisinfoDialog && selectedPriceinfo && (
          <PreisinfoDetailDialog
            priceinfo={selectedPriceinfo}
            onClose={() => {
              setShowPreisinfoDialog(false)
              setSelectedPriceinfo(null)
            }}
          />
        )}
      </div>
    </div>
  )
}
