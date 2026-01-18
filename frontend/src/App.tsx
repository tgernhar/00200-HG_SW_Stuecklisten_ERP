/**
 * Main App Component
 */
import React, { useEffect, useState } from 'react'
import { ProjectHeader } from './components/ProjectHeader'
import { ArticleGrid } from './components/ArticleGrid'
import { OrdersDrawer } from './components/OrdersDrawer'
import { useArticles } from './hooks/useArticles'
import api from './services/api'
import { Bom, HugwawiBestellartikelTemplate, HugwawiOrderArticleItem, Project, Article } from './services/types'
import './App.css'

function App() {
  const [project, setProject] = useState<Project | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsSearch, setProjectsSearch] = useState('')
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [projectsError, setProjectsError] = useState<string | null>(null)
  const [lastProjectId, setLastProjectId] = useState<number | null>(null)
  const [lastSelectedBomId, setLastSelectedBomId] = useState<number | null>(null)
  const [allowRestore, setAllowRestore] = useState(true)
  const [pendingAuNr, setPendingAuNr] = useState<string | null>(null)
  const [auNr, setAuNr] = useState('')
  const [manualArtikelNr, setManualArtikelNr] = useState('')
  const [assemblyPath, setAssemblyPath] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importStep, setImportStep] = useState<string | null>(null)
  const [boms, setBoms] = useState<Bom[]>([])
  const [selectedBomId, setSelectedBomId] = useState<number | null>(null)
  const { articles, loading, error, refetch } = useArticles(project?.id || null, selectedBomId)
  const [ordersArticleId, setOrdersArticleId] = useState<number | null>(null)
  const [ordersArticleNumber, setOrdersArticleNumber] = useState<string | undefined>(undefined)
  const [selectedArticles, setSelectedArticles] = useState<Article[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [selectlistValues, setSelectlistValues] = useState<Record<number, string[]>>({})

  const [hugwawiItems, setHugwawiItems] = useState<HugwawiOrderArticleItem[]>([])
  const [showHugwawiPicker, setShowHugwawiPicker] = useState(false)
  const [hugwawiSearch, setHugwawiSearch] = useState('')
  const [selectedHugwawiKey, setSelectedHugwawiKey] = useState<string | null>(null)

  const [showBestellartikelModal, setShowBestellartikelModal] = useState(false)
  const [bestellartikelTemplates, setBestellartikelTemplates] = useState<HugwawiBestellartikelTemplate[]>([])
  const [bestellartikelSearch, setBestellartikelSearch] = useState('')
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<number>>(new Set())

  // #region agent log
  const _log = (location: string, message: string, data: any) => {
    try {
      fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'run5',
          hypothesisId: 'PROJECT_LOAD',
          location,
          message,
          data,
          timestamp: Date.now()
        })
      }).catch(() => {})
    } catch {}
  }
  // #endregion agent log

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('lastProjectId')
      if (raw) setLastProjectId(Number(raw))
      const rawBom = window.localStorage.getItem('lastSelectedBomId')
      if (rawBom) setLastSelectedBomId(Number(rawBom))
    } catch {}
  }, [])

  useEffect(() => {
    const restore = async () => {
      if (!allowRestore || !lastProjectId || project) return
      try {
        const resp = await api.get(`/projects/${lastProjectId}`)
        const p = resp?.data as Project
        if (p) await openProject(p)
      } catch {
        try {
          window.localStorage.removeItem('lastProjectId')
          window.localStorage.removeItem('lastSelectedBomId')
        } catch {}
      }
    }
    restore()
  }, [lastProjectId, project, allowRestore])

  useEffect(() => {
    const loadSelectlists = async () => {
      try {
        const [deptResp, w17, w15, w18, w21, w19, w22] = await Promise.all([
          api.get('/hugwawi/departments'),
          api.get('/hugwawi/selectlist-values/17'),
          api.get('/hugwawi/selectlist-values/15'),
          api.get('/hugwawi/selectlist-values/18'),
          api.get('/hugwawi/selectlist-values/21'),
          api.get('/hugwawi/selectlist-values/19'),
          api.get('/hugwawi/selectlist-values/22')
        ])

        const deptItems = (deptResp?.data?.items || []) as Array<{ name?: string }>
        setDepartments(deptItems.map((d) => String(d.name || '')).filter(Boolean))

        const toValues = (resp: any) =>
          (resp?.data?.items || []).map((v: any) => String(v.value || '')).filter(Boolean)

        setSelectlistValues({
          17: toValues(w17),
          15: toValues(w15),
          18: toValues(w18),
          21: toValues(w21),
          19: toValues(w19),
          22: toValues(w22)
        })
      } catch (e: any) {
        // still allow manual input
      }
    }
    loadSelectlists()
  }, [])

  const loadProjects = async (params?: { au_nr?: string; artikel_nr?: string }) => {
    setProjectsLoading(true)
    setProjectsError(null)
    // #region agent log
    _log('App.tsx:loadProjects', 'request', {})
    // #endregion agent log
    try {
      const resp = await api.get('/projects', { params })
      const list = (resp?.data || []) as Project[]
      setProjects(list)
      // #region agent log
      _log('App.tsx:loadProjects', 'response', { count: list.length })
      // #endregion agent log
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Fehler beim Laden'
      setProjectsError(String(msg))
      // #region agent log
      _log('App.tsx:loadProjects', 'error', { message: String(msg), status: e?.response?.status })
      // #endregion agent log
    } finally {
      setProjectsLoading(false)
    }
  }

  const loadProjectsByAu = async (au: string) => {
    const q = (au || '').trim()
    if (!q) return
    // #region agent log
    _log('App.tsx:loadProjectsByAu', 'request', { au: q })
    // #endregion agent log
    try {
      await loadProjects({ au_nr: q })
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Projekt nicht gefunden'
      // #region agent log
      _log('App.tsx:loadProjectsByAu', 'error', { au: q, message: msg, status: e?.response?.status })
      // #endregion agent log
      alert(String(msg))
    }
  }

  const loadProjectByArtikelNr = async (artikelNr: string) => {
    const q = (artikelNr || '').trim()
    if (!q) return null
    // #region agent log
    _log('App.tsx:loadProjectByArtikelNr', 'request', { artikelNr: q })
    // #endregion agent log
    try {
      const resp = await api.get('/projects', { params: { artikel_nr: q } })
      const list = (resp?.data || []) as Project[]
      const p = list[0] || null
      // #region agent log
      _log('App.tsx:loadProjectByArtikelNr', 'response', { artikelNr: q, projectId: p?.id })
      // #endregion agent log
      return p
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Projekt nicht gefunden'
      // #region agent log
      _log('App.tsx:loadProjectByArtikelNr', 'error', { artikelNr: q, message: msg, status: e?.response?.status })
      // #endregion agent log
      return null
    }
  }

  const refreshBoms = async (projectId: number) => {
    const resp = await api.get(`/projects/${projectId}/boms`)
    const items = (resp?.data?.items || []) as Bom[]
    setBoms(items)
    const preferred = lastSelectedBomId
    if (items.length) {
      if (preferred && items.find((b) => b.id === preferred)) {
        setSelectedBomId(preferred)
      } else if (!selectedBomId || !items.find((b) => b.id === selectedBomId)) {
        setSelectedBomId(items[0].id)
      }
    }
  }

  const openProject = async (p: Project) => {
    setProject(p)
    setAuNr('')
    setAssemblyPath('')
    try {
      window.localStorage.setItem('lastProjectId', String(p.id))
      setLastProjectId(p.id)
    } catch {}
    await refreshBoms(p.id)
    refetch()
    // #region agent log
    _log('App.tsx:openProject', 'selected', { projectId: p.id })
    // #endregion agent log
  }

  const openHugwawiPickerForAu = async (au: string) => {
    // #region agent log
    _log('App.tsx:openHugwawiPickerForAu', 'request', { au })
    // #endregion agent log
    const resp = await api.get(`/hugwawi/orders/${encodeURIComponent(au)}/articles`)
    const items = (resp?.data?.items || []) as HugwawiOrderArticleItem[]
    // #region agent log
    _log('App.tsx:openHugwawiPickerForAu', 'response', { au, count: items.length })
    // #endregion agent log
    if (!items.length) {
      throw new Error('Keine Artikel für diesen Auftrag in HUGWAWI gefunden.')
    }
    setHugwawiItems(items)
    setHugwawiSearch('')
    setSelectedHugwawiKey(null)
    setManualArtikelNr('')
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
    
    // #region agent log
    _log('App.tsx:handleImportSolidworks', 'start', { projectId: project.id, au_nr: project.au_nr })
    // #endregion agent log
    try {
      await openHugwawiPickerForAu(project.au_nr)
    } catch (error: any) {
      // #region agent log
      _log('App.tsx:handleImportSolidworks', 'error', { message: error?.message || String(error) })
      // #endregion agent log
      alert('Fehler: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleCheckERP = async () => {
    if (!project) return

    try {
      const response = await api.post(`/projects/${project.id}/check-all-articlenumbers`)
      const { exists_count, not_exists_count, total_checked } = response.data
      alert(`Artikel-Sync abgeschlossen: ${total_checked} geprüft, ${exists_count} vorhanden, ${not_exists_count} fehlen`)
      refetch()
    } catch (error: any) {
      alert('Fehler beim Artikel-Sync: ' + error.message)
    }
  }

  const handleSyncOrders = async () => {
    if (!project) return

    try {
      // #region agent log
      _log('App.tsx:bnSync', 'start', { projectId: project.id, selectedBomId })
      // #endregion agent log
      const bomQuery = selectedBomId ? `?bom_id=${selectedBomId}` : ''
      const resp = await api.post(`/projects/${project.id}/sync-orders${bomQuery}`)
      // #region agent log
      _log('App.tsx:bnSync', 'success', { projectId: project.id, data: resp?.data })
      // #endregion agent log
      alert('Bestellungen synchronisiert!')
      refetch()
    } catch (error: any) {
      // #region agent log
      _log('App.tsx:bnSync', 'error', {
        projectId: project?.id,
        message: error?.message,
        status: error?.response?.status,
        detail: error?.response?.data?.detail
      })
      // #endregion agent log
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

    setImportError(null)
    setIsImporting(true)

    try {
      setPendingAuNr(auNr.trim())
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
              <div style={{ padding: '8px 10px', borderBottom: '1px solid #eee' }}>
                <label style={{ display: 'flex', gap: 10, cursor: 'pointer', alignItems: 'center' }}>
                  <input
                    type="radio"
                    name="hugwawiPick"
                    checked={selectedHugwawiKey === 'manual'}
                    onChange={() => setSelectedHugwawiKey('manual')}
                  />
                  <div style={{ fontWeight: 600 }}>Neue Artikelnummer von Hand eingeben</div>
                </label>
                {selectedHugwawiKey === 'manual' && (
                  <div style={{ marginTop: 8 }}>
                    <input
                      value={manualArtikelNr}
                      onChange={(e) => setManualArtikelNr(e.target.value)}
                      placeholder="Artikelnummer eingeben..."
                      style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 6 }}
                    />
                  </div>
                )}
              </div>
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
                disabled={
                  !selectedHugwawiKey ||
                  (selectedHugwawiKey === 'manual' && !manualArtikelNr.trim()) ||
                  (!project && !(pendingAuNr || auNr))
                }
                onClick={async () => {
                  // #region agent log
                  _log('App.tsx:importModal', 'click', {
                    selectedHugwawiKey,
                    hasProject: !!project,
                    pendingAuNr,
                    auNr
                  })
                  // #endregion agent log
                  if (!selectedHugwawiKey) {
                    // #region agent log
                    _log('App.tsx:importModal', 'blocked-no-selection', {})
                    // #endregion agent log
                    return
                  }
                  let picked = (hugwawiItems || []).find(
                    (it) => `${it.hugwawi_order_id}:${it.hugwawi_order_article_id}` === selectedHugwawiKey
                  )
                  if (selectedHugwawiKey === 'manual') {
                    const base = (hugwawiItems || [])[0]
                    const manualNr = manualArtikelNr.trim()
                    if (!manualNr) throw new Error('Artikelnummer fehlt')
                    if (!base) throw new Error('Auftrag nicht gefunden')
                    picked = {
                      ...base,
                      hugwawi_order_article_id: -1,
                      hugwawi_article_id: undefined,
                      hugwawi_articlenumber: manualNr,
                      hugwawi_description: 'Manuell'
                    }
                  }
                  if (!picked) return
                  try {
                    // Wenn noch kein Projekt geladen ist: jetzt erstellen/öffnen
                    let activeProject = project
                    if (!activeProject) {
                      const au = (pendingAuNr || auNr || '').trim()
                      if (!au) throw new Error('Auftragsnummer fehlt')
                      let newProject: Project | null = null
                      const artikelNr = (picked.hugwawi_articlenumber || '').trim()
                      if (!artikelNr) throw new Error('Artikelnummer fehlt')
                      try {
                        const projectResponse = await api.post('/projects', {
                          artikel_nr: artikelNr,
                          au_nr: au,
                          project_path: assemblyPath.trim()
                        })
                        newProject = projectResponse.data
                      } catch (e: any) {
                        if (e?.response?.status === 400) {
                          try {
                            const byArtikel = await loadProjectByArtikelNr(artikelNr)
                            newProject = byArtikel
                          } catch {
                            const list = await api.get('/projects', { params: { artikel_nr: artikelNr } })
                            const found = (list.data || [])[0] as Project | undefined
                            if (!found) throw e
                            newProject = found
                          }
                        } else {
                          throw e
                        }
                      }
                      if (!newProject) throw new Error('Projekt konnte nicht geladen/erstellt werden')
                      await openProject(newProject)
                      activeProject = newProject
                    }

                    let path = assemblyPath.trim()
                    if (!path) {
                      const p = prompt('Bitte geben Sie den Pfad zur SOLIDWORKS-Assembly ein:')
                      if (!p) return
                      path = p.trim()
                      setAssemblyPath(path)
                    }

                    // #region agent log
                    _log('App.tsx:importModal', 'start', {
                      projectId: activeProject.id,
                      au_nr: activeProject.au_nr,
                      hugwawi_order_id: picked.hugwawi_order_id,
                      hugwawi_order_article_id: picked.hugwawi_order_article_id,
                      assemblyPath: path
                    })
                    // #endregion agent log
                    let bomResp
                    try {
                      setImportStep('BOM anlegen')
                      bomResp = await api.post(`/projects/${activeProject.id}/boms`, {
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
                        setImportStep('BOM überschreiben')
                        bomResp = await api.post(`/projects/${activeProject.id}/boms`, {
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
                    if (!bom || !bom.id) {
                      throw new Error('BOM konnte nicht erstellt werden (keine ID)')
                    }
                    // #region agent log
                    _log('App.tsx:importModal', 'bom-created', { bomId: bom.id })
                    // #endregion agent log

                    try {
                      setImportStep('Import läuft')
                      // #region agent log
                      _log('App.tsx:importModal', 'import-call', { bomId: bom.id, assemblyPath: path })
                      // #endregion agent log
                      const importResp = await api.post(`/projects/${activeProject.id}/boms/${bom.id}/import-solidworks`, null, {
                        params: { assembly_filepath: path }
                      })
                      if (importResp?.data?.success === false) {
                        throw new Error(importResp?.data?.error || 'SOLIDWORKS-Import fehlgeschlagen')
                      }
                    } catch (e: any) {
                      if (e?.response?.status === 409) {
                        const pw = prompt('Import existiert bereits. Passwort zum Überschreiben (aktuell: 1):') || ''
                        if (!pw) return
                        setImportStep('Import überschreiben')
                        const importResp = await api.post(`/projects/${activeProject.id}/boms/${bom.id}/import-solidworks`, null, {
                          params: { assembly_filepath: path, overwrite_password: pw }
                        })
                        if (importResp?.data?.success === false) {
                          throw new Error(importResp?.data?.error || 'SOLIDWORKS-Import fehlgeschlagen')
                        }
                      } else {
                        throw e
                      }
                    }

                    setShowHugwawiPicker(false)
                    await refreshBoms(activeProject.id)
                    setSelectedBomId(bom.id)
                    setAuNr('')
                    refetch()
                    setImportStep('Fertig')
                    alert('Import erfolgreich!')
                  } catch (e: any) {
                    // #region agent log
                    _log('App.tsx:importModal', 'error', { message: e?.message || String(e), status: e?.response?.status, detail: e?.response?.data?.detail })
                    // #endregion agent log
                    setImportStep(null)
                    alert('Fehler: ' + (e?.response?.data?.detail || e?.message || String(e)))
                  }
                }}
              >
                Import starten
              </button>
              {/* #region agent log */}
              {(() => {
                try {
                  _log('App.tsx:importModal', 'button-state', {
                    selectedHugwawiKey,
                    hasProject: !!project,
                    pendingAuNr,
                    auNr,
                    disabled:
                      !selectedHugwawiKey ||
                      (selectedHugwawiKey === 'manual' && !manualArtikelNr.trim()) ||
                      (!project && !(pendingAuNr || auNr))
                  })
                } catch {}
                return null
              })()}
              {/* #endregion agent log */}
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
            {Array.from(selectedTemplateIds).length > 0 && (
              <div style={{ border: '1px solid #ddd', borderRadius: 6, marginBottom: 10 }}>
                <div style={{ padding: '6px 10px', fontWeight: 600, background: '#fafafa', borderBottom: '1px solid #eee' }}>
                  Ausgewählte Arbeitsgänge
                </div>
                {(bestellartikelTemplates || [])
                  .filter((t) => selectedTemplateIds.has(t.hugwawi_article_id))
                  .map((t) => (
                    <label
                      key={`selected-${t.hugwawi_article_id}`}
                      style={{ display: 'flex', gap: 10, padding: '6px 10px', borderBottom: '1px solid #eee', cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        checked={true}
                        onChange={() => {
                          setSelectedTemplateIds((prev) => {
                            const next = new Set(prev)
                            next.delete(t.hugwawi_article_id)
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
                  ))}
              </div>
            )}
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
          <h2 style={{ marginBottom: '12px' }}>Projekt laden</h2>
          <div style={{ marginBottom: '10px' }}>
            <input
              type="text"
              value={projectsSearch}
              onChange={(e) => setProjectsSearch(e.target.value)}
              placeholder="Suchen (AU-Nr / Artikelnummer)..."
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <button onClick={loadProjects} disabled={projectsLoading}>
              {projectsLoading ? 'Lade...' : 'Projekte laden'}
            </button>
            <button onClick={() => loadProjectsByAu(projectsSearch)} disabled={!projectsSearch.trim()}>
              Projekte nach AU laden
            </button>
            {lastProjectId && (
              <button
                onClick={async () => {
                  // #region agent log
                  _log('App.tsx:lastProject', 'click', { lastProjectId, projectsCount: projects.length })
                  // #endregion agent log
                  const p = projects.find((x) => x.id === lastProjectId)
                  if (p) {
                    // #region agent log
                    _log('App.tsx:lastProject', 'found-in-list', { lastProjectId })
                    // #endregion agent log
                    await openProject(p)
                  } else {
                    // #region agent log
                    _log('App.tsx:lastProject', 'not-found-in-list', { lastProjectId })
                    // #endregion agent log
                    await loadProjects()
                    const again = projects.find((x) => x.id === lastProjectId)
                    if (again) {
                      // #region agent log
                      _log('App.tsx:lastProject', 'found-after-reload', { lastProjectId })
                      // #endregion agent log
                      await openProject(again)
                    } else {
                      // #region agent log
                      _log('App.tsx:lastProject', 'still-missing', { lastProjectId })
                      // #endregion agent log
                      if (pendingAuNr || auNr) {
                        await loadProjectsByAu((pendingAuNr || auNr) as string)
                      }
                    }
                  }
                }}
              >
                Letztes Projekt öffnen
              </button>
            )}
          </div>
          {projectsError && <div style={{ color: 'red', marginBottom: '8px' }}>{projectsError}</div>}
          <div style={{ maxHeight: '200px', overflow: 'auto', border: '1px solid #eee', borderRadius: 4, marginBottom: '20px' }}>
            {(projects || [])
              .filter((p) => {
                const q = projectsSearch.toLowerCase().trim()
                if (!q) return true
                return (
                  (p.au_nr || '').toLowerCase().includes(q) ||
                  (p.artikel_nr || '').toLowerCase().includes(q)
                )
              })
              .map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderBottom: '1px solid #f0f0f0' }}>
                  <span>
                    <strong>{p.artikel_nr}</strong>
                    {p.au_nr ? `  · AU ${p.au_nr}` : ''}
                  </span>
                  <button
                    onClick={async () => {
                      // #region agent log
                      _log('App.tsx:openProject', 'click', { projectId: p.id, au_nr: p.au_nr })
                      // #endregion agent log
                      await openProject(p)
                    }}
                  >
                    Öffnen
                  </button>
                </div>
              ))}
          </div>
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
            <div style={{ marginTop: '20px' }}>
              <div style={{ marginBottom: 8, textAlign: 'center', color: '#666' }}>
                {importStep || 'Import läuft...'}
              </div>
              <div style={{ height: 8, background: '#eee', borderRadius: 6, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width:
                      importStep === 'BOM anlegen' ? '20%' :
                      importStep === 'BOM überschreiben' ? '30%' :
                      importStep === 'Import läuft' ? '70%' :
                      importStep === 'Import überschreiben' ? '80%' :
                      importStep === 'Fertig' ? '100%' : '40%',
                    background: '#4caf50',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>
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
              try {
                window.localStorage.setItem('lastSelectedBomId', String(id))
                setLastSelectedBomId(id)
              } catch {}
              setTimeout(() => refetch(), 0)
            }}
            onGoHome={() => {
              setAllowRestore(false)
              setProject(null)
              setBoms([])
              setSelectedBomId(null)
              setOrdersArticleId(null)
              setOrdersArticleNumber(undefined)
              setSelectedArticles([])
              setImportError(null)
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
                selectedBomId={selectedBomId}
                selectlists={{
                  departments,
                  werkstoff: selectlistValues[17] || [],
                  werkstoff_nr: selectlistValues[15] || [],
                  oberflaeche: selectlistValues[18] || [],
                  oberflaechenschutz: selectlistValues[21] || [],
                  farbe: selectlistValues[19] || [],
                  lieferzeit: selectlistValues[22] || []
                }}
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
