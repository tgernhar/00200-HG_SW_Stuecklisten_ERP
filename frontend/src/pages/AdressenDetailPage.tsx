/**
 * AdressenDetailPage
 * Shows the detail view of an address.
 */
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdressenDetailView from '../components/adressen/AdressenDetailView'
import { getAddressDetail, AddressDetailItem } from '../services/adressenApi'

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'auto',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    fontSize: '14px',
    color: '#666',
  },
  error: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '12px',
  },
  errorText: {
    fontSize: '14px',
    color: '#c00',
  },
  errorBackButton: {
    padding: '6px 12px',
    backgroundColor: '#f0f0f0',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
}

export default function AdressenDetailPage() {
  const { addressId } = useParams<{ addressId: string }>()
  const navigate = useNavigate()

  const [address, setAddress] = useState<AddressDetailItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (addressId) {
      loadAddress(parseInt(addressId))
    }
  }, [addressId])

  const loadAddress = async (id: number) => {
    setLoading(true)
    setError(null)
    try {
      const data = await getAddressDetail(id)
      setAddress(data)
    } catch (err: any) {
      console.error('Error loading address detail:', err)
      setError(err.response?.data?.detail || 'Fehler beim Laden der Adressdaten')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    navigate('/menu/adressen/liste')
  }

  return (
    <div style={styles.container}>
      {loading ? (
        <div style={styles.loading}>Lade Adressdaten...</div>
      ) : error ? (
        <div style={styles.error}>
          <span style={styles.errorText}>{error}</span>
          <button style={styles.errorBackButton} onClick={handleBack}>
            Zurück zur Liste
          </button>
        </div>
      ) : address ? (
        <AdressenDetailView address={address} />
      ) : null}
    </div>
  )
}
