import { useLocation } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'

const TITULOS = {
  '/':              ['Dashboard',          'Resumen general del sistema'],
  '/entidades':     ['Entidades',          'Clientes, empleados y proveedores'],
  '/cotizaciones':  ['Cotizaciones',       'Gestión de propuestas comerciales'],
  '/proyectos':     ['Proyectos',          'Seguimiento de proyectos activos'],
  '/ordenes':       ['Órdenes de trabajo', 'Asignación y seguimiento de OT'],
  '/mantenimiento': ['Mantenimiento',      'Mantenimientos programados y correctivos'],
  '/finanzas':      ['Finanzas',           'Pagos y gastos operativos'],
  '/catalogos':     ['Catálogos',          'Datos maestros del sistema'],
  '/usuarios':      ['Usuarios',           'Gestión de accesos y roles'],
  '/roles':         ['Roles y Permisos',   'Gestión de roles y permisos'],
  '/auditoria':     ['Auditoría',          'Registro de actividad del sistema'],
  '/productos':     ['Productos',          'Catálogo de productos y servicios'],
}

export default function Topbar({ onToggleSidebar }) {
  const { tema, toggleTema } = useTheme()
  const { pathname } = useLocation()
  const [titulo, subtitulo] = TITULOS[pathname] || ['ServiControl', '']

  return (
    <header className="topbar">
      <button className="hamburger" onClick={onToggleSidebar} aria-label="Abrir menú">
        ☰
      </button>

      <div className="topbar-title">
        {titulo}
        {subtitulo && <span className="topbar-subtitle">— {subtitulo}</span>}
      </div>

      <button className="theme-toggle" onClick={toggleTema} title="Cambiar tema">
        {tema === 'dark' ? '☀️' : '🌙'}
      </button>
    </header>
  )
}
