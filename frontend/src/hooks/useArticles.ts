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

  const fetchArticles = async () => {
    if (!projectId) return

    setLoading(true)
    setError(null)
    try {
      // Cache-Busting: Füge Timestamp hinzu, um sicherzustellen, dass die Daten neu geladen werden
      const response = await api.get(`/projects/${projectId}/articles`, {
        params: {
          ...(bomId ? { bom_id: bomId } : {}),
          _t: Date.now() // Cache-Busting Parameter
        }
      })
      const list = (response?.data || []) as Article[]
      setArticles(list)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchArticles()
  }, [projectId, bomId])

  return { articles, loading, error, refetch: fetchArticles }
}
