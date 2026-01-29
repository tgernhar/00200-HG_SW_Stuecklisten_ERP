/**
 * Artikel Liste Page
 * Such- und Auflistungsseite für Artikel aus HUGWAWI.
 */
import React from 'react'
import ArtikelDataTable from '../components/artikel/ArtikelDataTable'

export default function ArtikelListePage() {
  return (
    <ArtikelDataTable
      mode="articles"
      pageTitle="Artikel Liste"
    />
  )
}
