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
  // #region agent log
  useEffect(() => {
    console.log('DEBUG: App component mounted, project:', project);
    fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:12',message:'App component rendering',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch((err)=>{console.error('DEBUG: Log send failed:', err);});
  }, []);
  // #endregion
  const [project, setProject] = useState<Project | null>(null)
  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:16',message:'project state initialized',data:{project:project,isNull:project===null,type:typeof project},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  }, [project]);
  // #endregion
  const [auNr, setAuNr] = useState('')
  const [assemblyPath, setAssemblyPath] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const { articles, loading, error, refetch } = useArticles(project?.id || null)

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:19',message:'App component mounted',data:{project:project,windowLocation:window.location.href},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
  }, []);
  
  useEffect(() => {
    const shouldShowForm = !project;
    console.log('DEBUG: Render decision - project:', project, 'shouldShowForm:', shouldShowForm);
    fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:176',message:'render decision',data:{project:project,shouldShowForm:shouldShowForm,projectIsNull:project===null,projectIsUndefined:project===undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch((err)=>{console.error('DEBUG: Log send failed:', err);});
    
    if (shouldShowForm) {
      console.log('DEBUG: Rendering form branch');
      fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:182',message:'rendering form branch',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch((err)=>{console.error('DEBUG: Log send failed:', err);});
    } else {
      console.log('DEBUG: Rendering project view branch, project:', project);
      fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:263',message:'rendering project view branch',data:{projectId:project?.id,projectAuNr:project?.au_nr},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch((err)=>{console.error('DEBUG: Log send failed:', err);});
    }
  }, [project]);
  // #endregion

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

    // #region agent log
    console.log('DEBUG: Starting import - auNr:', auNr, 'assemblyPath:', assemblyPath, 'API URL:', api.defaults.baseURL);
    fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:150',message:'handleStartImport called',data:{auNr:auNr,assemblyPath:assemblyPath,apiBaseURL:api.defaults.baseURL},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'IMPORT1'})}).catch((err)=>{console.error('DEBUG: Log send failed:', err);});
    // #endregion

    try {
      // #region agent log
      console.log('DEBUG: Creating project...');
      // #endregion
      
      // 1. Projekt erstellen
      const projectResponse = await api.post('/projects', {
        au_nr: auNr.trim(),
        project_path: assemblyPath.trim()
      })
      
      // #region agent log
      console.log('DEBUG: Project created:', projectResponse.data);
      fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:172',message:'project created',data:{projectId:projectResponse.data?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'IMPORT3'})}).catch((err)=>{console.error('DEBUG: Log send failed:', err);});
      // #endregion
      
      const newProject = projectResponse.data

      // #region agent log
      console.log('DEBUG: Importing SolidWorks for project:', newProject.id);
      // #endregion

      // 2. SolidWorks importieren
      await api.post(`/projects/${newProject.id}/import-solidworks`, null, {
        params: { assembly_filepath: assemblyPath.trim() }
      })

      // #region agent log
      console.log('DEBUG: SolidWorks import successful');
      // #endregion

      // 3. Projekt laden und anzeigen
      setProject(newProject)
      setAuNr('')
      setAssemblyPath('')
      refetch()
    } catch (error: any) {
      // #region agent log
      console.error('DEBUG: Import error:', error);
      console.error('DEBUG: Error response:', error.response);
      console.error('DEBUG: Error message:', error.message);
      console.error('DEBUG: Error code:', error.code);
      fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:195',message:'import error',data:{errorMessage:error.message,errorCode:error.code,errorResponse:error.response?.data,statusCode:error.response?.status,apiBaseURL:api.defaults.baseURL},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'IMPORT6'})}).catch((err)=>{console.error('DEBUG: Log send failed:', err);});
      // #endregion
      
      // Extrahiere detaillierte Fehlermeldung
      let errorMessage = 'Unbekannter Fehler'
      if (error.response?.data) {
        console.log('DEBUG: Error response data:', error.response.data)
        errorMessage = error.response.data.detail || error.response.data.message || JSON.stringify(error.response.data)
      } else {
        errorMessage = error.message || 'Unbekannter Fehler'
      }
      console.log('DEBUG: Final error message:', errorMessage)
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
