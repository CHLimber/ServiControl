import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout/Layout'

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
import CatalogoProveedoresPage from './pages/catalogo/CatalogoProveedoresPage'
import NotificacionesPage  from './pages/notificaciones/NotificacionesPage'
import PreferenciasPage    from './pages/notificaciones/PreferenciasPage'
import ExportarLogPage     from './pages/auditoria/ExportarLogPage'
import AuditoriaUsuarioPage from './pages/auditoria/AuditoriaUsuarioPage'
import ReporteActividadPage from './pages/auditoria/ReporteActividadPage'
import EmpleadosPage       from './pages/empleados/EmpleadosPage'
import PerfilPage          from './pages/perfil/PerfilPage'
import AsistentePage       from './pages/asistente/AsistentePage'

const PERMISOS_ASISTENTE = [
  'asistente_proyectos', 'asistente_ordenes', 'asistente_clientes', 'asistente_cotizaciones',
  'asistente_finanzas', 'asistente_mantenimientos', 'asistente_empleados', 'asistente_catalogo',
]

function RutaProtegida({ children, permisos, crearPermiso }) {
  const { token, puedeAlguno } = useAuth()
  if (!token) return <Navigate to="/login" replace />

  if (permisos && permisos.length > 0 && !puedeAlguno(...permisos)) {
    return <Layout><SinAcceso /></Layout>
  }
  // Si la ruta es de "creación rápida" (abrirCrearInicial) y el usuario no tiene
  // permiso para crear, redirigimos al listado en vez de abrir el modal.
  if (crearPermiso && !puedeAlguno(crearPermiso)) {
    return <Layout>{children}</Layout>  // se renderiza la página sin el flag, pero
    // los hijos ya filtran. Para simplificar, dejamos que la página gestione.
  }
  return <Layout>{children}</Layout>
}

function SinAcceso() {
  return (
    <div className="empty-state" style={{ padding: 40 }}>
      <h2 style={{ marginBottom: 8 }}>Sin acceso</h2>
      <p>Tu rol no tiene permiso para ver esta sección.</p>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Principal — visible para todos los autenticados */}
      <Route path="/" element={<RutaProtegida><DashboardPage /></RutaProtegida>} />

      {/* Asistente IA — su propia ventana */}
      <Route path="/asistente" element={<RutaProtegida permisos={PERMISOS_ASISTENTE}><AsistentePage /></RutaProtegida>} />

      {/* Comercial — Clientes */}
      <Route path="/clientes"                  element={<RutaProtegida permisos={['ver_clientes']}><EntidadesPage /></RutaProtegida>} />
      <Route path="/clientes/nuevo"            element={<RutaProtegida permisos={['crear_clientes']}><EntidadesPage abrirCrearInicial /></RutaProtegida>} />
      <Route path="/clientes/establecimientos" element={<RutaProtegida permisos={['ver_clientes']}><EstablecimientosPage /></RutaProtegida>} />
      <Route path="/clientes/sistemas"         element={<RutaProtegida permisos={['ver_clientes']}><SistemasPage /></RutaProtegida>} />

      {/* Comercial — Cotizaciones */}
      <Route path="/cotizaciones"       element={<RutaProtegida permisos={['ver_cotizaciones']}><CotizacionesPage /></RutaProtegida>} />
      <Route path="/cotizaciones/nueva" element={<RutaProtegida permisos={['crear_cotizaciones']}><CotizacionesPage abrirCrearInicial /></RutaProtegida>} />

      {/* Operaciones — Proyectos */}
      <Route path="/proyectos"       element={<RutaProtegida permisos={['ver_proyectos']}><ProyectosPage /></RutaProtegida>} />
      <Route path="/proyectos/nuevo" element={<RutaProtegida permisos={['crear_proyectos']}><ProyectosPage abrirCrearInicial /></RutaProtegida>} />

      {/* Operaciones — Órdenes de trabajo */}
      <Route path="/ordenes"       element={<RutaProtegida permisos={['ver_ordenes']}><OrdenesPage /></RutaProtegida>} />
      <Route path="/ordenes/nueva" element={<RutaProtegida permisos={['crear_ordenes']}><OrdenesPage abrirCrearInicial /></RutaProtegida>} />

      {/* Operaciones — Mantenimiento */}
      <Route path="/mantenimiento"         element={<RutaProtegida permisos={['ver_mantenimientos', 'gestionar_mantenimientos']}><MantenimientoPage /></RutaProtegida>} />
      <Route path="/mantenimiento/alertas" element={<RutaProtegida permisos={['ver_mantenimientos', 'gestionar_mantenimientos']}><AlertasMantenimientoPage /></RutaProtegida>} />

      {/* Finanzas */}
      <Route path="/finanzas/pago"    element={<RutaProtegida permisos={['gestionar_finanzas']}><FinanzasPage /></RutaProtegida>} />
      <Route path="/finanzas/gastos"  element={<RutaProtegida permisos={['gestionar_finanzas']}><FinanzasPage /></RutaProtegida>} />
      <Route path="/finanzas/cuentas" element={<RutaProtegida permisos={['ver_finanzas']}><FinanzasPage /></RutaProtegida>} />
      <Route path="/finanzas/reporte" element={<RutaProtegida permisos={['ver_finanzas']}><ReporteFinancieroPage /></RutaProtegida>} />

      {/* Registros — Bitácoras */}
      <Route path="/bitacoras/cliente"    element={<RutaProtegida permisos={['ver_clientes']}><BitacorasClientePage /></RutaProtegida>} />
      <Route path="/bitacoras/proyecto"   element={<RutaProtegida permisos={['ver_proyectos']}><BitacorasProyectoPage /></RutaProtegida>} />
      <Route path="/bitacoras/documentos" element={<RutaProtegida permisos={['ver_clientes', 'ver_proyectos']}><DocumentosPage /></RutaProtegida>} />

      {/* Configuración — Personal */}
      <Route path="/personal/empleados" element={<RutaProtegida permisos={['gestionar_empleados']}><EmpleadosPage /></RutaProtegida>} />
      <Route path="/personal/usuarios"  element={<RutaProtegida permisos={['gestionar_usuarios']}><UsuariosPage /></RutaProtegida>} />
      <Route path="/personal/roles"     element={<RutaProtegida permisos={['gestionar_roles']}><RolesPage /></RutaProtegida>} />

      {/* Configuración — Catálogo */}
      <Route path="/catalogo/productos"   element={<RutaProtegida permisos={['gestionar_catalogo']}><CatalogoPage /></RutaProtegida>} />
      <Route path="/catalogo/categorias"  element={<RutaProtegida permisos={['gestionar_catalogo']}><CategoriasPage /></RutaProtegida>} />
      <Route path="/catalogo/proveedores" element={<RutaProtegida permisos={['gestionar_catalogo']}><ProveedoresPage /></RutaProtegida>} />
      <Route path="/catalogo/servicios"   element={<RutaProtegida permisos={['gestionar_catalogo']}><ServiciosPage /></RutaProtegida>} />

      {/* Catálogo de proveedores — consulta (CU39) */}
      <Route path="/catalogo/consultar-proveedores" element={<RutaProtegida permisos={['consultar_proveedores', 'gestionar_catalogo']}><CatalogoProveedoresPage /></RutaProtegida>} />

      {/* Sistema */}
      <Route path="/notificaciones"             element={<RutaProtegida><NotificacionesPage /></RutaProtegida>} />
      <Route path="/notificaciones/preferencias" element={<RutaProtegida><PreferenciasPage /></RutaProtegida>} />
      <Route path="/auditoria"          element={<RutaProtegida permisos={['gestionar_usuarios']}><AuditoriaPage /></RutaProtegida>} />
      <Route path="/auditoria/por-usuario" element={<RutaProtegida permisos={['gestionar_usuarios']}><AuditoriaUsuarioPage /></RutaProtegida>} />
      <Route path="/auditoria/exportar" element={<RutaProtegida permisos={['gestionar_usuarios']}><ExportarLogPage /></RutaProtegida>} />
      <Route path="/auditoria/reporte"  element={<RutaProtegida permisos={['ver_reportes']}><ReporteActividadPage /></RutaProtegida>} />

      {/* Perfil — siempre accesible */}
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
