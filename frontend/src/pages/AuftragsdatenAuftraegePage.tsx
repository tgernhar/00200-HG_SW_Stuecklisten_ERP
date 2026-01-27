/**
 * Auftragsdaten Aufträge Page
 * Zeigt nur Aufträge an (orderType = 0).
 */
import React from 'react'
import OrderDataTable from '../components/orders/OrderDataTable'

// Auftrag hat orderType = 0 (basierend auf order_status.ordertype Werten)
const AUFTRAG_TYPE_ID = 0

export default function AuftragsdatenAuftraegePage() {
  return (
    <OrderDataTable
      documentTypes={[AUFTRAG_TYPE_ID]}
      pageTitle="Aufträge"
      numberFieldLabel="Auftragsnummer"
    />
  )
}
