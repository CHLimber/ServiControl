import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout/Layout'
import {
  ClipboardList, FolderOpen,
  Tag, Truck, List, BarChart3, Download, AlertTriangle, UserCog,
} from 'lucide-react'

import LoginPage           from './pages/auth/LoginPage'
import DashboardPage       from './pages/dashboard/DashboardPage'
import EntidadesPage       from './pages/entidades/EntidadesPage'
import CotizacionesPage    from './pages/cotizaciones/CotizacionesPage'
import ProyectosPage       from './pages/proyectos/ProyectosPage'
import OrdenesPage         from './pages/ordenes/OrdenesPage'
import MantenimientoPage   from './pages/mantenimiento/MantenimientoPage'
import FinanzasPage        from './pages/finanzas/FinanzasPage'
import EstablecimientosPage from './pages/establecimientos/EstablecimientosPage'
import SistemasPage        from './pages/sistemas/SistemasPage'
import BitacorasClientePage from './pages/bitacoras/BitacorasClientePage'
import UsuariosPage        from './pages/usuarios/UsuariosPage'
import AuditoriaPage       from './pages/auditoria/AuditoriaPage'
import RolesPage           from './pages/roles/RolesPage'
import CatalogoPage        from './pages/catalogo/CatalogoPage'
import NotificacionesPage  from './pages/notificaciones/NotificacionesPage'
import PerfilPage          from './pages/perfil/PerfilPage'
import ModuloPlaceholder   from './pages/ModuloPlaceholder'

function RutaProtegida({ children }) {
  const { token } = useAuth()
  return token ? <Layout>{children}</Layout> : <Navigate to="/login" replace />
}

function P(nombre, descripcion, icon) {
  return (
    <RutaProtegida>
      <ModuloPlaceholder nombre={nombre} descripcion={descripcion} icon={icon} />
    </RutaProtegida>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Principal */}
      <Route path="/" element={<RutaProtegida><DashboardPage /></RutaProtegida>} />

      {/* Comercial — Clientes */}
      <Route path="/clientes"                  element={<RutaProtegida><EntidadesPage /></RutaProtegida>} />
      <Route path="/clientes/nuevo"            element={<RutaProtegida><EntidadesPage abrirCrearInicial /></RutaProtegida>} />
      <Route path="/clientes/establecimientos" element={<RutaProtegida><EstablecimientosPage /></RutaProtegida>} />
      <Route path="/clientes/sistemas"         element={<RutaProtegida><SistemasPage /></RutaProtegida>} />

      {/* Comercial — Cotizaciones */}
      <Route path="/cotizaciones"       element={<RutaProtegida><CotizacionesPage /></RutaProtegida>} />
      <Route path="/cotizaciones/nueva" element={<RutaProtegida><CotizacionesPage abrirCrearInicial /></RutaProtegida>} />

      {/* Operaciones — Proyectos */}
      <Route path="/proyectos"       element={<RutaProtegida><ProyectosPage /></RutaProtegida>} />
      <Route path="/proyectos/nuevo" element={<RutaProtegida><ProyectosPage abrirCrearInicial /></RutaProtegida>} />

      {/* Operaciones — Órdenes de trabajo */}
      <Route path="/ordenes"       element={<RutaProtegida><OrdenesPage /></RutaProtegida>} />
      <Route path="/ordenes/nueva" element={<RutaProtegida><OrdenesPage abrirCrearInicial /></RutaProtegida>} />

      {/* Operaciones — Mantenimiento */}
      <Route path="/mantenimiento"         element={<RutaProtegida><MantenimientoPage /></RutaProtegida>} />
      <Route path="/mantenimiento/alertas" element={P('Alertas de mantenimiento', 'Alertas pendientes de mantenimiento vencido o próximo', <AlertTriangle size={32} />)} />

      {/* Finanzas */}
      <Route path="/finanzas/pago"    element={<RutaProtegida><FinanzasPage /></RutaProtegida>} />
      <Route path="/finanzas/gastos"  element={<RutaProtegida><FinanzasPage /></RutaProtegida>} />
      <Route path="/finanzas/cuentas" element={<RutaProtegida><FinanzasPage /></RutaProtegida>} />
      <Route path="/finanzas/reporte" element={P('Reporte financiero', 'Vista consolidada de ingresos y gastos por período', <BarChart3 size={32} />)} />

      {/* Registros — Bitácoras */}
      <Route path="/bitacoras/cliente"    element={<RutaProtegida><BitacorasClientePage /></RutaProtegida>} />
      <Route path="/bitacoras/proyecto"   element={P('Bitácora por proyecto', 'Historial de notas registradas sobre proyectos', <ClipboardList size={32} />)} />
      <Route path="/bitacoras/documentos" element={P('Documentos adjuntos', 'Documentos adjuntos a proyectos o entidades', <FolderOpen size={32} />)} />

      {/* Configuración — Personal */}
      <Route path="/personal/empleados" element={P('Empleados', 'Gestión de empleados, cargos y especialidades', <UserCog size={32} />)} />
      <Route path="/personal/usuarios"  element={<RutaProtegida><UsuariosPage /></RutaProtegida>} />
      <Route path="/personal/roles"     element={<RutaProtegida><RolesPage /></RutaProtegida>} />

      {/* Configuración — Catálogo */}
      <Route path="/catalogo/productos"   element={<RutaProtegida><CatalogoPage /></RutaProtegida>} />
      <Route path="/catalogo/categorias"  element={P('Categorías', 'Categorías para organizar los productos del catálogo', <Tag size={32} />)} />
      <Route path="/catalogo/proveedores" element={P('Proveedores', 'Proveedores con catálogo de productos y precios', <Truck size={32} />)} />
      <Route path="/catalogo/servicios"   element={P('Servicios', 'Servicios disponibles con nombre y precio base', <List size={32} />)} />

      {/* Sistema */}
      <Route path="/notificaciones"     element={<RutaProtegida><NotificacionesPage /></RutaProtegida>} />
      <Route path="/auditoria"          element={<RutaProtegida><AuditoriaPage /></RutaProtegida>} />
      <Route path="/auditoria/exportar" element={P('Exportar log', 'Descarga del historial de auditoría en CSV o PDF', <Download size={32} />)} />
      <Route path="/auditoria/reporte"  element={P('Reporte de actividad', 'Resumen estadístico de acciones por módulo y período', <BarChart3 size={32} />)} />

      {/* Perfil */}
      <Route path="/perfil" element={<RutaProtegida><PerfilPage /></RutaProtegida>} />

      {/* Redireccionamientos de compatibilidad con rutas antiguas */}
      <Route path="/entidades"  element={<Navigate to="/clientes" replace />} />
      <Route path="/usuarios"   element={<Navigate to="/personal/usuarios" replace />} />
      <Route path="/roles"      element={<Navigate to="/personal/roles" replace />} />
      <Route path="/finanzas"   element={<Navigate to="/finanzas/pago" replace />} />
      <Route path="/bitacoras"  element={<Navigate to="/bitacoras/cliente" replace />} />
      <Route path="/catalogo"   element={<Navigate to="/catalogo/productos" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
