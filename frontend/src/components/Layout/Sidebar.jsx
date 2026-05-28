import { useState, useEffect } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard, Users, FileText, Building2, Wrench, Hammer,
  Wallet, BookOpen, UserCog, Package, Bell, ClipboardList,
  List, Plus, MapPin, Settings, CalendarCheck, AlertTriangle,
  DollarSign, BarChart3, FolderOpen, ShieldCheck, Box, Tag,
  Truck, Download, ChevronDown, LogOut,
} from 'lucide-react'

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
        children: [
          { to: '/clientes',                  icon: <List size={13} />,    label: 'Clientes' },
          { to: '/clientes/establecimientos', icon: <MapPin size={13} />,  label: 'Establecimientos' },
          { to: '/clientes/sistemas',         icon: <Settings size={13} />, label: 'Sistemas instalados' },
        ],
      },
      { to: '/cotizaciones', icon: <FileText size={16} />, label: 'Cotizaciones' },
    ],
  },
  {
    section: 'OPERACIONES',
    items: [
      { to: '/proyectos', icon: <Building2 size={16} />, label: 'Proyectos' },
      { to: '/ordenes',   icon: <Wrench size={16} />,   label: 'Órdenes de trabajo' },
      {
        id: 'mantenimiento', icon: <Hammer size={16} />, label: 'Mantenimiento',
        paths: ['/mantenimiento'],
        children: [
          { to: '/mantenimiento',         icon: <CalendarCheck size={13} />,  label: 'Programados' },
          { to: '/mantenimiento/alertas', icon: <AlertTriangle size={13} />,  label: 'Alertas pendientes' },
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
        children: [
          { to: '/finanzas/pago',    icon: <DollarSign size={13} />, label: 'Registrar pago' },
          { to: '/finanzas/cuentas', icon: <List size={13} />,       label: 'Cuentas por cobrar' },
          { to: '/finanzas/reporte', icon: <BarChart3 size={13} />,  label: 'Reporte financiero' },
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
        children: [
          { to: '/bitacoras/cliente',    icon: <List size={13} />,      label: 'Por cliente' },
          { to: '/bitacoras/proyecto',   icon: <List size={13} />,      label: 'Por proyecto' },
          { to: '/bitacoras/documentos', icon: <FolderOpen size={13} />, label: 'Documentos adjuntos' },
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
        children: [
          { to: '/personal/empleados', icon: <List size={13} />,        label: 'Empleados' },
          { to: '/personal/usuarios',  icon: <Settings size={13} />,    label: 'Usuarios y accesos' },
          { to: '/personal/roles',     icon: <ShieldCheck size={13} />, label: 'Roles y permisos' },
        ],
      },
      {
        id: 'catalogo', icon: <Package size={16} />, label: 'Catálogo',
        paths: ['/catalogo'],
        children: [
          { to: '/catalogo/productos',   icon: <Box size={13} />,   label: 'Productos' },
          { to: '/catalogo/categorias',  icon: <Tag size={13} />,   label: 'Categorías' },
          { to: '/catalogo/proveedores', icon: <Truck size={13} />, label: 'Proveedores' },
          { to: '/catalogo/servicios',   icon: <List size={13} />,  label: 'Servicios' },
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
        children: [
          { to: '/auditoria',          icon: <List size={13} />,      label: 'Log del sistema' },
          { to: '/auditoria/exportar', icon: <Download size={13} />,  label: 'Exportar log' },
          { to: '/auditoria/reporte',  icon: <BarChart3 size={13} />, label: 'Reporte de actividad' },
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
  const { usuario, logout } = useAuth()
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

  function renderItem(item) {
    if (item.children) {
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
            {item.children.map((child, idx) => (
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
        {MENU.map((seccion, i) => (
          <div key={i} className="sidebar-section">
            {seccion.section && (
              <div className="sidebar-section-label">{seccion.section}</div>
            )}
            {seccion.items.map(renderItem)}
          </div>
        ))}
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
