import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout/Layout'
import {
  BarChart3, Download,
} from 'lucide-react'

import LoginPage           from './pages/auth/LoginPage'
import DashboardPage       from './pages/dashboard/DashboardPage'
import EntidadesPage       from './pages/entidades/EntidadesPage'
import CotizacionesPage    from './pages/cotizaciones/CotizacionesPage'
import ProyectosPage       from './pages/proyectos/ProyectosPage'
import OrdenesPage         from './pages/ordenes/OrdenesPage'
import MantenimientoPage          from './pages/mantenimiento/MantenimientoPage'
import AlertasMantenimientoPage   from './pages/mantenimiento/AlertasMantenimientoPage'
import FinanzasPage            from './pages/finanzas/FinanzasPage'
import ReporteFinancieroPage   from './pages/finanzas/ReporteFinancieroPage'
import EstablecimientosPage from './pages/establecimientos/EstablecimientosPage'
import SistemasPage        from './pages/sistemas/SistemasPage'
import BitacorasClientePage   from './pages/bitacoras/BitacorasClientePage'
import BitacorasProyectoPage from './pages/bitacoras/BitacorasProyectoPage'
import DocumentosPage        from './pages/bitacoras/DocumentosPage'
import UsuariosPage        from './pages/usuarios/UsuariosPage'
import AuditoriaPage       from './pages/auditoria/AuditoriaPage'
import RolesPage           from './pages/roles/RolesPage'
import CatalogoPage        from './pages/catalogo/CatalogoPage'
import CategoriasPage      from './pages/categorias/CategoriasPage'
import ServiciosPage       from './pages/servicios/ServiciosPage'
import ProveedoresPage     from './pages/proveedores/ProveedoresPage'
import NotificacionesPage  from './pages/notificaciones/NotificacionesPage'
import EmpleadosPage       from './pages/empleados/EmpleadosPage'
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
      <Route path="/mantenimiento/alertas" element={<RutaProtegida><AlertasMantenimientoPage /></RutaProtegida>} />

      {/* Finanzas */}
      <Route path="/finanzas/pago"    element={<RutaProtegida><FinanzasPage /></RutaProtegida>} />
      <Route path="/finanzas/gastos"  element={<RutaProtegida><FinanzasPage /></RutaProtegida>} />
      <Route path="/finanzas/cuentas" element={<RutaProtegida><FinanzasPage /></RutaProtegida>} />
      <Route path="/finanzas/reporte" element={<RutaProtegida><ReporteFinancieroPage /></RutaProtegida>} />

      {/* Registros — Bitácoras */}
      <Route path="/bitacoras/cliente"    element={<RutaProtegida><BitacorasClientePage /></RutaProtegida>} />
      <Route path="/bitacoras/proyecto"   element={<RutaProtegida><BitacorasProyectoPage /></RutaProtegida>} />
      <Route path="/bitacoras/documentos" element={<RutaProtegida><DocumentosPage /></RutaProtegida>} />

      {/* Configuración — Personal */}
      <Route path="/personal/empleados" element={<RutaProtegida><EmpleadosPage /></RutaProtegida>} />
      <Route path="/personal/usuarios"  element={<RutaProtegida><UsuariosPage /></RutaProtegida>} />
      <Route path="/personal/roles"     element={<RutaProtegida><RolesPage /></RutaProtegida>} />

      {/* Configuración — Catálogo */}
      <Route path="/catalogo/productos"   element={<RutaProtegida><CatalogoPage /></RutaProtegida>} />
      <Route path="/catalogo/categorias"  element={<RutaProtegida><CategoriasPage /></RutaProtegida>} />
      <Route path="/catalogo/proveedores" element={<RutaProtegida><ProveedoresPage /></RutaProtegida>} />
      <Route path="/catalogo/servicios"   element={<RutaProtegida><ServiciosPage /></RutaProtegida>} />

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
