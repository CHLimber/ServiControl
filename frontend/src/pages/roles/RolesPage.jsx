import { useState, useEffect } from 'react'
import client from '../../api/client'
import { AlertTriangle, X, Check } from 'lucide-react'

const rolesApi = {
  listar:            ()         => client.get('/roles/'),
  obtener:           (id)       => client.get(`/roles/${id}`),
  permisos:          ()         => client.get('/roles/permisos'),
  actualizarPermisos:(id, body) => client.put(`/roles/${id}/permisos`, body),
}

// Columnas CRUD — mapeadas a los prefijos reales del backend
const COLS = [
  { key: 'ver',       label: 'Leer' },
  { key: 'crear',     label: 'Crear' },
  { key: 'editar',    label: 'Modificar' },
  { key: 'gestionar', label: 'Gestionar' },
]

// Orden y etiquetas de los módulos
const ORDEN_MODULOS = [
  ['proyectos',      'Proyectos'],
  ['ordenes',        'Órdenes de trabajo'],
  ['clientes',       'Clientes'],
  ['cotizaciones',   'Cotizaciones'],
  ['finanzas',       'Finanzas'],
  ['mantenimientos', 'Mantenimientos'],
  ['reportes',       'Reportes'],
  ['usuarios',       'Usuarios'],
  ['catalogo',       'Catálogo'],
  ['roles',          'Roles y permisos'],
]

// Agrupa el catálogo en { modulo: { prefijo: permiso } }
// Permisos sin prefijo conocido van a sinGrupo
function buildMatrix(catalogo) {
  const matrix = {}
  const sinGrupo = []
  const prefijosValidos = new Set(COLS.map(c => c.key))

  for (const p of catalogo) {
    const idx = p.nombre.indexOf('_')
    if (idx === -1) { sinGrupo.push(p); continue }
    const pref = p.nombre.slice(0, idx)
    const mod  = p.nombre.slice(idx + 1)
    if (!prefijosValidos.has(pref)) { sinGrupo.push(p); continue }
    if (!matrix[mod]) matrix[mod] = {}
    matrix[mod][pref] = p
  }
  return { matrix, sinGrupo }
}

// Capitaliza primera letra
function cap(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export default function RolesPage() {
  const [roles, setRoles]             = useState([])
  const [catalogo, setCatalogo]       = useState([])
  const [rolSelec, setRolSelec]       = useState(null)
  const [asignados, setAsignados]     = useState(new Set())
  const [pendientes, setPendientes]   = useState(new Set())
  const [cargando, setCargando]       = useState(true)
  const [cargandoRol, setCargandoRol] = useState(false)
  const [guardando, setGuardando]     = useState(false)
  const [error, setError]             = useState('')
  const [modalAdvert, setModalAdvert] = useState(false)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setCargando(true)
    try {
      const [rls, cat] = await Promise.all([rolesApi.listar(), rolesApi.permisos()])
      setRoles(rls)
      setCatalogo(cat)
    } catch {
      setError('No se pudieron cargar los datos.')
    } finally {
      setCargando(false)
    }
  }

  async function seleccionarRol(rol) {
    setRolSelec(rol)
    setError('')
    setModalAdvert(false)
    setCargandoRol(true)
    try {
      const detalle = await rolesApi.obtener(rol.id)
      const set = new Set(detalle.permisos_asignados)
      setAsignados(set)
      setPendientes(new Set(set))
    } catch {
      setError('No se pudo cargar el rol.')
    } finally {
      setCargandoRol(false)
    }
  }

  function togglePermiso(id) {
    setPendientes(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Marca/desmarca toda una fila (módulo)
  function toggleFila(mod, matrix) {
    const permsDelMod = COLS.map(c => matrix[mod]?.[c.key]).filter(Boolean)
    const todosActivos = permsDelMod.every(p => pendientes.has(p.id))
    setPendientes(prev => {
      const next = new Set(prev)
      permsDelMod.forEach(p => todosActivos ? next.delete(p.id) : next.add(p.id))
      return next
    })
  }

  // Marca/desmarca toda una columna (acción)
  function toggleColumna(prefijo, matrix) {
    const permsDeLaCol = ORDEN_MODULOS
      .map(([mod]) => matrix[mod]?.[prefijo])
      .filter(Boolean)
    const todosActivos = permsDeLaCol.every(p => pendientes.has(p.id))
    setPendientes(prev => {
      const next = new Set(prev)
      permsDeLaCol.forEach(p => todosActivos ? next.delete(p.id) : next.add(p.id))
      return next
    })
  }

  const haycambios = () => {
    if (pendientes.size !== asignados.size) return true
    for (const id of pendientes) if (!asignados.has(id)) return true
    return false
  }

  async function guardar(forzar = false) {
    setGuardando(true)
    setError('')
    try {
      const res = await rolesApi.actualizarPermisos(rolSelec.id, {
        permisos: [...pendientes],
        forzar,
      })
      const set = new Set(res.permisos_asignados)
      setAsignados(set)
      setPendientes(new Set(set))
      setRoles(prev => prev.map(r => r.id === res.id ? { ...r, total_permisos: res.total_permisos } : r))
      setModalAdvert(false)
    } catch (err) {
      if (err.advertencia) setModalAdvert(true)
      else setError(err.error || 'Error al guardar los permisos.')
    } finally {
      setGuardando(false)
    }
  }

  function intentarGuardar() {
    if (pendientes.size === 0 && rolSelec?.nombre === 'Administrador') {
      setModalAdvert(true)
      return
    }
    guardar(false)
  }

  if (cargando) return <div className="empty-state">Cargando roles y permisos...</div>

  const { matrix, sinGrupo } = buildMatrix(catalogo)

  // Módulos en orden fijo + cualquier módulo extra del catálogo no cubierto
  const modulosEnOrden = new Set(ORDEN_MODULOS.map(([mod]) => mod))
  const modulosExtra   = Object.keys(matrix)
    .filter(mod => !modulosEnOrden.has(mod))
    .map(mod => [mod, cap(mod.replace(/_/g, ' '))])
  const filas = [
    ...ORDEN_MODULOS.filter(([mod]) => matrix[mod]),
    ...modulosExtra,
  ]

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Roles y Permisos</h1>
          <p className="page-subtitle">Configuración de accesos por rol</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Panel izquierdo: lista de roles */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--border)',
            fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em',
          }}>
            ROLES DEL SISTEMA
          </div>
          {roles.map(rol => (
            <button
              key={rol.id}
              onClick={() => seleccionarRol(rol)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '13px 16px',
                color: 'var(--text)',
                background: rolSelec?.id === rol.id ? 'var(--accent-light)' : 'transparent',
                border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                borderLeft: rolSelec?.id === rol.id ? '3px solid var(--accent)' : '3px solid transparent',
                transition: 'background .15s',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{rol.nombre}</div>
              <div className="text-sm text-muted" style={{ marginTop: 2 }}>{rol.descripcion}</div>
              <div className="text-sm" style={{ marginTop: 4, color: 'var(--accent)' }}>
                {rol.total_permisos} permiso{rol.total_permisos !== 1 ? 's' : ''} asignado{rol.total_permisos !== 1 ? 's' : ''}
              </div>
            </button>
          ))}
        </div>

        {/* Panel derecho: matriz de permisos */}
        <div>
          {!rolSelec ? (
            <div className="card">
              <div className="empty-state">Seleccioná un rol para gestionar sus permisos.</div>
            </div>
          ) : cargandoRol ? (
            <div className="card">
              <div className="empty-state">Cargando permisos...</div>
            </div>
          ) : (
            <div className="card">
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{rolSelec.nombre}</h2>
                <p className="text-muted text-sm" style={{ margin: '4px 0 0' }}>{rolSelec.descripcion}</p>
              </div>

              {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

              {/* Tabla de permisos */}
              <div className="table-wrap" style={{ marginBottom: 20 }}>
                <table style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '40%' }} />
                    {COLS.map(c => <col key={c.key} />)}
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Módulo</th>
                      {COLS.map(col => {
                        const perms = ORDEN_MODULOS.map(([mod]) => matrix[mod]?.[col.key]).filter(Boolean)
                        const hay = perms.length > 0
                        const todos = hay && perms.every(p => pendientes.has(p.id))
                        return (
                          <th key={col.key} style={{ textAlign: 'center', userSelect: 'none' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                              <span>{col.label}</span>
                              {hay && (
                                <button
                                  type="button"
                                  title={todos ? `Desmarcar toda la columna ${col.label}` : `Marcar toda la columna ${col.label}`}
                                  onClick={() => toggleColumna(col.key, matrix)}
                                  style={{
                                    fontSize: '0.68rem', padding: '1px 7px', borderRadius: 10,
                                    border: '1px solid var(--border)', background: 'transparent',
                                    color: 'var(--text-muted)', cursor: 'pointer',
                                  }}
                                >
                                  {todos ? 'Quitar todo' : 'Marcar todo'}
                                </button>
                              )}
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map(([mod, label]) => {
                      const permsDelMod = COLS.map(c => matrix[mod]?.[c.key]).filter(Boolean)
                      const todosActivos = permsDelMod.length > 0 && permsDelMod.every(p => pendientes.has(p.id))
                      return (
                        <tr key={mod} style={{ transition: 'background .1s' }}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => toggleFila(mod, matrix)}
                                title={todosActivos ? 'Quitar todos los permisos de este módulo' : 'Marcar todos los permisos de este módulo'}
                                style={{
                                  width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                                  border: `2px solid ${todosActivos ? 'var(--accent)' : 'var(--text-muted)'}`,
                                  background: todosActivos ? 'var(--accent)' : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  cursor: 'pointer',
                                }}
                              >
                                {todosActivos && <Check size={11} color="white" strokeWidth={3} />}
                              </button>
                              <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{label}</span>
                            </div>
                          </td>
                          {COLS.map(col => {
                            const perm = matrix[mod]?.[col.key]
                            if (!perm) {
                              return (
                                <td key={col.key} style={{ textAlign: 'center' }}>
                                  <span style={{ color: 'var(--border)', fontSize: '1.1rem', lineHeight: 1 }}>—</span>
                                </td>
                              )
                            }
                            const activo = pendientes.has(perm.id)
                            return (
                              <td key={col.key} style={{ textAlign: 'center' }}>
                                <label
                                  title={perm.descripcion}
                                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                >
                                  <div
                                    onClick={() => togglePermiso(perm.id)}
                                    style={{
                                      width: 20, height: 20, borderRadius: 5,
                                      border: `2px solid ${activo ? 'var(--accent)' : 'var(--text-muted)'}`,
                                      background: activo ? 'var(--accent)' : 'transparent',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      cursor: 'pointer', transition: 'border-color .15s, background .15s',
                                    }}
                                  >
                                    {activo && <Check size={12} color="white" strokeWidth={3} />}
                                  </div>
                                </label>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Permisos que no encajan en la tabla (prefijo desconocido) */}
              {sinGrupo.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 10, letterSpacing: '0.05em' }}>
                    OTROS PERMISOS
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {sinGrupo.map(p => {
                      const activo = pendientes.has(p.id)
                      return (
                        <label
                          key={p.id}
                          title={p.descripcion}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                            border: `1px solid ${activo ? 'var(--primary)' : 'var(--border)'}`,
                            background: activo ? 'var(--primary-light, rgba(99,102,241,.06))' : 'transparent',
                            fontSize: '0.85rem', fontWeight: activo ? 600 : 400,
                            transition: 'border-color .15s, background .15s',
                          }}
                        >
                          <div
                            onClick={() => togglePermiso(p.id)}
                            style={{
                              width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                              border: `2px solid ${activo ? 'var(--accent)' : 'var(--text-muted)'}`,
                              background: activo ? 'var(--accent)' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            {activo && <Check size={10} color="white" strokeWidth={3} />}
                          </div>
                          {p.nombre}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-muted text-sm">
                  {pendientes.size} de {catalogo.length} permisos seleccionados
                </span>
                <button
                  className="btn btn-primary"
                  onClick={intentarGuardar}
                  disabled={guardando || !haycambios()}
                >
                  {guardando ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal advertencia: quitar todos al Administrador */}
      {modalAdvert && (
        <div className="modal-overlay" onClick={() => setModalAdvert(false)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: 'var(--warning, #d97706)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={18} /> Advertencia
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalAdvert(false)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <p>Estás a punto de <strong>quitar todos los permisos</strong> al rol <strong>Administrador</strong>.</p>
              <p style={{ marginTop: 10 }}>Esto dejará sin acceso al sistema a todos los usuarios con ese rol, incluido el tuyo si eres Administrador.</p>
              <p style={{ marginTop: 10 }}>¿Querés continuar de todas formas?</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalAdvert(false)}>Cancelar</button>
              <button
                className="btn btn-danger"
                onClick={() => guardar(true)}
                disabled={guardando}
                style={{ background: 'var(--danger)', color: '#fff', border: 'none' }}
              >
                {guardando ? 'Guardando...' : 'Sí, quitar todos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
