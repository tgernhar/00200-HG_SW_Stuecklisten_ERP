/**
 * Main App Component
 */
import React, { useState } from 'react'
import { ProjectHeader } from './components/ProjectHeader'
import { ArticleGrid } from './components/ArticleGrid'
import { OrdersDrawer } from './components/OrdersDrawer'
import { useArticles } from './hooks/useArticles'
import api from './services/api'
import { Bom, HugwawiBestellartikelTemplate, HugwawiOrderArticleItem, Project, Article } from './services/types'
import './App.css'

function App() {
  const [project, setProject] = useState<Project | null>(null)
  const [auNr, setAuNr] = useState('')
  const [assemblyPath, setAssemblyPath] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [boms, setBoms] = useState<Bom[]>([])
  const [selectedBomId, setSelectedBomId] = useState<number | null>(null)
  const { articles, loading, error, refetch } = useArticles(project?.id || null, selectedBomId)
  const [ordersArticleId, setOrdersArticleId] = useState<number | null>(null)
  const [ordersArticleNumber, setOrdersArticleNumber] = useState<string | undefined>(undefined)
  const [selectedArticles, setSelectedArticles] = useState<Article[]>([])

  const [hugwawiItems, setHugwawiItems] = useState<HugwawiOrderArticleItem[]>([])
  const [showHugwawiPicker, setShowHugwawiPicker] = useState(false)
  const [hugwawiSearch, setHugwawiSearch] = useState('')
  const [selectedHugwawiKey, setSelectedHugwawiKey] = useState<string | null>(null)

  const [showBestellartikelModal, setShowBestellartikelModal] = useState(false)
  const [bestellartikelTemplates, setBestellartikelTemplates] = useState<HugwawiBestellartikelTemplate[]>([])
  const [bestellartikelSearch, setBestellartikelSearch] = useState('')
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<number>>(new Set())

  const refreshBoms = async (projectId: number) => {
    const resp = await api.get(`/projects/${projectId}/boms`)
    const items = (resp?.data?.items || []) as Bom[]
    setBoms(items)
    if (items.length && !selectedBomId) setSelectedBomId(items[0].id)
    if (items.length && selectedBomId && !items.find((b) => b.id === selectedBomId)) setSelectedBomId(items[0].id)
  }

  const openHugwawiPickerForAu = async (au: string) => {
    const resp = await api.get(`/hugwawi/orders/${encodeURIComponent(au)}/articles`)
    const items = (resp?.data?.items || []) as HugwawiOrderArticleItem[]
    if (!items.length) {
      throw new Error('Keine Artikel für diesen Auftrag in HUGWAWI gefunden.')
    }
    setHugwawiItems(items)
    setHugwawiSearch('')
    setSelectedHugwawiKey(null)
    setShowHugwawiPicker(true)
  }

  const openBestellartikelModal = async () => {
    if (!project) return
    if (!selectedBomId) {
      alert('Bitte zuerst eine Stückliste auswählen.')
      return
    }
    if (!selectedArticles?.length) {
      alert('Bitte zuerst Artikel im Grid auswählen (Checkbox-Spalte links).')
      return
    }
    const resp = await api.get('/hugwawi/bestellartikel-templates')
    const items = (resp?.data?.items || []) as HugwawiBestellartikelTemplate[]
    setBestellartikelTemplates(items)
    setBestellartikelSearch('')
    setSelectedTemplateIds(new Set())
    setShowBestellartikelModal(true)
  }

  const handleImportSolidworks = async () => {
    if (!project) return
    
    const filepath = prompt('Bitte geben Sie den Pfad zur SOLIDWORKS-Assembly ein:')
    if (!filepath) return

    try {
      setAssemblyPath(filepath)
      await openHugwawiPickerForAu(project.au_nr)
    } catch (error: any) {
      alert('Fehler: ' + (error.response?.data?.detail || error.message))
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

      const generated_count =
        (response as any)?.data?.generated_count ??
        (Array.isArray((response as any)?.data?.generated) ? (response as any).data.generated.length : undefined)
      const failed_count =
        (response as any)?.data?.failed_count ??
        (Array.isArray((response as any)?.data?.failed) ? (response as any).data.failed.length : undefined)

      alert(
        `Dokumente erstellt: ${generated_count ?? '-'} erfolgreich, ${failed_count ?? '-'} fehlgeschlagen`
      )
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
    if (!project) return
    const doExport = async () => {
      try {
        const selectedIds = selectedArticles.map(a => a.id).filter(Boolean)
        const params: any = {}
        if (selectedIds.length) params.article_ids = selectedIds.join(',')

        const res = await api.get(`/projects/${project.id}/export-hugwawi-articles-csv`, {
          params,
          responseType: 'blob'
        } as any)

        const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' })

        // Try get filename from Content-Disposition
        const cd = (res as any)?.headers?.['content-disposition'] as string | undefined
        let filename = `hugwawi_import_${project.au_nr}.csv`
        if (cd) {
          const m = /filename=\"?([^\";]+)\"?/i.exec(cd)
          if (m?.[1]) filename = m[1]
        }

        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)
      } catch (error: any) {
        alert('Fehler beim Export: ' + (error.response?.data?.detail || error.message))
      }
    }
    doExport()
  }

  const handleCellValueChanged = async (params: any) => {
    try {
      const field = params?.colDef?.field
      const articleId = params?.data?.id
      if (!field || !articleId) return

      // Document-Flags: persist via dedicated endpoint
      const documentFlagFields = new Set([
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

      // Artikel-Stammdaten (editierbare Spalten in Block C)
      const articleFields = new Set([
        'hg_artikelnummer',
        'teilenummer',
        'p_menge',
        'teiletyp_fertigungsplan',
        'abteilung_lieferant',
        'werkstoff',
        'werkstoff_nr',
        'oberflaeche',
        'oberflaechenschutz',
        'farbe',
        'lieferzeit',
        'laenge',
        'breite',
        'hoehe',
        'gewicht',
        'in_stueckliste_anzeigen'
      ])

      const parseOptionalNumber = (v: any) => {
        if (v === '' || v === null || v === undefined) return null
        const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
        return Number.isFinite(n) ? n : null
      }

      const parseOptionalInt = (v: any) => {
        if (v === '' || v === null || v === undefined) return null
        const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
        if (!Number.isFinite(n)) return null
        return Math.trunc(n)
      }

      const parseBoolean = (v: any) => {
        if (typeof v === 'boolean') return v
        if (v === 'true') return true
        if (v === 'false') return false
        return !!v
      }

      if (documentFlagFields.has(field)) {
        const raw = String(params.newValue ?? '')
        const trimmed = raw.trim()
        // "x" soll nicht manuell eingetragen werden; grün/rot kommt über Datei-Existenz.
        // Erlaubt bleiben: "1" (Dokument erstellen) oder leer.
        const lowered = trimmed.toLowerCase()
        const newValue = (lowered === 'x' || trimmed === '-') ? '' : trimmed
        await api.patch(`/articles/${articleId}/document-flags`, { [field]: newValue })
        refetch()
        return
      }

      if (articleFields.has(field)) {
        let value: any = params.newValue
        if (field === 'in_stueckliste_anzeigen') value = parseBoolean(value)
        if (field === 'p_menge') value = parseOptionalInt(value)
        if (field === 'laenge' || field === 'breite' || field === 'hoehe' || field === 'gewicht') {
          value = parseOptionalNumber(value)
        }

        await api.patch(`/articles/${articleId}`, { [field]: value })
        refetch()
        return
      }

      // Ignore edits on fields we don't persist
      return
    } catch (error: any) {
      // Revert on error
      try {
        params.node.setDataValue(params.colDef.field, params.oldValue)
      } catch {}
      alert('Fehler beim Speichern: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleOpenOrders = (article: any) => {
    setOrdersArticleId(article?.id ?? null)
    setOrdersArticleNumber(article?.hg_artikelnummer)
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
      // 1) Projekt erstellen (oder vorhandenes Projekt laden)
      let newProject: Project | null = null
      try {
        const projectResponse = await api.post('/projects', {
          au_nr: auNr.trim(),
          project_path: assemblyPath.trim()
        })
        newProject = projectResponse.data
      } catch (e: any) {
        if (e?.response?.status === 400) {
          const list = await api.get('/projects')
          const found = (list.data || []).find((p: Project) => p.au_nr === auNr.trim())
          if (!found) throw e
          newProject = found
        } else {
          throw e
        }
      }

      if (!newProject) throw new Error('Projekt konnte nicht geladen/erstellt werden')
      setProject(newProject)
      await refreshBoms(newProject.id)

      // 2) HUGWAWI Artikel-Auswahl öffnen (Import wird nach Auswahl durchgeführt)
      await openHugwawiPickerForAu(auNr.trim())
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
      {showHugwawiPicker && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ background: '#fff', padding: 16, width: 720, maxWidth: '95vw', maxHeight: '80vh', overflow: 'auto', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Artikel in Auftrag auswählen</h3>
              <button onClick={() => setShowHugwawiPicker(false)}>Schließen</button>
            </div>
            <div style={{ marginBottom: 10 }}>
              <input
                value={hugwawiSearch}
                onChange={(e) => setHugwawiSearch(e.target.value)}
                placeholder="Suchen (Artikelnummer / Beschreibung)..."
                style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 6 }}
              />
            </div>
            <div style={{ border: '1px solid #ddd', borderRadius: 6 }}>
              {(hugwawiItems || [])
                .filter((it) => {
                  const q = (hugwawiSearch || '').toLowerCase().trim()
                  if (!q) return true
                  return (
                    (it.hugwawi_articlenumber || '').toLowerCase().includes(q) ||
                    (it.hugwawi_description || '').toLowerCase().includes(q)
                  )
                })
                .map((it) => {
                  const key = `${it.hugwawi_order_id}:${it.hugwawi_order_article_id}`
                  return (
                    <label key={key} style={{ display: 'flex', gap: 10, padding: '8px 10px', borderBottom: '1px solid #eee', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="hugwawiPick"
                        checked={selectedHugwawiKey === key}
                        onChange={() => setSelectedHugwawiKey(key)}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{it.hugwawi_articlenumber}</div>
                        <div style={{ fontSize: 12, color: '#555' }}>{it.hugwawi_description || ''}</div>
                      </div>
                      <div style={{ fontSize: 12, color: '#666' }}>OrderArticleId {it.hugwawi_order_article_id}</div>
                    </label>
                  )
                })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <button onClick={() => setShowHugwawiPicker(false)}>Abbrechen</button>
              <button
                style={{ fontWeight: 700 }}
                disabled={!selectedHugwawiKey || !project}
                onClick={async () => {
                  if (!project || !selectedHugwawiKey) return
                  const picked = (hugwawiItems || []).find((it) => `${it.hugwawi_order_id}:${it.hugwawi_order_article_id}` === selectedHugwawiKey)
                  if (!picked) return
                  try {
                    let bomResp
                    try {
                      bomResp = await api.post(`/projects/${project.id}/boms`, {
                        hugwawi_order_id: picked.hugwawi_order_id,
                        hugwawi_order_name: picked.hugwawi_order_name,
                        hugwawi_order_article_id: picked.hugwawi_order_article_id,
                        hugwawi_article_id: picked.hugwawi_article_id,
                        hugwawi_articlenumber: picked.hugwawi_articlenumber
                      })
                    } catch (e: any) {
                      if (e?.response?.status === 409) {
                        const pw = prompt('Stückliste existiert bereits. Passwort zum Überschreiben (aktuell: 1):') || ''
                        if (!pw) return
                        bomResp = await api.post(`/projects/${project.id}/boms`, {
                          hugwawi_order_id: picked.hugwawi_order_id,
                          hugwawi_order_name: picked.hugwawi_order_name,
                          hugwawi_order_article_id: picked.hugwawi_order_article_id,
                          hugwawi_article_id: picked.hugwawi_article_id,
                          hugwawi_articlenumber: picked.hugwawi_articlenumber,
                          overwrite_password: pw
                        })
                      } else {
                        throw e
                      }
                    }

                    const bom = (bomResp?.data?.bom || null) as Bom | null
                    if (!bom) throw new Error('BOM konnte nicht erstellt werden')

                    try {
                      const importResp = await api.post(`/projects/${project.id}/boms/${bom.id}/import-solidworks`, null, {
                        params: { assembly_filepath: assemblyPath.trim() }
                      })
                      if (importResp?.data?.success === false) {
                        throw new Error(importResp?.data?.error || 'SOLIDWORKS-Import fehlgeschlagen')
                      }
                    } catch (e: any) {
                      if (e?.response?.status === 409) {
                        const pw = prompt('Import existiert bereits. Passwort zum Überschreiben (aktuell: 1):') || ''
                        if (!pw) return
                        const importResp = await api.post(`/projects/${project.id}/boms/${bom.id}/import-solidworks`, null, {
                          params: { assembly_filepath: assemblyPath.trim(), overwrite_password: pw }
                        })
                        if (importResp?.data?.success === false) {
                          throw new Error(importResp?.data?.error || 'SOLIDWORKS-Import fehlgeschlagen')
                        }
                      } else {
                        throw e
                      }
                    }

                    setShowHugwawiPicker(false)
                    await refreshBoms(project.id)
                    setSelectedBomId(bom.id)
                    setAuNr('')
                    refetch()
                    alert('Import erfolgreich!')
                  } catch (e: any) {
                    alert('Fehler: ' + (e?.response?.data?.detail || e?.message || String(e)))
                  }
                }}
              >
                Import starten
              </button>
            </div>
          </div>
        </div>
      )}
      {showBestellartikelModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100
        }}>
          <div style={{ background: '#fff', padding: 16, width: 820, maxWidth: '95vw', maxHeight: '85vh', overflow: 'auto', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Bestellartikel erstellen</h3>
              <button onClick={() => setShowBestellartikelModal(false)}>Schließen</button>
            </div>
            <div style={{ marginBottom: 10, color: '#444', fontSize: 13 }}>
              Ausgewählte Basis-Artikel: {selectedArticles?.length || 0}
            </div>
            <div style={{ marginBottom: 10 }}>
              <input
                value={bestellartikelSearch}
                onChange={(e) => setBestellartikelSearch(e.target.value)}
                placeholder="Suchen (customtext2/customtext3/Artikelnummer/Beschreibung)..."
                style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 6 }}
              />
            </div>
            <div style={{ border: '1px solid #ddd', borderRadius: 6 }}>
              {(bestellartikelTemplates || [])
                .filter((t) => {
                  const q = (bestellartikelSearch || '').toLowerCase().trim()
                  if (!q) return true
                  return (
                    (t.customtext2 || '').toLowerCase().includes(q) ||
                    (t.customtext3 || '').toLowerCase().includes(q) ||
                    (t.hugwawi_articlenumber || '').toLowerCase().includes(q) ||
                    (t.hugwawi_description || '').toLowerCase().includes(q)
                  )
                })
                .map((t) => {
                  const checked = selectedTemplateIds.has(t.hugwawi_article_id)
                  return (
                    <label
                      key={t.hugwawi_article_id}
                      style={{ display: 'flex', gap: 10, padding: '8px 10px', borderBottom: '1px solid #eee', cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelectedTemplateIds((prev) => {
                            const next = new Set(prev)
                            if (next.has(t.hugwawi_article_id)) next.delete(t.hugwawi_article_id)
                            else next.add(t.hugwawi_article_id)
                            return next
                          })
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                          <div style={{ fontWeight: 600 }}>{t.customtext2 || t.hugwawi_articlenumber}</div>
                          <div style={{ fontFamily: 'monospace', color: '#444' }}>{t.customtext3 || ''}</div>
                        </div>
                        <div style={{ fontSize: 12, color: '#666' }}>{t.hugwawi_description || ''}</div>
                      </div>
                    </label>
                  )
                })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <button onClick={() => setShowBestellartikelModal(false)}>Abbrechen</button>
              <button
                style={{ fontWeight: 700 }}
                disabled={!selectedBomId || selectedTemplateIds.size === 0 || selectedArticles.length === 0}
                onClick={async () => {
                  if (!selectedBomId) return
                  try {
                    const srcIds = selectedArticles.map((a) => a.id)
                    const tplIds = Array.from(selectedTemplateIds)
                    const resp = await api.post(`/boms/${selectedBomId}/create-bestellartikel`, {
                      source_article_ids: srcIds,
                      template_ids: tplIds
                    })
                    setShowBestellartikelModal(false)
                    refetch()
                    alert(`Bestellartikel erstellt: ${resp?.data?.created_count ?? ''}`)
                  } catch (e: any) {
                    alert('Fehler: ' + (e?.response?.data?.detail || e?.message || String(e)))
                  }
                }}
              >
                Bestellartikel erstellen
              </button>
            </div>
          </div>
        </div>
      )}
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
            boms={boms}
            selectedBomId={selectedBomId}
            onSelectBom={(id) => {
              setSelectedBomId(id)
              setTimeout(() => refetch(), 0)
            }}
            onImportSolidworks={handleImportSolidworks}
            onCreateBestellartikel={openBestellartikelModal}
            onCheckERP={handleCheckERP}
            onSyncOrders={handleSyncOrders}
            onCreateDocuments={handleCreateDocuments}
            onCheckDocuments={handleCheckDocuments}
            onPrintPDFQueueMerged={handlePrintPDFQueueMerged}
            onExport={handleExport}
          />
          <div style={{ height: 'calc(100vh - 200px)', width: '100%' }}>
            {error && <div style={{ color: 'red' }}>Fehler: {error}</div>}
            <div style={{ position: 'relative', height: '100%' }}>
              <ArticleGrid 
                articles={articles} 
                projectId={project?.id}
                onCellValueChanged={handleCellValueChanged}
                onOpenOrders={handleOpenOrders}
                onSelectionChanged={(sel) => setSelectedArticles(sel)}
                onAfterBulkUpdate={() => refetch()}
              />
              {loading && (
                <div style={{
                  position: 'absolute',
                  top: 8,
                  right: 12,
                  padding: '6px 10px',
                  backgroundColor: 'rgba(255,255,255,0.85)',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '12px'
                }}>
                  Lade Artikel...
                </div>
              )}
            </div>
          </div>
          <OrdersDrawer
            articleId={ordersArticleId}
            articleNumber={ordersArticleNumber}
            onClose={() => setOrdersArticleId(null)}
          />
        </>
      )}
    </div>
  )
}

export default App
