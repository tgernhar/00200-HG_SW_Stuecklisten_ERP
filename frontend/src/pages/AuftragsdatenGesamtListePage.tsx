/**
 * Auftragsdaten GesamtListe Page
 * Zeigt alle Dokumenttypen zusammen an.
 */
import React, { useState, useEffect } from 'react'
import OrderDataTable from '../components/orders/OrderDataTable'
import { getDocumentTypes, DocumentType } from '../services/ordersDataApi'

export default function AuftragsdatenGesamtListePage() {
  const [documentTypes, setDocumentTypes] = useState<number[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDocumentTypes()
  }, [])

  const loadDocumentTypes = async () => {
    try {
      const response = await getDocumentTypes()
      // Alle Dokumenttyp-IDs verwenden
      const allTypeIds = response.items.map((dt: DocumentType) => dt.id)
      setDocumentTypes(allTypeIds)
    } catch (error) {
      console.error('Error loading document types:', error)
      // Fallback: Gängige Typen
      setDocumentTypes([0, 1, 2, 3, 4, 5])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div style={{ padding: '20px' }}>Lade Dokumenttypen...</div>
  }

  return (
    <OrderDataTable
      documentTypes={documentTypes}
      pageTitle="GesamtListe"
      numberFieldLabel="Dokumentnummer"
      urlTyp="gesamtliste"
    />
  )
}
