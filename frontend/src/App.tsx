/**
 * Main App Component
 */
import React, { useState } from 'react'
import { ProjectHeader } from './components/ProjectHeader'
import { ArticleGrid } from './components/ArticleGrid'
import { useArticles } from './hooks/useArticles'
import api from './services/api'
import { Project, Article } from './services/types'
import './App.css'

function App() {
  const [project, setProject] = useState<Project | null>(null)
  const [auNr, setAuNr] = useState('')
  const [assemblyPath, setAssemblyPath] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const { articles, loading, error, refetch } = useArticles(project?.id || null)

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
    try {
      const response = await api.post(`/projects/${project.id}/check-documents-batch`)
      const { checked_articles, checked_documents, found_documents, failed_count } = response.data || {}
      alert(
        `Dokumentprüfung abgeschlossen:\n` +
          `Artikel geprüft: ${checked_articles ?? '-'}\n` +
          `Dokumente geprüft: ${checked_documents ?? '-'}\n` +
          `Gefunden: ${found_documents ?? '-'}\n` +
          `Fehler: ${failed_count ?? 0}`
      )
      refetch()
    } catch (error: any) {
      alert('Fehler bei der Dokumentprüfung: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handlePrintPDFQueueMerged = () => {
    if (!project) return
    const apiBase = (api as any)?.defaults?.baseURL || 'http://localhost:8000/api'
    const url = `${apiBase}/projects/${project.id}/print-pdf-queue-merged`
    const win = window.open(url, '_blank')
    if (!win) window.location.assign(url)
  }

  const handleExport = () => {
    alert('Export noch nicht implementiert')
  }

  const handleCellValueChanged = async (params: any) => {
    try {
      const field = params?.colDef?.field
      const articleId = params?.data?.id
      if (!field || !articleId) return

      // Only persist document flag edits we support for now.
      const allowedFields = new Set([
        'pdf_drucken',
        'pdf',
        'pdf_bestell_pdf',
        'dxf',
        'bestell_dxf',
        'step',
        'x_t',
        'stl',
        'bn_ab'
      ])

      if (!allowedFields.has(field)) return

      const newValue = (params.newValue ?? '') as string
      await api.patch(`/articles/${articleId}/document-flags`, { [field]: newValue })
      // Refresh so UI stays in sync with server-side logic
      refetch()
    } catch (error: any) {
      // Revert on error
      try {
        params.node.setDataValue(params.colDef.field, params.oldValue)
      } catch {}
      alert('Fehler beim Speichern: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Browser kann nur Dateiname liefern, nicht vollständigen Pfad
      // Benutzer muss Pfad manuell eingeben oder wir verwenden den Dateinamen als Hinweis
      setAssemblyPath(file.name)
    }
  }

  const handleStartImport = async () => {
    // Validierung
    if (!auNr.trim()) {
      setImportError('Bitte geben Sie eine Auftragsnummer ein.')
      return
    }

    if (!assemblyPath.trim()) {
      setImportError('Bitte geben Sie den Pfad zur SolidWorks Assembly-Datei ein.')
      return
    }

    setImportError(null)
    setIsImporting(true)

    try {
      // 1. Projekt erstellen
      const projectResponse = await api.post('/projects', {
        au_nr: auNr.trim(),
        project_path: assemblyPath.trim()
      })
      const newProject = projectResponse.data

      // 2. SolidWorks importieren
      await api.post(`/projects/${newProject.id}/import-solidworks`, null, {
        params: { assembly_filepath: assemblyPath.trim() }
      })

      // 3. Projekt laden und anzeigen
      setProject(newProject)
      setAuNr('')
      setAssemblyPath('')
      refetch()
    } catch (error: any) {
      // Extrahiere detaillierte Fehlermeldung
      let errorMessage = 'Unbekannter Fehler'
      if (error.response?.data) {
        errorMessage = error.response.data.detail || error.response.data.message || JSON.stringify(error.response.data)
      } else {
        errorMessage = error.message || 'Unbekannter Fehler'
      }
      setImportError(`Fehler beim Import: ${errorMessage}`)
      
      // Wenn Projekt erstellt wurde aber Import fehlgeschlagen ist, 
      // könnte man hier das Projekt löschen (Rollback)
      // Für jetzt zeigen wir nur die Fehlermeldung
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="app">
      {!project ? (
        <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ marginBottom: '30px' }}>Neues Projekt importieren</h2>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Auftragsnummer:
            </label>
            <input
              type="text"
              value={auNr}
              onChange={(e) => setAuNr(e.target.value)}
              placeholder="z.B. AU-2024-001"
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
              disabled={isImporting}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              SolidWorks Assembly-Pfad:
            </label>
            <input
              type="text"
              value={assemblyPath}
              onChange={(e) => setAssemblyPath(e.target.value)}
              placeholder="z.B. C:\Projekte\Assembly.sldasm"
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                marginBottom: '10px'
              }}
              disabled={isImporting}
            />
            <div>
              <label style={{ display: 'inline-block', cursor: 'pointer', padding: '8px 16px', backgroundColor: '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px' }}>
                Datei auswählen
                <input
                  type="file"
                  accept=".sldasm"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  disabled={isImporting}
                />
              </label>
              <span style={{ marginLeft: '10px', fontSize: '14px', color: '#666' }}>
                (Hinweis: Browser zeigt nur Dateiname. Bitte vollständigen Pfad manuell eingeben.)
              </span>
            </div>
          </div>

          {importError && (
            <div style={{
              padding: '12px',
              backgroundColor: '#fee',
              border: '1px solid #fcc',
              borderRadius: '4px',
              color: '#c00',
              marginBottom: '20px'
            }}>
              {importError}
            </div>
          )}

          <button
            onClick={handleStartImport}
            disabled={isImporting || !auNr.trim() || !assemblyPath.trim()}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              backgroundColor: isImporting ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isImporting ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              width: '100%'
            }}
          >
            {isImporting ? 'Import läuft...' : 'Import starten'}
          </button>

          {isImporting && (
            <div style={{ marginTop: '20px', textAlign: 'center', color: '#666' }}>
              Projekt wird erstellt und SolidWorks-Daten werden importiert...
            </div>
          )}
        </div>
      ) : (
        <>
          <ProjectHeader
            project={project}
            onImportSolidworks={handleImportSolidworks}
            onCheckERP={handleCheckERP}
            onSyncOrders={handleSyncOrders}
            onCreateDocuments={handleCreateDocuments}
            onCheckDocuments={handleCheckDocuments}
            onPrintPDFQueueMerged={handlePrintPDFQueueMerged}
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
