/**
 * CRM Lead Pipeline Page
 * Kanban-style lead management
 */
import React, { useState, useEffect } from 'react'
import { getLeads, createLead, updateLead, deleteLead } from '../services/crmApi'
import { Lead, LeadCreate, LeadStatus, LeadListResponse } from '../services/crmTypes'

const styles = {
  container: {
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
    height: 'calc(100vh - 140px)',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  title: {
    fontSize: '18px',
    fontWeight: 'bold' as const,
    color: '#333',
  },
  addButton: {
    padding: '8px 16px',
    backgroundColor: '#2196F3',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  pipelineContainer: {
    display: 'flex',
    gap: '15px',
    overflow: 'auto',
    flex: 1,
    paddingBottom: '10px',
  },
  column: {
    minWidth: '280px',
    maxWidth: '280px',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  columnHeader: {
    padding: '12px 15px',
    fontWeight: 'bold' as const,
    fontSize: '13px',
    borderRadius: '4px 4px 0 0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  columnCount: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '12px',
  },
  columnBody: {
    padding: '10px',
    flex: 1,
    overflow: 'auto',
  },
  leadCard: {
    backgroundColor: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    padding: '12px',
    marginBottom: '10px',
    cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  leadCardHover: {
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  leadTitle: {
    fontSize: '13px',
    fontWeight: 500,
    marginBottom: '6px',
    color: '#333',
  },
  leadCustomer: {
    fontSize: '12px',
    color: '#666',
    marginBottom: '4px',
  },
  leadValue: {
    fontSize: '12px',
    fontWeight: 'bold' as const,
    color: '#2196F3',
  },
  leadMeta: {
    fontSize: '11px',
    color: '#999',
    marginTop: '8px',
    display: 'flex',
    justifyContent: 'space-between',
  },
  leadTags: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap' as const,
    marginTop: '6px',
  },
  tag: {
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '10px',
    backgroundColor: '#e0e0e0',
  },
  emptyColumn: {
    padding: '20px',
    textAlign: 'center' as const,
    color: '#999',
    fontSize: '12px',
  },
  modal: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: '4px',
    width: '500px',
    maxHeight: '80vh',
    overflow: 'auto',
  },
  modalHeader: {
    padding: '15px 20px',
    borderBottom: '1px solid #ddd',
    fontWeight: 'bold' as const,
    display: 'flex',
    justifyContent: 'space-between',
  },
  modalBody: {
    padding: '20px',
  },
  modalFooter: {
    padding: '15px 20px',
    borderTop: '1px solid #ddd',
    display: 'flex',
    justifyContent: 'space-between',
  },
  formGroup: {
    marginBottom: '15px',
  },
  formLabel: {
    display: 'block',
    marginBottom: '5px',
    fontSize: '13px',
    fontWeight: 500,
  },
  formInput: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '13px',
    boxSizing: 'border-box' as const,
  },
  formSelect: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '13px',
    boxSizing: 'border-box' as const,
  },
  formTextarea: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '13px',
    minHeight: '80px',
    boxSizing: 'border-box' as const,
    resize: 'vertical' as const,
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '15px',
  },
  cancelButton: {
    padding: '8px 16px',
    backgroundColor: '#f5f5f5',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  deleteButton: {
    padding: '8px 16px',
    backgroundColor: '#ffebee',
    color: '#c62828',
    border: '1px solid #ef9a9a',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  new: { label: 'Neu', color: '#fff', bgColor: '#4caf50' },
  qualified: { label: 'Qualifiziert', color: '#fff', bgColor: '#2196F3' },
  proposal: { label: 'Angebot', color: '#fff', bgColor: '#ff9800' },
  negotiation: { label: 'Verhandlung', color: '#fff', bgColor: '#9c27b0' },
  won: { label: 'Gewonnen', color: '#fff', bgColor: '#388e3c' },
  lost: { label: 'Verloren', color: '#fff', bgColor: '#d32f2f' },
}

const statusOrder: LeadStatus[] = ['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost']

export default function CRMLeadPipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [byStatus, setByStatus] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [hoveredLead, setHoveredLead] = useState<number | null>(null)
  const [formData, setFormData] = useState<LeadCreate>({
    title: '',
    customer_name: '',
    contact_email: '',
    contact_phone: '',
    expected_value: undefined,
    source: '',
    status: 'new',
    priority: 50,
  })

  useEffect(() => {
    loadLeads()
  }, [])

  const loadLeads = async () => {
    setLoading(true)
    try {
      const response = await getLeads({ limit: 500 })
      setLeads(response.items)
      setByStatus(response.by_status)
    } catch (err) {
      console.error('Error loading leads:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value?: number) => {
    if (!value) return ''
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
  }

  const handleOpenModal = (lead?: Lead) => {
    if (lead) {
      setEditingLead(lead)
      setFormData({
        title: lead.title,
        description: lead.description,
        customer_name: lead.customer_name,
        contact_email: lead.contact_email,
        contact_phone: lead.contact_phone,
        expected_value: lead.expected_value,
        expected_close_date: lead.expected_close_date,
        source: lead.source,
        status: lead.status,
        priority: lead.priority,
      })
    } else {
      setEditingLead(null)
      setFormData({
        title: '',
        customer_name: '',
        contact_email: '',
        contact_phone: '',
        expected_value: undefined,
        source: '',
        status: 'new',
        priority: 50,
      })
    }
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formData.title) return
    try {
      if (editingLead) {
        await updateLead(editingLead.id, formData)
      } else {
        await createLead(formData)
      }
      setShowModal(false)
      loadLeads()
    } catch (err) {
      console.error('Error saving lead:', err)
    }
  }

  const handleDelete = async () => {
    if (!editingLead || !confirm('Lead wirklich löschen?')) return
    try {
      await deleteLead(editingLead.id)
      setShowModal(false)
      loadLeads()
    } catch (err) {
      console.error('Error deleting lead:', err)
    }
  }

  const handleStatusChange = async (leadId: number, newStatus: LeadStatus) => {
    try {
      await updateLead(leadId, { status: newStatus })
      loadLeads()
    } catch (err) {
      console.error('Error updating status:', err)
    }
  }

  const getLeadsByStatus = (status: LeadStatus) => {
    return leads.filter(l => l.status === status)
  }

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center' }}>Lade Leads...</div>
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Lead-Pipeline</h2>
        <button style={styles.addButton} onClick={() => handleOpenModal()}>
          + Neuer Lead
        </button>
      </div>

      <div style={styles.pipelineContainer}>
        {statusOrder.map((status) => {
          const config = statusConfig[status]
          const statusLeads = getLeadsByStatus(status)

          return (
            <div key={status} style={styles.column}>
              <div style={{ ...styles.columnHeader, backgroundColor: config.bgColor, color: config.color }}>
                <span>{config.label}</span>
                <span style={styles.columnCount}>{statusLeads.length}</span>
              </div>
              <div style={styles.columnBody}>
                {statusLeads.length === 0 ? (
                  <div style={styles.emptyColumn}>Keine Leads</div>
                ) : (
                  statusLeads.map((lead) => (
                    <div
                      key={lead.id}
                      style={{
                        ...styles.leadCard,
                        ...(hoveredLead === lead.id ? styles.leadCardHover : {}),
                      }}
                      onClick={() => handleOpenModal(lead)}
                      onMouseEnter={() => setHoveredLead(lead.id)}
                      onMouseLeave={() => setHoveredLead(null)}
                    >
                      <div style={styles.leadTitle}>{lead.title}</div>
                      {lead.customer_name && (
                        <div style={styles.leadCustomer}>{lead.customer_name}</div>
                      )}
                      {lead.expected_value && (
                        <div style={styles.leadValue}>{formatCurrency(lead.expected_value)}</div>
                      )}
                      <div style={styles.leadMeta}>
                        <span>{lead.source || 'Keine Quelle'}</span>
                        {lead.expected_close_date && (
                          <span>Abschluss: {formatDate(lead.expected_close_date)}</span>
                        )}
                      </div>
                      {lead.tags && lead.tags.length > 0 && (
                        <div style={styles.leadTags}>
                          {lead.tags.map((tag) => (
                            <span key={tag.id} style={{ ...styles.tag, backgroundColor: tag.color || '#e0e0e0' }}>
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Lead Modal */}
      {showModal && (
        <div style={styles.modal} onClick={() => setShowModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <span>{editingLead ? 'Lead bearbeiten' : 'Neuer Lead'}</span>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>×</button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Titel *</label>
                <input
                  type="text"
                  style={styles.formInput}
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Lead-Titel..."
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Kundenname</label>
                <input
                  type="text"
                  style={styles.formInput}
                  value={formData.customer_name || ''}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  placeholder="Name des Interessenten..."
                />
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>E-Mail</label>
                  <input
                    type="email"
                    style={styles.formInput}
                    value={formData.contact_email || ''}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Telefon</label>
                  <input
                    type="text"
                    style={styles.formInput}
                    value={formData.contact_phone || ''}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Erwarteter Wert (EUR)</label>
                  <input
                    type="number"
                    style={styles.formInput}
                    value={formData.expected_value || ''}
                    onChange={(e) => setFormData({ ...formData, expected_value: e.target.value ? Number(e.target.value) : undefined })}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Erwarteter Abschluss</label>
                  <input
                    type="date"
                    style={styles.formInput}
                    value={formData.expected_close_date || ''}
                    onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
                  />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Quelle</label>
                  <select
                    style={styles.formSelect}
                    value={formData.source || ''}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  >
                    <option value="">-- Auswählen --</option>
                    <option value="Messe">Messe</option>
                    <option value="Website">Website</option>
                    <option value="Empfehlung">Empfehlung</option>
                    <option value="Kaltakquise">Kaltakquise</option>
                    <option value="Bestandskunde">Bestandskunde</option>
                    <option value="Sonstiges">Sonstiges</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Status</label>
                  <select
                    style={styles.formSelect}
                    value={formData.status || 'new'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as LeadStatus })}
                  >
                    {statusOrder.map((s) => (
                      <option key={s} value={s}>{statusConfig[s].label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Beschreibung</label>
                <textarea
                  style={styles.formTextarea}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Weitere Details zum Lead..."
                />
              </div>
            </div>
            <div style={styles.modalFooter}>
              <div>
                {editingLead && (
                  <button style={styles.deleteButton} onClick={handleDelete}>Löschen</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button style={styles.cancelButton} onClick={() => setShowModal(false)}>Abbrechen</button>
                <button style={styles.addButton} onClick={handleSave}>Speichern</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
