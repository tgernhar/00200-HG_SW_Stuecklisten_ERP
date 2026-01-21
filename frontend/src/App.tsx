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
  const [importPercent, setImportPercent] = useState<number | null>(null)
  const [importJobId, setImportJobId] = useState<number | null>(null)
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
  const [isCheckingDocuments, setIsCheckingDocuments] = useState(false)
  const [checkDocumentsMessage, setCheckDocumentsMessage] = useState<string | null>(null)
  const [isCreatingDocuments, setIsCreatingDocuments] = useState(false)
  const [createDocumentsMessage, setCreateDocumentsMessage] = useState<string | null>(null)

  // Optional debug logger (no-op). Keep signature flexible so callsites don't break typechecking.
  const _log = (..._args: any[]) => {}
  // #region agent log
  const _dbgLog = (hypothesisId: string, location: string, message: string, data: any) => {
    try {
      fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'import-error',
          hypothesisId,
          location,
          message,
          data,
          timestamp: Date.now()
        })
      }).catch(() => {})
    } catch {}
  }
  // #endregion

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('lastProjectId')
      if (raw) setLastProjectId(Number(raw))
      const rawBom = window.localStorage.getItem('lastSelectedBomId')
      if (rawBom) setLastSelectedBomId(Number(rawBom))
    } catch {}
  }, [])

  const pollImportJob = async (jobId: number) => {
    const resp = await api.get(`/import-jobs/${jobId}`)
    const j = resp?.data || {}
    const status = String(j.status || '')
    const step = String(j.step || '')
    const msg = (j.message ? String(j.message) : '') || ''
    const pct = (typeof j.percent === 'number' ? j.percent : null) as number | null
    const err = j.error ? String(j.error) : ''
    const asm = j.assembly_filepath ? String(j.assembly_filepath) : ''
    const createdAt = j.created_at ? String(j.created_at) : ''
    const updatedAt = j.updated_at ? String(j.updated_at) : ''
    const startedAt = j.started_at ? String(j.started_at) : ''
    const finishedAt = j.finished_at ? String(j.finished_at) : ''
    setImportJobId(jobId)
    setImportPercent(pct)
    if (status === 'queued') {
      setImportStep('Wartet…')
      return {
        done: false,
        failed: false,
        status,
        step,
        msg,
        pct,
        error: err,
        assembly: asm,
        createdAt,
        updatedAt,
        startedAt,
        finishedAt
      }
    }
    if (status === 'running') {
      setImportStep(msg || (step ? `Import läuft (${step})…` : 'Import läuft…'))
      return {
        done: false,
        failed: false,
        status,
        step,
        msg,
        pct,
        error: err,
        assembly: asm,
        createdAt,
        updatedAt,
        startedAt,
        finishedAt
      }
    }
    if (status === 'done') {
      setImportStep('Fertig')
      return {
        done: true,
        failed: false,
        status,
        step,
        msg,
        pct,
        error: err,
        assembly: asm,
        createdAt,
        updatedAt,
        startedAt,
        finishedAt
      }
    }
    if (status === 'failed') {
      setImportStep('Fehlgeschlagen')
      setImportError(String(j.error || 'SOLIDWORKS-Import fehlgeschlagen'))
      return {
        done: false,
        failed: true,
        status,
        step,
        msg,
        pct,
        error: err,
        assembly: asm,
        createdAt,
        updatedAt,
        startedAt,
        finishedAt
      }
    }
    return {
      done: false,
      failed: false,
      status,
      step,
      msg,
      pct,
      error: err,
      assembly: asm,
      createdAt,
      updatedAt,
      startedAt,
      finishedAt
    }
  }

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
    try {
      const resp = await api.get('/projects', { params })
      const list = (resp?.data || []) as Project[]
      setProjects(list)
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Fehler beim Laden'
      setProjectsError(String(msg))
    } finally {
      setProjectsLoading(false)
    }
  }

  const loadProjectsByAu = async (au: string) => {
    const q = (au || '').trim()
    if (!q) return
    try {
      await loadProjects({ au_nr: q })
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Projekt nicht gefunden'
      alert(String(msg))
    }
  }

  const loadProjectByArtikelNr = async (artikelNr: string) => {
    const q = (artikelNr || '').trim()
    if (!q) return null
    try {
      const resp = await api.get('/projects', { params: { artikel_nr: q } })
      const list = (resp?.data || []) as Project[]
      const p = list[0] || null
      return p
    } catch (e: any) {
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
    if (isImporting) return
    
    try {
      const au = (project.au_nr || '').trim()
      if (!au) {
        alert('Dieses Projekt hat keine AU-Nr. Bitte Projekt über AU laden oder AU-Nr ergänzen.')
        return
      }
      await openHugwawiPickerForAu(au)
    } catch (error: any) {
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
      const bomQuery = selectedBomId ? `?bom_id=${selectedBomId}` : ''
      const resp = await api.post(`/projects/${project.id}/sync-orders${bomQuery}`)
      alert('Bestellungen synchronisiert!')
      refetch()
    } catch (error: any) {
      alert('Fehler beim Synchronisieren: ' + error.message)
    }
  }

  const handleCreateDocuments = async () => {
    if (!project) return

    try {
      if (isCreatingDocuments) return
      setIsCreatingDocuments(true)
      setCreateDocumentsMessage('Dokumente werden erstellt…')
      const response = await api.post(`/projects/${project.id}/generate-documents-batch`)

      const generated_count =
        (response as any)?.data?.generated_count ??
        (Array.isArray((response as any)?.data?.generated) ? (response as any).data.generated.length : undefined)
      const failed_count =
        (response as any)?.data?.failed_count ??
        (Array.isArray((response as any)?.data?.failed) ? (response as any).data.failed.length : undefined)

      setCreateDocumentsMessage('Dokumente erstellt')
      alert(
        `Dokumente erstellt: ${generated_count ?? '-'} erfolgreich, ${failed_count ?? '-'} fehlgeschlagen`
      )
      refetch()
    } catch (error: any) {
      setCreateDocumentsMessage('Dokumenterstellung fehlgeschlagen')
      alert('Fehler beim Erstellen der Dokumente: ' + error.message)
    } finally {
      setIsCreatingDocuments(false)
    }
  }

  const handleCheckDocuments = async () => {
    if (!project) return
    if (isCheckingDocuments) return
    try {
      setIsCheckingDocuments(true)
      setCheckDocumentsMessage('Dokumente werden geprüft…')
      const response = await api.post(`/projects/${project.id}/check-documents-batch`)
      const { checked_articles, checked_documents, found_documents, failed_count } = response.data || {}
      setCheckDocumentsMessage('Dokumentprüfung abgeschlossen')
      alert(
        `Dokumentprüfung abgeschlossen:\n` +
          `Artikel geprüft: ${checked_articles ?? '-'}\n` +
          `Dokumente geprüft: ${checked_documents ?? '-'}\n` +
          `Gefunden: ${found_documents ?? '-'}\n` +
          `Fehler: ${failed_count ?? 0}`
      )
      refetch()
    } catch (error: any) {
      setCheckDocumentsMessage('Dokumentprüfung fehlgeschlagen')
      alert('Fehler bei der Dokumentprüfung: ' + (error.response?.data?.detail || error.message))
    } finally {
      setIsCheckingDocuments(false)
    }
  }

  const handlePrintPDFQueueMerged = () => {
    if (!project) return
    const apiBase = (api as any)?.defaults?.baseURL || 'http://localhost:8000/api'
    const url = `${apiBase}/projects/${project.id}/print-pdf-queue-merged`
    const win = window.open(url, '_blank')
    if (!win) window.location.assign(url)

    // After clicking "PDF drucken": mark all currently queued items (pdf_drucken="1" & pdf="x") as printed ("x")
    // so the grid turns green and the user sees the action was executed.
    ;(async () => {
      try {
        const queueResp = await api.get(`/projects/${project.id}/print-pdf-queue`)
        const items = (queueResp?.data?.items || []) as Array<{ article_id?: number }>
        const ids = items.map((it) => it.article_id).filter(Boolean) as number[]
        if (!ids.length) return
        await Promise.all(ids.map((id) => api.patch(`/articles/${id}/document-flags`, { pdf_drucken: 'x' })))
        refetch()
      } catch (e: any) {
      }
    })()
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
      // #region agent log
      _dbgLog('H1_START', 'frontend/src/App.tsx:handleStartImport', 'start_import_clicked', {
        auNr: auNr.trim(),
        assemblyPath: assemblyPath.trim()
      })
      // #endregion
      setPendingAuNr(auNr.trim())
      await openHugwawiPickerForAu(auNr.trim())
    } catch (error: any) {
      // #region agent log
      _dbgLog('H1_START', 'frontend/src/App.tsx:handleStartImport', 'start_import_error', {
        message: String(error?.message || ''),
        status: error?.response?.status,
        detail: error?.response?.data?.detail
      })
      // #endregion
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
      {isCheckingDocuments && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2100
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: 20,
              width: 420,
              maxWidth: '90vw',
              borderRadius: 8,
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Dokumente prüfen
            </div>
            <div style={{ marginBottom: 10, color: '#555' }}>
              {checkDocumentsMessage || 'Bitte warten…'}
            </div>
            <div style={{ height: 8, background: '#eee', borderRadius: 6, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: '70%',
                  background: '#4caf50',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
          </div>
        </div>
      )}
      {isCreatingDocuments && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2100
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: 20,
              width: 420,
              maxWidth: '90vw',
              borderRadius: 8,
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Dokumente erstellen
            </div>
            <div style={{ marginBottom: 10, color: '#555' }}>
              {createDocumentsMessage || 'Bitte warten…'}
            </div>
            <div style={{ height: 8, background: '#eee', borderRadius: 6, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: '70%',
                  background: '#4caf50',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
          </div>
        </div>
      )}
      {isImporting && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: 20,
              width: 420,
              maxWidth: '90vw',
              borderRadius: 8,
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Import läuft – bitte warten
            </div>
            <div style={{ marginBottom: 10, color: '#555' }}>
              {importStep || 'Import läuft...'}
            </div>
            <div style={{ height: 8, background: '#eee', borderRadius: 6, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width:
                    typeof importPercent === 'number'
                      ? `${Math.max(0, Math.min(100, importPercent))}%`
                      : importStep === 'BOM anlegen' ? '20%' :
                      importStep === 'BOM überschreiben' ? '30%' :
                      (importStep || '').startsWith('Job wird gestartet') ? '35%' :
                      (importStep || '').startsWith('Import läuft') ? '70%' :
                      importStep === 'Import überschreiben' ? '80%' :
                      importStep === 'Fertig' ? '100%' : '40%',
                  background: '#4caf50',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
          </div>
        </div>
      )}
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
                  isImporting ||
                  !selectedHugwawiKey ||
                  (selectedHugwawiKey === 'manual' && !manualArtikelNr.trim()) ||
                  (!project && !(pendingAuNr || auNr))
                }
                onClick={async () => {
                  if (!selectedHugwawiKey) {
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
                    // #region agent log
                    _dbgLog('H2_PICK', 'frontend/src/App.tsx:import_flow', 'picker_confirmed', {
                      selectedHugwawiKey,
                      manual: selectedHugwawiKey === 'manual',
                      auNr: (pendingAuNr || auNr || '').trim()
                    })
                    // #endregion
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
                      // #region agent log
                      _dbgLog('H3_BOM', 'frontend/src/App.tsx:import_flow', 'bom_create_error', {
                        status: e?.response?.status,
                        detail: e?.response?.data?.detail,
                        message: String(e?.message || '')
                      })
                      // #endregion
                      if (e?.response?.status === 409) {
                        const pw = prompt('Stückliste existiert bereits. Passwort zum Überschreiben (aktuell: 1):') || ''
                        if (!pw) return
                        setImportStep('BOM überschreiben')
                        try {
                          bomResp = await api.post(`/projects/${activeProject.id}/boms`, {
                            hugwawi_order_id: picked.hugwawi_order_id,
                            hugwawi_order_name: picked.hugwawi_order_name,
                            hugwawi_order_article_id: picked.hugwawi_order_article_id,
                            hugwawi_article_id: picked.hugwawi_article_id,
                            hugwawi_articlenumber: picked.hugwawi_articlenumber,
                            overwrite_password: pw
                          })
                        } catch (e2: any) {
                          throw e2
                        }
                      } else {
                        throw e
                      }
                    }

                    const bom = (bomResp?.data?.bom || null) as Bom | null
                    if (!bom || !bom.id) {
                      throw new Error('BOM konnte nicht erstellt werden (keine ID)')
                    }

                    setIsImporting(true)
                    setImportError(null)
                    setImportPercent(null)
                    setImportJobId(null)

                    const startJob = async (overwritePassword?: string) => {
                      const params: any = { assembly_filepath: path }
                      if (overwritePassword) params.overwrite_password = overwritePassword
                      const resp = await api.post(
                        `/projects/${activeProject.id}/boms/${bom.id}/import-solidworks-job`,
                        null,
                        { params }
                      )
                      const jobId = Number(resp?.data?.job_id)
                      if (!jobId) throw new Error('Import-Job konnte nicht gestartet werden (keine job_id)')
                      // #region agent log
                      _dbgLog('H4_JOB', 'frontend/src/App.tsx:startJob', 'job_started', {
                        jobId,
                        projectId: activeProject.id,
                        bomId: bom.id
                      })
                      // #endregion
                      return jobId
                    }

                    let jobId: number
                    try {
                      setImportStep('Job wird gestartet…')
                      jobId = await startJob()
                    } catch (e: any) {
                      if (e?.response?.status === 409) {
                        const pw = prompt('Import existiert bereits. Passwort zum Überschreiben (aktuell: 1):') || ''
                        if (!pw) {
                          setIsImporting(false)
                          return
                        }
                        setImportStep('Job wird gestartet (Überschreiben)…')
                        jobId = await startJob(pw)
                      } else {
                        throw e
                      }
                    }

                    setImportJobId(jobId)
                    setImportStep('Import läuft…')

                    await new Promise<void>((resolve, reject) => {
                      const intervalMs = 3000
                      const interval = window.setInterval(async () => {
                        try {
                          const r = await pollImportJob(jobId)
                          // #region agent log
                          _dbgLog('H5_POLL', 'frontend/src/App.tsx:pollImportJob', 'poll_status', {
                            jobId,
                            done: r.done,
                            failed: r.failed,
                            status: r.status,
                            step: r.step,
                            msg: r.msg,
                            pct: r.pct,
                            error: r.error,
                            assembly: r.assembly,
                            createdAt: r.createdAt,
                            updatedAt: r.updatedAt,
                            startedAt: r.startedAt,
                            finishedAt: r.finishedAt,
                            importStep
                          })
                          // #endregion
                          if (r.done) {
                            window.clearInterval(interval)
                            resolve()
                          } else if (r.failed) {
                            window.clearInterval(interval)
                            reject(new Error(importError || 'SOLIDWORKS-Import fehlgeschlagen'))
                          }
                        } catch (err: any) {
                          // transient network errors: keep polling
                          // #region agent log
                          _dbgLog('H5_POLL', 'frontend/src/App.tsx:pollImportJob', 'poll_error', {
                            jobId,
                            message: String(err?.message || '')
                          })
                          // #endregion
                        }
                      }, intervalMs)
                    })

                    setShowHugwawiPicker(false)
                    await refreshBoms(activeProject.id)
                    setSelectedBomId(bom.id)
                    setAuNr('')
                    refetch()
                    setImportStep('Fertig')
                    alert('Import erfolgreich!')
                    setIsImporting(false)
                  } catch (e: any) {
                    // #region agent log
                    _dbgLog('H6_FLOW', 'frontend/src/App.tsx:import_flow', 'import_flow_error', {
                      status: e?.response?.status,
                      detail: e?.response?.data?.detail,
                      message: String(e?.message || '')
                    })
                    // #endregion
                    setImportStep(null)
                    alert('Fehler: ' + (e?.response?.data?.detail || e?.message || String(e)))
                    setIsImporting(false)
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
            <button onClick={() => loadProjects()} disabled={projectsLoading}>
              {projectsLoading ? 'Lade...' : 'Projekte laden'}
            </button>
            <button onClick={() => loadProjectsByAu(projectsSearch)} disabled={!projectsSearch.trim()}>
              Projekte nach AU laden
            </button>
            {lastProjectId && (
              <button
                onClick={async () => {
                  const p = projects.find((x) => x.id === lastProjectId)
                  if (p) {
                    await openProject(p)
                  } else {
                    await loadProjects()
                    const again = projects.find((x) => x.id === lastProjectId)
                    if (again) {
                      await openProject(again)
                    } else {
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
                      typeof importPercent === 'number'
                        ? `${Math.max(0, Math.min(100, importPercent))}%`
                        : importStep === 'BOM anlegen' ? '20%' :
                        importStep === 'BOM überschreiben' ? '30%' :
                        (importStep || '').startsWith('Job wird gestartet') ? '35%' :
                        (importStep || '').startsWith('Import läuft') ? '70%' :
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
            isImporting={isImporting}
            isCheckingDocuments={isCheckingDocuments}
            isCreatingDocuments={isCreatingDocuments}
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
