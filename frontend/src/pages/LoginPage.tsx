/**
 * Login Page
 * Design based on HUGWAWI login page screenshot
 */
import React, { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Logo from '../components/Logo'

// Inline styles to match the HUGWAWI login design
const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '20px'
  },
  logo: {
    marginBottom: '60px'
  },
  logoImage: {
    height: '60px',
    width: 'auto'
  },
  formContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-start',
    marginLeft: '150px',
    marginTop: '40px'
  },
  title: {
    color: '#003366',
    fontSize: '18px',
    fontWeight: 'normal' as const,
    marginBottom: '40px',
    fontFamily: 'Arial, sans-serif'
  },
  formGroup: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '10px'
  },
  label: {
    width: '80px',
    textAlign: 'right' as const,
    marginRight: '10px',
    fontSize: '14px',
    fontFamily: 'Arial, sans-serif',
    color: '#000000'
  },
  input: {
    width: '200px',
    height: '24px',
    border: '1px solid #999999',
    padding: '2px 5px',
    fontSize: '14px',
    fontFamily: 'Arial, sans-serif'
  },
  buttonContainer: {
    marginLeft: '90px',
    marginTop: '30px'
  },
  button: {
    padding: '4px 20px',
    fontSize: '14px',
    fontFamily: 'Arial, sans-serif',
    backgroundColor: '#f0f0f0',
    border: '1px solid #999999',
    cursor: 'pointer'
  },
  buttonHover: {
    backgroundColor: '#e0e0e0'
  },
  error: {
    color: '#cc0000',
    fontSize: '14px',
    marginTop: '20px',
    marginLeft: '90px'
  }
}

export default function LoginPage() {
  const [loginname, setLoginname] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [buttonHover, setButtonHover] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!loginname.trim()) {
      setError('Bitte geben Sie Ihren Benutzernamen ein.')
      return
    }

    if (!password) {
      setError('Bitte geben Sie Ihr Passwort ein.')
      return
    }

    setIsLoading(true)

    try {
      await login(loginname.trim(), password)
      navigate('/menu')
    } catch (err: any) {
      setError(err.message || 'Login fehlgeschlagen')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      {/* Logo */}
      <div style={styles.logo}>
        <Logo height={60} showText={true} />
      </div>

      {/* Login Form */}
      <div style={styles.formContainer}>
        <h1 style={styles.title}>Login</h1>

        <form onSubmit={handleSubmit}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Name:</label>
            <input
              type="text"
              value={loginname}
              onChange={(e) => setLoginname(e.target.value)}
              style={styles.input}
              disabled={isLoading}
              autoFocus
              autoComplete="username"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Password:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>

          <div style={styles.buttonContainer}>
            <button
              type="submit"
              disabled={isLoading}
              style={{
                ...styles.button,
                ...(buttonHover ? styles.buttonHover : {})
              }}
              onMouseEnter={() => setButtonHover(true)}
              onMouseLeave={() => setButtonHover(false)}
            >
              {isLoading ? 'Anmelden...' : 'Login'}
            </button>
          </div>

          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
