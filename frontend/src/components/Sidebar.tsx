/**
 * Sidebar Navigation Component
 * Based on HUGWAWI menu structure
 */
import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface MenuItem {
  id: string
  label: string
  path?: string
  children?: MenuItem[]
}

const menuItems: MenuItem[] = [
  {
    id: 'willkommen',
    label: 'Willkommen',
    path: '/menu'
  },
  {
    id: 'stuecklisten',
    label: 'Stücklisten',
    children: [
      {
        id: 'sw-import',
        label: 'SW_Stücklistenimport',
        path: '/menu/stuecklisten/sw-import'
      }
    ]
  },
  {
    id: 'fertigungsplanung',
    label: 'Fertigungsplanung',
    children: [
      {
        id: 'auftraege',
        label: 'Auftragsübersicht',
        path: '/menu/fertigungsplanung/auftraege'
      }
    ]
  },
  {
    id: 'produktionsplanung',
    label: 'Produktionsplanung',
    children: [
      {
        id: 'planboard',
        label: 'Planboard',
        path: '/menu/produktionsplanung/planboard'
      },
      {
        id: 'todo-liste',
        label: 'Auftrags-ToDos',
        path: '/menu/produktionsplanung/todos'
      }
    ]
  },
  {
    id: 'crm',
    label: 'CRM',
    children: [
      {
        id: 'crm-dashboard',
        label: 'Dashboard',
        path: '/menu/crm/dashboard'
      },
      {
        id: 'crm-timeline',
        label: 'Vorgangsakte',
        path: '/menu/crm/timeline'
      },
      {
        id: 'crm-leads',
        label: 'Lead-Pipeline',
        path: '/menu/crm/leads'
      },
      {
        id: 'crm-tasks',
        label: 'Aufgaben',
        path: '/menu/crm/tasks'
      },
      {
        id: 'crm-search',
        label: 'Suche',
        path: '/menu/crm/search'
      }
    ]
  },
  {
    id: 'auftragsdaten',
    label: 'Auftragsdaten',
    children: [
      {
        id: 'auftragsdaten-gesamtliste',
        label: 'GesamtListe',
        path: '/menu/auftragsdaten/gesamtliste'
      },
      {
        id: 'auftragsdaten-auftraege',
        label: 'Aufträge',
        path: '/menu/auftragsdaten/auftraege'
      },
      {
        id: 'auftragsdaten-angebote',
        label: 'Angebote',
        path: '/menu/auftragsdaten/angebote'
      },
      {
        id: 'auftragsdaten-bestellungen',
        label: 'Bestellungen',
        path: '/menu/auftragsdaten/bestellungen'
      },
      {
        id: 'auftragsdaten-beistellungen',
        label: 'Beistellungen',
        path: '/menu/auftragsdaten/beistellungen'
      }
    ]
  },
  {
    id: 'artikel',
    label: 'Artikel',
    children: [
      {
        id: 'artikel-liste',
        label: 'Artikel',
        path: '/menu/artikel/liste'
      },
      {
        id: 'artikel-warengruppen',
        label: 'Warengruppen',
        path: '/menu/artikel/warengruppen'
      }
    ]
  },
  {
    id: 'adressen',
    label: 'Adressen',
    children: [
      {
        id: 'adressen-liste',
        label: 'Liste',
        path: '/menu/adressen/liste'
      }
    ]
  },
  {
    id: 'dms',
    label: 'DMS',
    children: [
      {
        id: 'dms-paperless',
        label: 'Paperless',
        path: '/menu/dms/paperless'
      }
    ]
  },
  {
    id: 'administration',
    label: 'Administration',
    children: [
      {
        id: 'pps-config',
        label: 'Produktionsplanung_Config',
        path: '/menu/administration/pps-config'
      }
    ]
  }
]

const styles = {
  sidebar: {
    width: '180px',
    backgroundColor: '#f5f5f5',
    borderRight: '1px solid #cccccc',
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    fontFamily: 'Arial, sans-serif',
    fontSize: '13px'
  },
  menuSection: {
    borderBottom: '1px solid #dddddd'
  },
  menuItem: {
    padding: '8px 12px',
    cursor: 'pointer',
    backgroundColor: 'transparent',
    borderBottom: '1px solid #eeeeee',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    userSelect: 'none' as const
  },
  menuItemHover: {
    backgroundColor: '#e8e8e8'
  },
  menuItemActive: {
    backgroundColor: '#d0d0d0',
    fontWeight: 'bold' as const
  },
  menuItemExpanded: {
    backgroundColor: '#e0e0e0'
  },
  subMenu: {
    backgroundColor: '#ffffff',
    borderLeft: '3px solid #cccccc',
    marginLeft: '10px'
  },
  subMenuItem: {
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: '12px',
    color: '#333333'
  },
  subMenuItemHover: {
    backgroundColor: '#f0f0f0'
  },
  subMenuItemActive: {
    backgroundColor: '#e0e8f0',
    fontWeight: 'bold' as const
  },
  expandIcon: {
    fontSize: '10px',
    color: '#666666'
  },
  logoutSection: {
    marginTop: 'auto',
    borderTop: '1px solid #cccccc'
  },
  logoutButton: {
    padding: '10px 12px',
    cursor: 'pointer',
    backgroundColor: 'transparent',
    color: '#333333',
    width: '100%',
    textAlign: 'left' as const,
    border: 'none',
    fontSize: '13px',
    fontFamily: 'Arial, sans-serif'
  }
}

export default function Sidebar() {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['stuecklisten', 'fertigungsplanung', 'produktionsplanung', 'crm', 'auftragsdaten', 'artikel', 'adressen', 'dms']))
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  
  const navigate = useNavigate()
  const location = useLocation()
  const { logout } = useAuth()

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleClick = (item: MenuItem) => {
    if (item.children) {
      toggleExpand(item.id)
    } else if (item.path) {
      navigate(item.path)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const isActive = (path?: string) => {
    if (!path) return false
    return location.pathname === path
  }

  const isParentActive = (item: MenuItem) => {
    if (!item.children) return false
    return item.children.some(child => isActive(child.path))
  }

  const renderMenuItem = (item: MenuItem, isSubItem: boolean = false) => {
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedItems.has(item.id)
    const active = isActive(item.path) || isParentActive(item)
    const isHovered = hoveredItem === item.id

    const itemStyle = {
      ...(isSubItem ? styles.subMenuItem : styles.menuItem),
      ...(isHovered ? (isSubItem ? styles.subMenuItemHover : styles.menuItemHover) : {}),
      ...(active ? (isSubItem ? styles.subMenuItemActive : styles.menuItemActive) : {}),
      ...(hasChildren && isExpanded && !isSubItem ? styles.menuItemExpanded : {})
    }

    return (
      <div key={item.id}>
        <div
          style={itemStyle}
          onClick={() => handleClick(item)}
          onMouseEnter={() => setHoveredItem(item.id)}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <span>{item.label}</span>
          {hasChildren && (
            <span style={styles.expandIcon}>
              {isExpanded ? '▼' : '►'}
            </span>
          )}
        </div>
        
        {hasChildren && isExpanded && (
          <div style={styles.subMenu}>
            {item.children!.map(child => renderMenuItem(child, true))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={styles.sidebar}>
      <div style={styles.menuSection}>
        {menuItems.map(item => renderMenuItem(item))}
      </div>
      
      <div style={styles.logoutSection}>
        <button
          style={styles.logoutButton}
          onClick={handleLogout}
          onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#e8e8e8'}
          onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
        >
          Ausloggen
        </button>
      </div>
    </div>
  )
}
