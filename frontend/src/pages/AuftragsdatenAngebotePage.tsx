/**
 * Auftragsdaten Angebote Page
 * Zeigt nur Angebote an (orderType = 3).
 */
import React from 'react'
import OrderDataTable from '../components/orders/OrderDataTable'

// Angebot hat orderType = 3 (basierend auf order_status.ordertype Werten)
const ANGEBOT_TYPE_ID = 3

export default function AuftragsdatenAngebotePage() {
  return (
    <OrderDataTable
      documentTypes={[ANGEBOT_TYPE_ID]}
      pageTitle="Angebotsliste"
      numberFieldLabel="Angebotsnummer"
    />
  )
}
