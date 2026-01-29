/**
 * Warengruppen Liste Page
 * Such- und Auflistungsseite für Warengruppen aus HUGWAWI.
 */
import React from 'react'
import ArtikelDataTable from '../components/artikel/ArtikelDataTable'

export default function WarengruppenListePage() {
  return (
    <ArtikelDataTable
      mode="materialgroups"
      pageTitle="Warengruppen"
    />
  )
}
