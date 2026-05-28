import { useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'

const TITULOS = {
  '/':              ['Dashboard',          'Resumen general del sistema'],
  '/entidades':     ['Entidades',          'Clientes, empleados y proveedores'],
  '/cotizaciones':  ['Cotizaciones',       'Gestión de propuestas comerciales'],
  '/proyectos':     ['Proyectos',          'Seguimiento de proyectos activos'],
  '/ordenes':       ['Órdenes de trabajo', 'Asignación y seguimiento de OT'],
  '/mantenimiento': ['Mantenimiento',      'Mantenimientos programados y correctivos'],
  '/finanzas':      ['Finanzas',           'Pagos y gastos operativos'],
  '/catalogo':      ['Catálogo',           'Productos, categorías y proveedores'],
  '/catalogos':     ['Catálogos',          'Datos maestros del sistema'],
  '/bitacoras':     ['Bitácoras',          'Registro de documentos y actividad'],
  '/notificaciones':['Notificaciones',     'Alertas y avisos del sistema'],
  '/usuarios':      ['Usuarios',           'Gestión de accesos y roles'],
  '/roles':         ['Roles y Permisos',   'Gestión de roles y permisos'],
  '/auditoria':     ['Auditoría',          'Registro de actividad del sistema'],
  '/productos':     ['Productos',          'Catálogo de productos y servicios'],
  '/perfil':        ['Mi perfil',          'Edita tu información de acceso'],
}

export default function Topbar({ onToggleSidebar }) {
  const { pathname } = useLocation()
  const [titulo, subtitulo] = TITULOS[pathname] || ['ServiControl', '']

  return (
    <header className="topbar">
      <button className="hamburger" onClick={onToggleSidebar} aria-label="Abrir menú">
        <Menu size={20} />
      </button>

      <div className="topbar-title">
        {titulo}
        {subtitulo && <span className="topbar-subtitle">— {subtitulo}</span>}
      </div>
    </header>
  )
}
