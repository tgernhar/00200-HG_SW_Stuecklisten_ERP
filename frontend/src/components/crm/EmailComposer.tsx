/**
 * CRM Email Composer Component
 * Modal for composing and sending emails with templates
 */
import React, { useState, useEffect } from 'react'
import { getTemplates, getMailboxes, sendEmail, renderTemplate } from '../../services/crmApi'
import { EmailTemplate, Mailbox, EmailSendRequest, DocumentLinkType } from '../../services/crmTypes'

interface DocumentLink {
  link_type: DocumentLinkType
  erp_document_id: number
  erp_document_number?: string
}

interface EmailComposerProps {
  isOpen: boolean
  onClose: () => void
  onSend?: (data: EmailSendRequest) => Promise<void>  // Optional: Use internal sendEmail if not provided
  defaultTo?: string
  defaultSubject?: string
  defaultBody?: string
  erpCustomerId?: number
  erpSupplierId?: number
  leadId?: number
  customerName?: string
  customerNumber?: string
  orderNumber?: string
  documentLinks?: DocumentLink[]
}

export interface EmailData {
  mailbox_id: number
  to_emails: string[]
  cc_emails?: string[]
  subject: string
  body_html: string
  erp_customer_id?: number
  erp_supplier_id?: number
}

const styles = {
  overlay: {
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
  modal: {
    backgroundColor: '#fff',
    borderRadius: '4px',
    width: '700px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  header: {
    padding: '15px 20px',
    borderBottom: '1px solid #ddd',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  headerTitle: {
    fontSize: '16px',
    fontWeight: 'bold' as const,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: '#666',
  },
  body: {
    padding: '20px',
    overflow: 'auto',
    flex: 1,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '12px',
    gap: '10px',
  },
  label: {
    width: '80px',
    fontSize: '13px',
    fontWeight: 500,
    color: '#333',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '13px',
  },
  select: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '13px',
  },
  editorContainer: {
    marginTop: '15px',
    border: '1px solid #ccc',
    borderRadius: '4px',
  },
  editorToolbar: {
    padding: '8px',
    borderBottom: '1px solid #ddd',
    backgroundColor: '#f5f5f5',
    display: 'flex',
    gap: '5px',
  },
  toolbarButton: {
    padding: '4px 8px',
    border: '1px solid #ddd',
    borderRadius: '3px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontSize: '12px',
  },
  editor: {
    minHeight: '250px',
    padding: '12px',
    fontSize: '13px',
    lineHeight: '1.6',
    outline: 'none',
  },
  footer: {
    padding: '15px 20px',
    borderTop: '1px solid #ddd',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  templateSelect: {
    padding: '6px 10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '13px',
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
  },
  cancelButton: {
    padding: '8px 16px',
    backgroundColor: '#f5f5f5',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  sendButton: {
    padding: '8px 20px',
    backgroundColor: '#2196F3',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
  },
  sendButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  recipientInfo: {
    fontSize: '12px',
    color: '#666',
    marginLeft: '5px',
  },
}

export default function EmailComposer({
  isOpen,
  onClose,
  onSend,
  defaultTo = '',
  defaultSubject = '',
  defaultBody = '',
  erpCustomerId,
  erpSupplierId,
  leadId,
  customerName,
  customerNumber,
  orderNumber,
  documentLinks,
}: EmailComposerProps) {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selectedMailbox, setSelectedMailbox] = useState<number | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  const [toEmails, setToEmails] = useState(defaultTo)
  const [ccEmails, setCcEmails] = useState('')
  const [bccEmails, setBccEmails] = useState('')
  const [subject, setSubject] = useState(defaultSubject)
  const [bodyHtml, setBodyHtml] = useState(defaultBody)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [includeSignature, setIncludeSignature] = useState(true)

  useEffect(() => {
    if (isOpen) {
      loadData()
      setToEmails(defaultTo)
      setSubject(defaultSubject)
      setBodyHtml(defaultBody)
      setError(null)
      setSelectedTemplateId(null)
    }
  }, [isOpen, defaultTo, defaultSubject, defaultBody])

  const loadData = async () => {
    try {
      const [mailboxRes, templateRes] = await Promise.all([
        getMailboxes(),
        getTemplates({ language: 'de' }),
      ])
      setMailboxes(mailboxRes.items)
      setTemplates(templateRes.items)
      
      // Select first mailbox by default
      if (mailboxRes.items.length > 0 && !selectedMailbox) {
        setSelectedMailbox(mailboxRes.items[0].id)
      }
    } catch (err) {
      console.error('Error loading email data:', err)
      setError('Fehler beim Laden der E-Mail-Daten')
    }
  }

  const handleTemplateSelect = async (templateId: number) => {
    setSelectedTemplateId(templateId)
    const template = templates.find(t => t.id === templateId)
    if (!template) return

    try {
      // Build variables for template rendering
      const variables: Record<string, string> = {
        customer_name: customerName || '',
        customer_number: customerNumber || '',
        order_number: orderNumber || '',
        date: new Date().toLocaleDateString('de-DE'),
      }

      // Use API for template rendering
      const rendered = await renderTemplate({
        template_id: templateId,
        variables
      })
      
      setSubject(rendered.subject)
      setBodyHtml(rendered.body)
    } catch (err) {
      console.error('Error rendering template:', err)
      // Fallback: local rendering
      let subjectText = template.subject_template || ''
      let bodyText = template.body_template || ''
      
      const variables: Record<string, string> = {
        customer_name: customerName || '',
        customer_number: customerNumber || '',
        order_number: orderNumber || '',
        date: new Date().toLocaleDateString('de-DE'),
      }
      
      Object.entries(variables).forEach(([key, value]) => {
        const placeholder = `{{${key}}}`
        subjectText = subjectText.replace(new RegExp(placeholder, 'g'), value)
        bodyText = bodyText.replace(new RegExp(placeholder, 'g'), value)
      })
      
      setSubject(subjectText)
      setBodyHtml(bodyText)
    }
  }

  const handleSend = async () => {
    if (!selectedMailbox || !toEmails || !subject) return

    setSending(true)
    setError(null)
    
    try {
      const emailList = toEmails.split(',').map(e => e.trim()).filter(e => e)
      const ccList = ccEmails ? ccEmails.split(',').map(e => e.trim()).filter(e => e) : undefined
      const bccList = bccEmails ? bccEmails.split(',').map(e => e.trim()).filter(e => e) : undefined

      const emailData: EmailSendRequest = {
        mailbox_id: selectedMailbox,
        to_emails: emailList,
        cc_emails: ccList,
        bcc_emails: bccList,
        subject,
        body_html: bodyHtml,
        erp_customer_id: erpCustomerId,
        erp_supplier_id: erpSupplierId,
        lead_id: leadId,
        document_links: documentLinks,
        template_id: selectedTemplateId || undefined,
        include_signature: includeSignature,
      }

      // Use provided onSend callback or default API
      if (onSend) {
        await onSend(emailData)
      } else {
        const result = await sendEmail(emailData)
        if (!result.success) {
          throw new Error(result.error || 'Unbekannter Fehler')
        }
      }
      
      onClose()
    } catch (err: any) {
      console.error('Error sending email:', err)
      setError(err.message || 'Fehler beim Senden der E-Mail')
    } finally {
      setSending(false)
    }
  }

  const isValid = selectedMailbox && toEmails && subject

  if (!isOpen) return null

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.headerTitle}>Neue E-Mail</span>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div style={styles.body}>
          <div style={styles.row}>
            <span style={styles.label}>Von:</span>
            <select
              style={styles.select}
              value={selectedMailbox || ''}
              onChange={(e) => setSelectedMailbox(Number(e.target.value))}
            >
              <option value="">-- Postfach wählen --</option>
              {mailboxes.map((mb) => (
                <option key={mb.id} value={mb.id}>
                  {mb.name} ({mb.email_address})
                </option>
              ))}
            </select>
          </div>

          <div style={styles.row}>
            <span style={styles.label}>An:</span>
            <input
              type="text"
              style={styles.input}
              value={toEmails}
              onChange={(e) => setToEmails(e.target.value)}
              placeholder="empfaenger@beispiel.de"
            />
            {customerName && (
              <span style={styles.recipientInfo}>({customerName})</span>
            )}
          </div>

          <div style={styles.row}>
            <span style={styles.label}>CC:</span>
            <input
              type="text"
              style={styles.input}
              value={ccEmails}
              onChange={(e) => setCcEmails(e.target.value)}
              placeholder="Optional: CC-Empfänger"
            />
          </div>

          <div style={styles.row}>
            <span style={styles.label}>BCC:</span>
            <input
              type="text"
              style={styles.input}
              value={bccEmails}
              onChange={(e) => setBccEmails(e.target.value)}
              placeholder="Optional: BCC-Empfänger (nicht sichtbar)"
            />
          </div>

          <div style={styles.row}>
            <span style={styles.label}>Betreff:</span>
            <input
              type="text"
              style={styles.input}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Betreff eingeben"
            />
          </div>

          <div style={styles.editorContainer}>
            <div style={styles.editorToolbar}>
              <button style={styles.toolbarButton} onClick={() => document.execCommand('bold')}>
                <b>B</b>
              </button>
              <button style={styles.toolbarButton} onClick={() => document.execCommand('italic')}>
                <i>I</i>
              </button>
              <button style={styles.toolbarButton} onClick={() => document.execCommand('underline')}>
                <u>U</u>
              </button>
              <span style={{ width: 1, backgroundColor: '#ddd', margin: '0 5px' }} />
              <button style={styles.toolbarButton} onClick={() => document.execCommand('insertUnorderedList')}>
                Liste
              </button>
            </div>
            <div
              style={styles.editor}
              contentEditable
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
              onInput={(e) => setBodyHtml(e.currentTarget.innerHTML)}
            />
          </div>
        </div>

        <div style={styles.footer}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <select
              style={styles.templateSelect}
              value={selectedTemplateId || ''}
              onChange={(e) => {
                if (e.target.value) {
                  handleTemplateSelect(Number(e.target.value))
                }
              }}
            >
              <option value="">Vorlage auswählen...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <input
                type="checkbox"
                checked={includeSignature}
                onChange={(e) => setIncludeSignature(e.target.checked)}
              />
              Mit Signatur
            </label>
          </div>
          <div style={styles.buttonGroup}>
            {error && (
              <span style={{ color: '#d32f2f', fontSize: '12px', marginRight: '10px' }}>
                {error}
              </span>
            )}
            <button style={styles.cancelButton} onClick={onClose}>
              Abbrechen
            </button>
            <button
              style={{
                ...styles.sendButton,
                ...(!isValid || sending ? styles.sendButtonDisabled : {}),
              }}
              onClick={handleSend}
              disabled={!isValid || sending}
            >
              {sending ? 'Sende...' : 'Senden'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
