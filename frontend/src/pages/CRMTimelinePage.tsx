/**
 * CRM Timeline Page
 * View communication history (Vorgangsakte) for customers/documents
 */
import React, { useState, useEffect } from 'react'
import { searchCustomers, getCustomerTimeline, getCommunications, createCommunication, sendEmail } from '../services/crmApi'
import { CustomerInfo, TimelineResponse, TimelineEntry, CommunicationEntry, CommunicationType, EmailSendRequest } from '../services/crmTypes'
import EmailComposer from '../components/crm/EmailComposer'

const styles = {
  container: {
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
    display: 'flex',
    gap: '20px',
    height: 'calc(100vh - 140px)',
  },
  sidebar: {
    width: '280px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '15px',
  },
  mainContent: {
    flex: 1,
    overflow: 'auto',
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '4px',
  },
  searchBox: {
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '4px',
    padding: '15px',
  },
  searchInput: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '13px',
    boxSizing: 'border-box' as const,
  },
  customerList: {
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '4px',
    flex: 1,
    overflow: 'auto',
  },
  listTitle: {
    padding: '10px 15px',
    borderBottom: '1px solid #ddd',
    fontWeight: 'bold' as const,
    fontSize: '13px',
    backgroundColor: '#f5f5f5',
  },
  customerItem: {
    padding: '10px 15px',
    borderBottom: '1px solid #eee',
    cursor: 'pointer',
    fontSize: '13px',
  },
  customerItemActive: {
    backgroundColor: '#e3f2fd',
  },
  customerItemHover: {
    backgroundColor: '#f5f5f5',
  },
  customerName: {
    fontWeight: 500,
    color: '#333',
  },
  customerNumber: {
    fontSize: '11px',
    color: '#666',
    marginTop: '3px',
  },
  timelineHeader: {
    padding: '15px 20px',
    borderBottom: '1px solid #ddd',
    backgroundColor: '#f9f9f9',
  },
  timelineTitle: {
    fontSize: '16px',
    fontWeight: 'bold' as const,
    color: '#333',
  },
  timelineStats: {
    display: 'flex',
    gap: '20px',
    marginTop: '10px',
    fontSize: '12px',
    color: '#666',
  },
  timelineBody: {
    padding: '20px',
  },
  entryCard: {
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    marginBottom: '15px',
    overflow: 'hidden',
  },
  entryHeader: {
    padding: '10px 15px',
    backgroundColor: '#f5f5f5',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #e0e0e0',
  },
  entryType: {
    padding: '2px 8px',
    borderRadius: '3px',
    fontSize: '11px',
    fontWeight: 500,
  },
  entryDate: {
    fontSize: '12px',
    color: '#666',
  },
  entryBody: {
    padding: '15px',
  },
  entrySubject: {
    fontSize: '14px',
    fontWeight: 500,
    marginBottom: '8px',
  },
  entryPreview: {
    fontSize: '13px',
    color: '#555',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap' as const,
  },
  entrySender: {
    fontSize: '12px',
    color: '#666',
    marginTop: '10px',
  },
  attachmentBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    color: '#666',
    marginLeft: '10px',
  },
  addButton: {
    padding: '8px 16px',
    backgroundColor: '#2196F3',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    marginLeft: '10px',
  },
  emptyState: {
    padding: '40px',
    textAlign: 'center' as const,
    color: '#666',
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
    justifyContent: 'flex-end',
    gap: '10px',
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
    minHeight: '100px',
    boxSizing: 'border-box' as const,
    resize: 'vertical' as const,
  },
  cancelButton: {
    padding: '8px 16px',
    backgroundColor: '#f5f5f5',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
}

const typeColors: Record<string, { bg: string; color: string }> = {
  email_in: { bg: '#e3f2fd', color: '#1565c0' },
  email_out: { bg: '#e8f5e9', color: '#2e7d32' },
  phone: { bg: '#fff3e0', color: '#ef6c00' },
  meeting: { bg: '#f3e5f5', color: '#7b1fa2' },
  note: { bg: '#f5f5f5', color: '#616161' },
  document: { bg: '#fce4ec', color: '#c2185b' },
  task: { bg: '#e0f2f1', color: '#00695c' },
}

const typeLabels: Record<string, string> = {
  email_in: 'E-Mail (Eingang)',
  email_out: 'E-Mail (Ausgang)',
  phone: 'Telefonat',
  meeting: 'Meeting',
  note: 'Notiz',
  document: 'Dokument',
  task: 'Aufgabe',
}

export default function CRMTimelinePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [customers, setCustomers] = useState<CustomerInfo[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerInfo | null>(null)
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [hoveredCustomer, setHoveredCustomer] = useState<number | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEmailComposer, setShowEmailComposer] = useState(false)
  const [newEntry, setNewEntry] = useState({
    entry_type: 'phone' as CommunicationType,
    subject: '',
    body_text: '',
  })

  useEffect(() => {
    if (searchQuery.length >= 2) {
      const timer = setTimeout(() => {
        searchCustomers(searchQuery, 20).then(res => setCustomers(res.items))
      }, 300)
      return () => clearTimeout(timer)
    } else {
      setCustomers([])
    }
  }, [searchQuery])

  const loadTimeline = async (customer: CustomerInfo) => {
    setSelectedCustomer(customer)
    setLoading(true)
    try {
      const data = await getCustomerTimeline(customer.id, 100)
      setTimeline(data)
    } catch (err) {
      console.error('Error loading timeline:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleAddEntry = async () => {
    if (!selectedCustomer || !newEntry.subject) return

    try {
      await createCommunication({
        entry_type: newEntry.entry_type,
        subject: newEntry.subject,
        body_text: newEntry.body_text,
        erp_customer_id: selectedCustomer.id,
        communication_date: new Date().toISOString(),
      })
      setShowAddModal(false)
      setNewEntry({ entry_type: 'phone', subject: '', body_text: '' })
      loadTimeline(selectedCustomer)
    } catch (err) {
      console.error('Error creating entry:', err)
    }
  }

  const handleSendEmail = async (data: EmailSendRequest) => {
    const result = await sendEmail(data)
    if (!result.success) {
      throw new Error(result.error || 'Fehler beim Senden')
    }
    // Reload timeline to show the new email
    if (selectedCustomer) {
      loadTimeline(selectedCustomer)
    }
  }

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.searchBox}>
          <input
            type="text"
            placeholder="Kunde suchen..."
            style={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div style={styles.customerList}>
          <div style={styles.listTitle}>Kunden</div>
          {customers.length === 0 && searchQuery.length >= 2 && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#666', fontSize: '13px' }}>
              Keine Kunden gefunden
            </div>
          )}
          {customers.map((customer) => (
            <div
              key={customer.id}
              style={{
                ...styles.customerItem,
                ...(selectedCustomer?.id === customer.id ? styles.customerItemActive : {}),
                ...(hoveredCustomer === customer.id && selectedCustomer?.id !== customer.id ? styles.customerItemHover : {}),
              }}
              onClick={() => loadTimeline(customer)}
              onMouseEnter={() => setHoveredCustomer(customer.id)}
              onMouseLeave={() => setHoveredCustomer(null)}
            >
              <div style={styles.customerName}>{customer.name}</div>
              <div style={styles.customerNumber}>
                {customer.customer_number} {customer.city && `- ${customer.city}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        {!selectedCustomer ? (
          <div style={styles.emptyState}>
            Bitte wählen Sie einen Kunden aus der Liste
          </div>
        ) : loading ? (
          <div style={styles.emptyState}>Lade Vorgangsakte...</div>
        ) : (
          <>
            <div style={styles.timelineHeader}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={styles.timelineTitle}>{selectedCustomer.name}</div>
                  <div style={styles.timelineStats}>
                    <span>E-Mails: {timeline?.email_count || 0}</span>
                    <span>Telefonate: {timeline?.call_count || 0}</span>
                    <span>Meetings: {timeline?.meeting_count || 0}</span>
                    <span>Notizen: {timeline?.note_count || 0}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    style={{ ...styles.addButton, backgroundColor: '#4CAF50' }} 
                    onClick={() => setShowEmailComposer(true)}
                  >
                    ✉ E-Mail senden
                  </button>
                  <button style={styles.addButton} onClick={() => setShowAddModal(true)}>
                    + Eintrag hinzufügen
                  </button>
                </div>
              </div>
            </div>
            <div style={styles.timelineBody}>
              {timeline?.entries.length === 0 ? (
                <div style={styles.emptyState}>Keine Einträge vorhanden</div>
              ) : (
                timeline?.entries.map((entry) => (
                  <div key={`${entry.entry_type}-${entry.id}`} style={styles.entryCard}>
                    <div style={styles.entryHeader}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span
                          style={{
                            ...styles.entryType,
                            backgroundColor: typeColors[entry.entry_type]?.bg || '#f5f5f5',
                            color: typeColors[entry.entry_type]?.color || '#333',
                          }}
                        >
                          {typeLabels[entry.entry_type] || entry.entry_type}
                        </span>
                        {entry.has_attachments && (
                          <span style={styles.attachmentBadge}>
                            📎 {entry.attachment_count}
                          </span>
                        )}
                      </div>
                      <span style={styles.entryDate}>{formatDate(entry.date)}</span>
                    </div>
                    <div style={styles.entryBody}>
                      {entry.subject && <div style={styles.entrySubject}>{entry.subject}</div>}
                      {entry.body_preview && (
                        <div style={styles.entryPreview}>{entry.body_preview}</div>
                      )}
                      {entry.sender && (
                        <div style={styles.entrySender}>Von: {entry.sender}</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Add Entry Modal */}
      {showAddModal && (
        <div style={styles.modal} onClick={() => setShowAddModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <span>Neuer Eintrag</span>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>×</button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Typ</label>
                <select
                  style={styles.formSelect}
                  value={newEntry.entry_type}
                  onChange={(e) => setNewEntry({ ...newEntry, entry_type: e.target.value as CommunicationType })}
                >
                  <option value="phone">Telefonat</option>
                  <option value="meeting">Meeting</option>
                  <option value="note">Notiz</option>
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Betreff</label>
                <input
                  type="text"
                  style={styles.formInput}
                  value={newEntry.subject}
                  onChange={(e) => setNewEntry({ ...newEntry, subject: e.target.value })}
                  placeholder="Betreff eingeben..."
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Inhalt</label>
                <textarea
                  style={styles.formTextarea}
                  value={newEntry.body_text}
                  onChange={(e) => setNewEntry({ ...newEntry, body_text: e.target.value })}
                  placeholder="Details eingeben..."
                />
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.cancelButton} onClick={() => setShowAddModal(false)}>Abbrechen</button>
              <button style={styles.addButton} onClick={handleAddEntry}>Speichern</button>
            </div>
          </div>
        </div>
      )}

      {/* Email Composer Modal */}
      <EmailComposer
        isOpen={showEmailComposer}
        onClose={() => setShowEmailComposer(false)}
        onSend={handleSendEmail}
        defaultTo={selectedCustomer?.email || ''}
        erpCustomerId={selectedCustomer?.id}
        customerName={selectedCustomer?.name}
        customerNumber={selectedCustomer?.customer_number}
      />
    </div>
  )
}
