/**
 * Auftragsdaten Beistellungen Page
 * Zeigt nur Beistellungen an.
 * 
 * Hinweis: Die orderType-ID für Beistellungen muss aus der 
 * billing_documenttype Tabelle ermittelt werden.
 */
import React from 'react'
import OrderDataTable from '../components/orders/OrderDataTable'

// Beistellung hat orderType = 14 (basierend auf billing_documenttype Tabelle)
const BEISTELLUNG_TYPE_ID = 14

export default function AuftragsdatenBeistellungenPage() {
  return (
    <OrderDataTable
      documentTypes={[BEISTELLUNG_TYPE_ID]}
      pageTitle="Beistellungen"
      numberFieldLabel="Beistellnummer"
      urlTyp="beistellungen"
    />
  )
}
