import { useState, useEffect } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard, Users, FileText, Building2, Wrench, Hammer,
  Wallet, BookOpen, UserCog, Package, Bell, ClipboardList,
  List, MapPin, Settings, CalendarCheck, AlertTriangle,
  DollarSign, BarChart3, FolderOpen, ShieldCheck, Box, Tag,
  Truck, Download, ChevronDown, LogOut,
} from 'lucide-react'

// Cada item puede declarar `permisos: [...]` (OR-lógico).
// Si no declara permisos, se muestra siempre (ej: Dashboard, Perfil, Notificaciones).
const MENU = [
  {
    section: null,
    items: [
      { to: '/', icon: <LayoutDashboard size={16} />, label: 'Dashboard', exact: true },
    ],
  },
  {
    section: 'COMERCIAL',
    items: [
      {
        id: 'clientes', icon: <Users size={16} />, label: 'Clientes',
        paths: ['/clientes'],
        permisos: ['ver_clientes'],
        children: [
          { to: '/clientes',                  icon: <List size={13} />,    label: 'Clientes',         permisos: ['ver_clientes'] },
          { to: '/clientes/establecimientos', icon: <MapPin size={13} />,  label: 'Establecimientos', permisos: ['ver_clientes'] },
          { to: '/clientes/sistemas',         icon: <Settings size={13} />, label: 'Sistemas instalados', permisos: ['ver_clientes'] },
        ],
      },
      { to: '/cotizaciones', icon: <FileText size={16} />, label: 'Cotizaciones', permisos: ['ver_cotizaciones'] },
    ],
  },
  {
    section: 'OPERACIONES',
    items: [
      { to: '/proyectos', icon: <Building2 size={16} />, label: 'Proyectos',          permisos: ['ver_proyectos'] },
      { to: '/ordenes',   icon: <Wrench size={16} />,   label: 'Órdenes de trabajo',  permisos: ['ver_ordenes'] },
      {
        id: 'mantenimiento', icon: <Hammer size={16} />, label: 'Mantenimiento',
        paths: ['/mantenimiento'],
        permisos: ['ver_mantenimientos', 'gestionar_mantenimientos'],
        children: [
          { to: '/mantenimiento',         icon: <CalendarCheck size={13} />,  label: 'Programados',        permisos: ['ver_mantenimientos'] },
          { to: '/mantenimiento/alertas', icon: <AlertTriangle size={13} />,  label: 'Alertas pendientes', permisos: ['ver_mantenimientos'] },
        ],
      },
    ],
  },
  {
    section: 'FINANZAS',
    items: [
      {
        id: 'finanzas', icon: <Wallet size={16} />, label: 'Finanzas',
        paths: ['/finanzas'],
        permisos: ['ver_finanzas', 'gestionar_finanzas'],
        children: [
          { to: '/finanzas/pago',    icon: <DollarSign size={13} />, label: 'Registrar pago',     permisos: ['gestionar_finanzas'] },
          { to: '/finanzas/cuentas', icon: <List size={13} />,       label: 'Cuentas por cobrar', permisos: ['ver_finanzas'] },
          { to: '/finanzas/reporte', icon: <BarChart3 size={13} />,  label: 'Reporte financiero', permisos: ['ver_finanzas'] },
        ],
      },
    ],
  },
  {
    section: 'REGISTROS',
    items: [
      {
        id: 'bitacoras', icon: <BookOpen size={16} />, label: 'Bitácoras',
        paths: ['/bitacoras'],
        permisos: ['ver_clientes', 'ver_proyectos'],
        children: [
          { to: '/bitacoras/cliente',    icon: <List size={13} />,      label: 'Por cliente',         permisos: ['ver_clientes'] },
          { to: '/bitacoras/proyecto',   icon: <List size={13} />,      label: 'Por proyecto',        permisos: ['ver_proyectos'] },
          { to: '/bitacoras/documentos', icon: <FolderOpen size={13} />, label: 'Documentos adjuntos', permisos: ['ver_clientes', 'ver_proyectos'] },
        ],
      },
    ],
  },
  {
    section: 'CONFIGURACIÓN',
    items: [
      {
        id: 'personal', icon: <UserCog size={16} />, label: 'Personal',
        paths: ['/personal'],
        permisos: ['gestionar_empleados', 'gestionar_usuarios', 'gestionar_roles'],
        children: [
          { to: '/personal/empleados', icon: <List size={13} />,        label: 'Empleados',          permisos: ['gestionar_empleados'] },
          { to: '/personal/usuarios',  icon: <Settings size={13} />,    label: 'Usuarios y accesos', permisos: ['gestionar_usuarios'] },
          { to: '/personal/roles',     icon: <ShieldCheck size={13} />, label: 'Roles y permisos',   permisos: ['gestionar_roles'] },
        ],
      },
      {
        id: 'catalogo', icon: <Package size={16} />, label: 'Catálogo',
        paths: ['/catalogo'],
        permisos: ['gestionar_catalogo'],
        children: [
          { to: '/catalogo/productos',   icon: <Box size={13} />,   label: 'Productos',   permisos: ['gestionar_catalogo'] },
          { to: '/catalogo/categorias',  icon: <Tag size={13} />,   label: 'Categorías',  permisos: ['gestionar_catalogo'] },
          { to: '/catalogo/proveedores', icon: <Truck size={13} />, label: 'Proveedores', permisos: ['gestionar_catalogo'] },
          { to: '/catalogo/servicios',   icon: <List size={13} />,  label: 'Servicios',   permisos: ['gestionar_catalogo'] },
        ],
      },
    ],
  },
  {
    section: 'SISTEMA',
    items: [
      { to: '/notificaciones', icon: <Bell size={16} />, label: 'Notificaciones' },
      {
        id: 'auditoria', icon: <ClipboardList size={16} />, label: 'Auditoría',
        paths: ['/auditoria'],
        permisos: ['gestionar_usuarios'],
        children: [
          { to: '/auditoria',          icon: <List size={13} />,      label: 'Log del sistema',      permisos: ['gestionar_usuarios'] },
          { to: '/auditoria/exportar', icon: <Download size={13} />,  label: 'Exportar log',         permisos: ['gestionar_usuarios'] },
          { to: '/auditoria/reporte',  icon: <BarChart3 size={13} />, label: 'Reporte de actividad', permisos: ['gestionar_usuarios'] },
        ],
      },
    ],
  },
]

function gruposActivosPorRuta(pathname) {
  const abiertos = {}
  MENU.forEach(sec => {
    sec.items?.forEach(item => {
      if (item.paths?.some(p => pathname === p || pathname.startsWith(p + '/'))) {
        abiertos[item.id] = true
      }
    })
  })
  return abiertos
}

export default function Sidebar({ onClose }) {
  const { usuario, logout, puedeAlguno } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [abiertos, setAbiertos] = useState(() => gruposActivosPorRuta(location.pathname))

  useEffect(() => {
    setAbiertos(prev => ({ ...prev, ...gruposActivosPorRuta(location.pathname) }))
  }, [location.pathname])

  function toggleGrupo(id) {
    setAbiertos(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function handleNavClick() {
    if (window.innerWidth <= 768) onClose()
  }

  function handleLogout(e) {
    e.stopPropagation()
    logout()
    navigate('/login')
  }

  const iniciales = usuario?.username
    ? usuario.username.slice(0, 2).toUpperCase()
    : '?'

  function visible(item) {
    if (!item.permisos || item.permisos.length === 0) return true
    return puedeAlguno(...item.permisos)
  }

  function renderItem(item) {
    if (!visible(item)) return null

    if (item.children) {
      const hijosVisibles = item.children.filter(visible)
      if (hijosVisibles.length === 0) return null

      const estaAbierto = !!abiertos[item.id]
      const tieneActivo = item.paths?.some(p => location.pathname === p || location.pathname.startsWith(p + '/'))

      return (
        <div key={item.id} className="nav-group">
          <button
            className={`nav-group-header${tieneActivo ? ' has-active' : ''}`}
            onClick={() => toggleGrupo(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-group-label">{item.label}</span>
            <span className={`nav-group-arrow${estaAbierto ? ' open' : ''}`}>
              <ChevronDown size={12} />
            </span>
          </button>
          <div className={`nav-subitems${estaAbierto ? ' open' : ''}`}>
            {hijosVisibles.map((child, idx) => (
              <Link
                key={`${child.to}-${idx}`}
                to={child.to}
                className={`nav-subitem${location.pathname === child.to ? ' active' : ''}`}
                onClick={handleNavClick}
              >
                <span className="sub-icon">{child.icon}</span>
                {child.label}
              </Link>
            ))}
          </div>
        </div>
      )
    }

    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.to === '/'}
        className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        onClick={handleNavClick}
      >
        <span className="nav-icon">{item.icon}</span>
        {item.label}
      </NavLink>
    )
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-logo">
          <ShieldCheck size={20} />
        </div>
        <div className="sidebar-brand-text">
          <h2>Servi<span>Control</span></h2>
          <p>Seguridad Electrónica</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {MENU.map((seccion, i) => {
          const itemsVisibles = seccion.items.map(renderItem).filter(Boolean)
          if (itemsVisibles.length === 0) return null
          return (
            <div key={i} className="sidebar-section">
              {seccion.section && (
                <div className="sidebar-section-label">{seccion.section}</div>
              )}
              {itemsVisibles}
            </div>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        <div
          className="sidebar-user sidebar-user--clickable"
          onClick={() => { navigate('/perfil'); handleNavClick() }}
          title="Editar mi perfil"
        >
          <div className="avatar">{iniciales}</div>
          <div className="sidebar-user-info">
            <strong>{usuario?.username || '—'}</strong>
            <span>{usuario?.rol || '—'}</span>
          </div>
          <button className="btn-logout" onClick={handleLogout} title="Cerrar sesión">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
