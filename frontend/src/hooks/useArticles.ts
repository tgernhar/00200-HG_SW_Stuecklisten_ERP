/**
 * Custom Hook for Articles
 */
import { useState, useEffect } from 'react'
import api from '../services/api'
import { Article } from '../services/types'

export const useArticles = (projectId: number | null, bomId: number | null) => {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // #region agent log
  const _agentLog = (location: string, message: string, data: any) => {
    try {
      fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'import-missing',
          hypothesisId: 'FRONTEND_FILTER',
          location,
          message,
          data,
          timestamp: Date.now()
        })
      }).catch(() => {})
    } catch {}
  }
  // #endregion agent log

  const fetchArticles = async () => {
    if (!projectId) return

    setLoading(true)
    setError(null)
    try {
      const response = await api.get(`/projects/${projectId}/articles`, {
        params: bomId ? { bom_id: bomId } : undefined
      })
      const list = (response?.data || []) as Article[]
      setArticles(list)
      // #region agent log
      try {
        const hiddenCount = list.filter(a => (a as any)?.in_stueckliste_anzeigen === false).length
        const virtualCount = list.filter(a => String((a as any)?.sldasm_sldprt_pfad || '').toLowerCase().startsWith('virtual:')).length
        _agentLog('useArticles.ts:fetchArticles', 'response_counts', {
          projectId,
          bomId,
          total: list.length,
          hiddenCount,
          virtualCount
        })
      } catch {}
      // #endregion agent log
    } catch (err: any) {
      setError(err.message)
      // #region agent log
      _agentLog('useArticles.ts:fetchArticles', 'error', {
        projectId,
        bomId,
        message: err?.message
      })
      // #endregion agent log
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchArticles()
  }, [projectId, bomId])

  return { articles, loading, error, refetch: fetchArticles }
}
