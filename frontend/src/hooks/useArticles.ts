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
  const _log = (location: string, message: string, data: any) => {
    try {
      fetch('http://127.0.0.1:7244/ingest/5fe19d44-ce12-4ffb-b5ca-9a8d2d1f2e70', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'run4',
          hypothesisId: 'FETCH',
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
      // #region agent log
      _log('useArticles.ts:fetchArticles', 'request', { projectId, bomId })
      // #endregion agent log
      const response = await api.get(`/projects/${projectId}/articles`, {
        params: bomId ? { bom_id: bomId } : undefined
      })
      // #region agent log
      _log('useArticles.ts:fetchArticles', 'response', {
        projectId,
        bomId,
        status: response?.status,
        isArray: Array.isArray(response?.data),
        length: Array.isArray(response?.data) ? response.data.length : null
      })
      // #endregion agent log
      setArticles(response.data)
    } catch (err: any) {
      setError(err.message)
      // #region agent log
      _log('useArticles.ts:fetchArticles', 'error', {
        projectId,
        bomId,
        message: err?.message,
        status: err?.response?.status,
        detail: err?.response?.data?.detail
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
