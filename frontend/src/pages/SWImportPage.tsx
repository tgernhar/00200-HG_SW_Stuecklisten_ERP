/**
 * SW Import Page
 * This is the original App component content, now as a routed page
 */
import React, { useEffect, useState } from 'react'
import { ProjectHeader } from '../components/ProjectHeader'
import { ArticleGrid } from '../components/ArticleGrid'
import { OrdersDrawer } from '../components/OrdersDrawer'
import { useArticles } from '../hooks/useArticles'
import api from '../services/api'
import { Bom, HugwawiBestellartikelTemplate, HugwawiOrderArticleItem, Project, Article } from '../services/types'

export default function SWImportPage() {
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
  const [isLoadingArticles, setIsLoadingArticles] = useState(false)
  const [loadArticlesMessage, setLoadArticlesMessage] = useState<string | null>(null)
  const [hugwawiData, setHugwawiData] = useState<Record<number, Record<string, any>>>({})
  const [articleDiffs, setArticleDiffs] = useState<Record<number, Record<string, string>>>({})
  const [resolvedFromHugwawi, setResolvedFromHugwawi] = useState<Record<number, Record<string, boolean>>>({})
  const [resolvedKeepFrontend, setResolvedKeepFrontend] = useState<Record<number, Record<string, boolean>>>({})

  // Optional debug logger (no-op). Keep signature flexible so callsites don't break typechecking.
  const _log = (..._args: any[]) => {}
  const _dbgLog = (..._args: any[]) => {}

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

  const handleLoadArticles = async () => {
    if (!project) return
    if (isLoadingArticles) return

    try {
      setIsLoadingArticles(true)
      setLoadArticlesMessage('Artikel werden geladen...')

      const resp = await api.post(`/projects/${project.id}/load-articles?auto_fill=true`)
      const data = resp?.data || {}

      setHugwawiData(data.hugwawi_data || {})
      setArticleDiffs(data.diffs || {})
      setResolvedFromHugwawi({})
      setResolvedKeepFrontend({})

      const syncResult = data.sync_result || {}
      const autoFilled = data.auto_filled || {}
      const autoFilledCount = Object.keys(autoFilled).length

      setLoadArticlesMessage('Artikel geladen')

      await refetch()

      const diffCount = Object.keys(data.diffs || {}).length
      const newExtendedCount = data.new_extended_articles || 0
      const extendedDetails = data.extended_details || {}
      
      let message = `Artikel geladen:\n` +
        `- ${syncResult.total_checked || 0} Artikelnummern geprüft\n` +
        `- ${syncResult.exists_count || 0} im ERP vorhanden\n` +
        `- ${syncResult.not_exists_count || 0} fehlen im ERP\n` +
        `- ${data.hugwawi_found || 0} HUGWAWI-Datensätze gefunden\n`

      if (autoFilledCount > 0) {
        message += `- ${autoFilledCount} Artikel automatisch aus HUGWAWI befüllt\n`
      }
      if (newExtendedCount > 0) {
        message += `- ${newExtendedCount} erweiterte Artikel aus HUGWAWI eingefügt\n`
        const parentCount = Object.keys(extendedDetails).length
        if (parentCount > 0) {
          message += `  (für ${parentCount} Basis-Artikel mit "_" Erweiterungen)\n`
        }
      }
      if (diffCount > 0) {
        message += `- ${diffCount} Artikel mit Differenzen (gelb/rot markiert)`
      }

      alert(message)
    } catch (error: any) {
      setLoadArticlesMessage('Fehler beim Laden')
      alert('Fehler beim Artikel laden: ' + (error.response?.data?.detail || error.message))
    } finally {
      setIsLoadingArticles(false)
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
      await new Promise(resolve => setTimeout(resolve, 100))
      try {
        await refetch()
      } catch (refetchError: any) {
        console.warn('Refetch nach Dokumentprüfung fehlgeschlagen:', refetchError)
      }
      alert(
        `Dokumentprüfung abgeschlossen:\n` +
          `Artikel geprüft: ${checked_articles ?? '-'}\n` +
          `Dokumente geprüft: ${checked_documents ?? '-'}\n` +
          `Gefunden: ${found_documents ?? '-'}\n` +
          `Fehler: ${failed_count ?? 0}`
      )
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
        const selected = selectedArticles || []
        const selectedIds = selected.map(a => a.id).filter(Boolean) as number[]
        const validPattern = /^\d{6}-/
        const selectedValidIds = selected
          .filter((a) => validPattern.test(String((a as any)?.hg_artikelnummer || '').trim()))
          .map((a) => a.id)
          .filter(Boolean) as number[]
        const params: any = {}
        if (selectedIds.length) {
          const ok = window.confirm(
            `Es sind ${selectedIds.length} Artikel ausgewählt. Nur die Auswahl exportieren?\n` +
              `Hinweis: Exportiert werden nur Artikel, die noch nicht in HUGWAWI vorhanden sind.`
          )
          if (!ok) return
          if (!selectedValidIds.length) {
            alert('Keine gültigen Artikelnummern in der Auswahl (Format: 6 Ziffern + "-").')
            return
          }
          params.article_ids = selectedValidIds.join(',')
        }

        const res = await api.get(`/projects/${project.id}/export-hugwawi-articles-csv`, {
          params,
          responseType: 'blob'
        } as any)

        const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' })

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

      return
    } catch (error: any) {
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
      setAssemblyPath(file.name)
    }
  }

  const handleStartImport = async () => {
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
      let errorMessage = 'Unbekannter Fehler'
      if (error.response?.data) {
        errorMessage = error.response.data.detail || error.response.data.message || JSON.stringify(error.response.data)
      } else {
        errorMessage = error.message || 'Unbekannter Fehler'
      }
      setImportError(`Fehler beim Import: ${errorMessage}`)
    } finally {
      setIsImporting(false)
    }
  }

  // The full JSX from original App.tsx (project selection, import modals, article grid, etc.)
  // This is a simplified version - full implementation would include all the modal dialogs
  
  return (
    <div className="sw-import-page" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {isCheckingDocuments && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100 }}>
          <div style={{ background: '#fff', padding: 20, width: 420, maxWidth: '90vw', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Dokumente prüfen</div>
            <div style={{ marginBottom: 10, color: '#555' }}>{checkDocumentsMessage || 'Bitte warten…'}</div>
            <div style={{ height: 8, background: '#eee', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: '70%', background: '#4caf50', transition: 'width 0.3s ease' }} />
            </div>
          </div>
        </div>
      )}
      
      {isCreatingDocuments && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100 }}>
          <div style={{ background: '#fff', padding: 20, width: 420, maxWidth: '90vw', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Dokumente erstellen</div>
            <div style={{ marginBottom: 10, color: '#555' }}>{createDocumentsMessage || 'Bitte warten…'}</div>
            <div style={{ height: 8, background: '#eee', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: '70%', background: '#4caf50', transition: 'width 0.3s ease' }} />
            </div>
          </div>
        </div>
      )}

      {isLoadingArticles && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100 }}>
          <div style={{ background: '#fff', padding: 20, width: 420, maxWidth: '90vw', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Artikel laden</div>
            <div style={{ marginBottom: 10, color: '#555' }}>{loadArticlesMessage || 'Bitte warten…'}</div>
            <div style={{ height: 8, background: '#eee', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: '70%', background: '#4caf50', transition: 'width 0.3s ease' }} />
            </div>
          </div>
        </div>
      )}

      {isImporting && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: '#fff', padding: 20, width: 420, maxWidth: '90vw', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Import läuft – bitte warten</div>
            <div style={{ marginBottom: 10, color: '#555' }}>{importStep || 'Import läuft...'}</div>
            <div style={{ height: 8, background: '#eee', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: typeof importPercent === 'number' ? `${Math.max(0, Math.min(100, importPercent))}%` : '40%',
                background: '#4caf50',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
        </div>
      )}

      {showHugwawiPicker && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
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
                  <input type="radio" name="hugwawiPick" checked={selectedHugwawiKey === 'manual'} onChange={() => setSelectedHugwawiKey('manual')} />
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
                  return (it.hugwawi_articlenumber || '').toLowerCase().includes(q) || (it.hugwawi_description || '').toLowerCase().includes(q)
                })
                .map((it) => {
                  const key = `${it.hugwawi_order_id}:${it.hugwawi_order_article_id}`
                  return (
                    <label key={key} style={{ display: 'flex', gap: 10, padding: '8px 10px', borderBottom: '1px solid #eee', cursor: 'pointer' }}>
                      <input type="radio" name="hugwawiPick" checked={selectedHugwawiKey === key} onChange={() => setSelectedHugwawiKey(key)} />
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
              <button style={{ fontWeight: 700 }} disabled={isImporting || !selectedHugwawiKey || (selectedHugwawiKey === 'manual' && !manualArtikelNr.trim())}>
                Import starten
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
          </div>
          {projectsError && <div style={{ color: 'red', marginBottom: '8px' }}>{projectsError}</div>}
          <div style={{ maxHeight: '200px', overflow: 'auto', border: '1px solid #eee', borderRadius: 4, marginBottom: '20px' }}>
            {(projects || [])
              .filter((p) => {
                const q = projectsSearch.toLowerCase().trim()
                if (!q) return true
                return (p.au_nr || '').toLowerCase().includes(q) || (p.artikel_nr || '').toLowerCase().includes(q)
              })
              .map((p) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderBottom: '1px solid #f0f0f0' }}>
                  <span>
                    <strong>{p.artikel_nr}</strong>
                    {p.au_nr ? `  · AU ${p.au_nr}` : ''}
                  </span>
                  <button onClick={async () => { await openProject(p) }}>Öffnen</button>
                </div>
              ))}
          </div>
          <h2 style={{ marginBottom: '30px' }}>Neues Projekt importieren</h2>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Auftragsnummer:</label>
            <input
              type="text"
              value={auNr}
              onChange={(e) => setAuNr(e.target.value)}
              placeholder="z.B. AU-2024-001"
              style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #ccc', borderRadius: '4px' }}
              disabled={isImporting}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>SolidWorks Assembly-Pfad:</label>
            <input
              type="text"
              value={assemblyPath}
              onChange={(e) => setAssemblyPath(e.target.value)}
              placeholder="z.B. C:\Projekte\Assembly.sldasm"
              style={{ width: '100%', padding: '10px', fontSize: '16px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '10px' }}
              disabled={isImporting}
            />
          </div>

          {importError && (
            <div style={{ padding: '12px', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '4px', color: '#c00', marginBottom: '20px' }}>
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
            isLoadingArticles={isLoadingArticles}
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
            onLoadArticles={handleLoadArticles}
            onSyncOrders={handleSyncOrders}
            onCreateDocuments={handleCreateDocuments}
            onCheckDocuments={handleCheckDocuments}
            onPrintPDFQueueMerged={handlePrintPDFQueueMerged}
            onExport={handleExport}
          />
          <div style={{ flex: 1, width: '100%', overflow: 'hidden' }}>
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
                hugwawiData={hugwawiData}
                articleDiffs={articleDiffs}
                resolvedFromHugwawi={resolvedFromHugwawi}
                resolvedKeepFrontend={resolvedKeepFrontend}
                onCellValueChanged={handleCellValueChanged}
                onOpenOrders={handleOpenOrders}
                onSelectionChanged={(sel) => setSelectedArticles(sel)}
                onAfterBulkUpdate={() => refetch()}
                onDiffResolved={(articleId, field, usedHugwawi) => {
                  setArticleDiffs(prev => {
                    const updated = { ...prev }
                    if (updated[articleId]) {
                      const { [field]: _, ...rest } = updated[articleId]
                      if (Object.keys(rest).length === 0) {
                        delete updated[articleId]
                      } else {
                        updated[articleId] = rest
                      }
                    }
                    return updated
                  })
                  if (usedHugwawi) {
                    setResolvedFromHugwawi(prev => ({
                      ...prev,
                      [articleId]: { ...(prev[articleId] || {}), [field]: true }
                    }))
                  } else {
                    setResolvedKeepFrontend(prev => ({
                      ...prev,
                      [articleId]: { ...(prev[articleId] || {}), [field]: true }
                    }))
                  }
                }}
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
