/**
 * Auftragsdaten Bestellungen Page
 * Zeigt nur Bestellungen an (orderType = 5).
 */
import React from 'react'
import OrderDataTable from '../components/orders/OrderDataTable'

// Bestellung hat orderType = 5 (basierend auf order_status.ordertype Werten)
const BESTELLUNG_TYPE_ID = 5

export default function AuftragsdatenBestellungenPage() {
  return (
    <OrderDataTable
      documentTypes={[BESTELLUNG_TYPE_ID]}
      pageTitle="Bestellungen"
      numberFieldLabel="Bestellnummer"
    />
  )
}
