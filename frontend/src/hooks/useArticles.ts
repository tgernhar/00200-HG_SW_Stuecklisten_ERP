/**
 * Custom Hook for Articles
 */
import { useState, useEffect } from 'react'
import api from '../services/api'
import { Article } from '../services/types'

export const useArticles = (projectId: number | null) => {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchArticles = async () => {
    if (!projectId) return

    setLoading(true)
    setError(null)
    try {
      const response = await api.get(`/projects/${projectId}/articles`)
      setArticles(response.data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchArticles()
  }, [projectId])

  return { articles, loading, error, refetch: fetchArticles }
}
