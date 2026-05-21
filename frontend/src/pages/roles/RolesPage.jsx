import { useState, useEffect } from 'react'
import client from '../../api/client'
import { AlertTriangle, X } from 'lucide-react'

const rolesApi = {
  listar:            ()              => client.get('/roles/'),
  obtener:           (id)            => client.get(`/roles/${id}`),
  permisos:          ()              => client.get('/roles/permisos'),
  actualizarPermisos:(id, body)      => client.put(`/roles/${id}/permisos`, body),
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
      if (err.advertencia) {
        setModalAdvert(true)
      } else {
        setError(err.error || 'Error al guardar los permisos.')
      }
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

  if (cargando) {
    return <div className="empty-state">Cargando roles y permisos...</div>
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Roles y Permisos</h1>
          <p className="page-subtitle">Configuración de accesos por rol</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Panel izquierdo: lista de roles */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13, color: 'var(--text-muted)' }}>
            ROLES DEL SISTEMA
          </div>
          {roles.map(rol => (
            <button
              key={rol.id}
              onClick={() => seleccionarRol(rol)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '14px 16px',
                background: rolSelec?.id === rol.id ? 'var(--primary-light, rgba(99,102,241,.08))' : 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                borderLeft: rolSelec?.id === rol.id ? '3px solid var(--primary)' : '3px solid transparent',
                transition: 'background .15s',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14 }}>{rol.nombre}</div>
              <div className="text-sm text-muted" style={{ marginTop: 2 }}>
                {rol.descripcion}
              </div>
              <div className="text-sm" style={{ marginTop: 4, color: 'var(--primary)' }}>
                {rol.total_permisos} permiso{rol.total_permisos !== 1 ? 's' : ''} asignado{rol.total_permisos !== 1 ? 's' : ''}
              </div>
            </button>
          ))}
        </div>

        {/* Panel derecho: editor de permisos */}
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

              {error && (
                <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, marginBottom: 20 }}>
                {catalogo.map(p => {
                  const activo = pendientes.has(p.id)
                  return (
                    <label
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: '12px 14px',
                        border: `1px solid ${activo ? 'var(--primary)' : 'var(--border)'}`,
                        borderRadius: 8,
                        cursor: 'pointer',
                        background: activo ? 'var(--primary-light, rgba(99,102,241,.06))' : 'transparent',
                        transition: 'border-color .15s, background .15s',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={activo}
                        onChange={() => togglePermiso(p.id)}
                        style={{ marginTop: 2, accentColor: 'var(--primary)', flexShrink: 0 }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{p.nombre}</div>
                        {p.descripcion && (
                          <div className="text-muted text-sm" style={{ marginTop: 2 }}>{p.descripcion}</div>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>

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

      {/* Modal de advertencia E1: quitar todos al Administrador */}
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

