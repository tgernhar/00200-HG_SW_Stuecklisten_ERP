/**
 * Main App Component
 */
import React, { useState, useEffect } from 'react'
import { ProjectHeader } from './components/ProjectHeader'
import { ArticleGrid } from './components/ArticleGrid'
import { useArticles } from './hooks/useArticles'
import api from './services/api'
import { Project, Article } from './services/types'
import './App.css'

function App() {
  const [project, setProject] = useState<Project | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const { articles, loading, error, refetch } = useArticles(project?.id || null)

  useEffect(() => {
    // Lade Projekte
    api.get('/projects')
      .then(response => setProjects(response.data))
      .catch(err => console.error('Fehler beim Laden der Projekte:', err))
  }, [])

  const handleImportSolidworks = async () => {
    if (!project) return
    
    const filepath = prompt('Bitte geben Sie den Pfad zur SOLIDWORKS-Assembly ein:')
    if (!filepath) return

    try {
      await api.post(`/projects/${project.id}/import-solidworks`, null, {
        params: { assembly_filepath: filepath }
      })
      alert('Import erfolgreich!')
      refetch()
    } catch (error: any) {
      alert('Fehler beim Import: ' + error.message)
    }
  }

  const handleCheckERP = async () => {
    if (!project) return

    try {
      const response = await api.post(`/projects/${project.id}/check-all-articlenumbers`)
      const { exists_count, not_exists_count, total_checked } = response.data
      alert(`ERP-Abgleich abgeschlossen: ${total_checked} geprüft, ${exists_count} vorhanden, ${not_exists_count} fehlen`)
      refetch()
    } catch (error: any) {
      alert('Fehler beim ERP-Abgleich: ' + error.message)
    }
  }

  const handleSyncOrders = async () => {
    if (!project) return

    try {
      await api.post(`/projects/${project.id}/sync-orders`)
      alert('Bestellungen synchronisiert!')
      refetch()
    } catch (error: any) {
      alert('Fehler beim Synchronisieren: ' + error.message)
    }
  }

  const handleCreateDocuments = async () => {
    if (!project) return

    try {
      const response = await api.post(`/projects/${project.id}/generate-documents-batch`)
      const { generated_count, failed_count } = response.data
      alert(`Dokumente erstellt: ${generated_count} erfolgreich, ${failed_count} fehlgeschlagen`)
      refetch()
    } catch (error: any) {
      alert('Fehler beim Erstellen der Dokumente: ' + error.message)
    }
  }

  const handleCheckDocuments = async () => {
    if (!project) return
    alert('Dokumentprüfung noch nicht implementiert')
  }

  const handlePrintPDF = async () => {
    if (!project) return

    const confirmed = window.confirm(
      "Bitte vor der Verwendung eine PDF öffnen und den passenden Drucker " +
      "und Druckeinstellungen wählen und Datei Drucken. " +
      "Ist der Drucker korrekt gewählt? Falls Nein dies tun und die Funktion erneut ausführen"
    )

    if (!confirmed) return

    try {
      const response = await api.post(`/projects/${project.id}/batch-print-pdf`)
      const { printed_count, failed_count, skipped_count } = response.data
      alert(`PDF-Druck abgeschlossen: ${printed_count} gedruckt, ${failed_count} fehlgeschlagen, ${skipped_count} übersprungen`)
      refetch()
    } catch (error: any) {
      alert('Fehler beim PDF-Druck: ' + error.message)
    }
  }

  const handleExport = () => {
    alert('Export noch nicht implementiert')
  }

  const handleCellValueChanged = async (params: any) => {
    // TODO: Implementiere Update-Logik
    console.log('Cell value changed:', params)
  }

  return (
    <div className="app">
      <div style={{ marginBottom: '20px', padding: '10px' }}>
        <label>
          Projekt auswählen:
          <select 
            value={project?.id || ''} 
            onChange={(e) => {
              const selectedProject = projects.find(p => p.id === parseInt(e.target.value))
              setProject(selectedProject || null)
            }}
            style={{ marginLeft: '10px', padding: '5px' }}
          >
            <option value="">-- Bitte wählen --</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.au_nr}</option>
            ))}
          </select>
        </label>
      </div>

      {project && (
        <>
          <ProjectHeader
            project={project}
            onImportSolidworks={handleImportSolidworks}
            onCheckERP={handleCheckERP}
            onSyncOrders={handleSyncOrders}
            onCreateDocuments={handleCreateDocuments}
            onCheckDocuments={handleCheckDocuments}
            onPrintPDF={handlePrintPDF}
            onExport={handleExport}
          />
          <div style={{ height: 'calc(100vh - 200px)', width: '100%' }}>
            {loading && <div>Lade Artikel...</div>}
            {error && <div style={{ color: 'red' }}>Fehler: {error}</div>}
            {!loading && !error && (
              <ArticleGrid 
                articles={articles} 
                onCellValueChanged={handleCellValueChanged}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default App
