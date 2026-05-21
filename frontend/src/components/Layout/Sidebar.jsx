import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const MODULOS = [
  {
    label: 'Principal',
    items: [
      { to: '/',              icon: '◼',  label: 'Dashboard' },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { to: '/entidades',     icon: '👥', label: 'Entidades' },
      { to: '/cotizaciones',  icon: '📋', label: 'Cotizaciones' },
      { to: '/proyectos',     icon: '🏗️', label: 'Proyectos' },
      { to: '/ordenes',       icon: '🔧', label: 'Órdenes de trabajo' },
      { to: '/mantenimiento', icon: '🛠️', label: 'Mantenimiento' },
    ],
  },
  {
    label: 'Administración',
    items: [
      { to: '/finanzas',      icon: '💰', label: 'Finanzas' },
      { to: '/productos',     icon: '📦', label: 'Productos' },
      { to: '/catalogos',     icon: '📂', label: 'Catálogos' },
      { to: '/usuarios',      icon: '🔑', label: 'Usuarios' },
      { to: '/roles',         icon: '🛡️', label: 'Roles y Permisos' },
      { to: '/auditoria',     icon: '📋', label: 'Auditoría' },
    ],
  },
]

export default function Sidebar({ onClose }) {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  function handleNavClick() {
    if (window.innerWidth <= 768) onClose()
  }

  const iniciales = usuario?.username
    ? usuario.username.slice(0, 2).toUpperCase()
    : '?'

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h2>Servi<span>Control</span></h2>
        <p>Seguridad Electrónica</p>
      </div>

      <nav className="sidebar-nav">
        {MODULOS.map(grupo => (
          <div key={grupo.label} className="sidebar-section">
            <div className="sidebar-section-label">{grupo.label}</div>
            {grupo.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `nav-item ${isActive ? 'active' : ''}`
                }
                onClick={handleNavClick}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="avatar">{iniciales}</div>
          <div className="sidebar-user-info">
            <strong>{usuario?.username || '—'}</strong>
            <span>{usuario?.rol || '—'}</span>
          </div>
          <button className="btn-logout" onClick={handleLogout} title="Cerrar sesión">
            ⏻
          </button>
        </div>
      </div>
    </aside>
  )
}
