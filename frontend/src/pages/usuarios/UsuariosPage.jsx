import { useState, useEffect } from 'react'
import { usuariosApi } from '../../api/usuarios'
import { catalogosApi } from '../../api/catalogos'
import { Pencil, Lock, Unlock, KeyRound, X } from 'lucide-react'

const FORM_VACIO = { username: '', password: '', email: '', id_rol: '', id_empleado: '' }

function formatFecha(iso) {
  if (!iso) return 'Nunca'
  return new Date(iso).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios]   = useState([])
  const [cargando, setCargando]   = useState(true)
  const [roles, setRoles]         = useState([])
  const [empleados, setEmpleados] = useState([])
  const [busqueda, setBusqueda]   = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')  // '', 'activo', 'inactivo'

  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando]   = useState(null)
  const [form, setForm]           = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [errForm, setErrForm]     = useState('')

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setCargando(true)
    try {
      const [usrs, rls, emps] = await Promise.all([
        usuariosApi.listar(),
        usuariosApi.roles(),
        catalogosApi.empleados(),
      ])
      setUsuarios(usrs)
      setRoles(rls)
      setEmpleados(emps)
    } catch {
      // silencioso
    } finally {
      setCargando(false)
    }
  }

  function abrirCrear() {
    setEditando(null)
    setForm(FORM_VACIO)
    setErrForm('')
    setModalAbierto(true)
  }

  function abrirEditar(u) {
    setEditando(u)
    setForm({ username: u.username, password: '', email: u.email || '', id_rol: u.id_rol, id_empleado: u.id_empleado })
    setErrForm('')
    setModalAbierto(true)
  }

  async function guardar(e) {
    e.preventDefault()
    if (!form.username || !form.id_rol || !form.id_empleado) {
      setErrForm('Username, rol y empleado son obligatorios.')
      return
    }
    if (!editando && !form.password) {
      setErrForm('La contraseña es obligatoria al crear un usuario.')
      return
    }
    setGuardando(true)
    setErrForm('')
    try {
      const payload = { ...form }
      if (!payload.password) delete payload.password  // no enviar si está vacío al editar
      if (editando) {
        const actualizado = await usuariosApi.actualizar(editando.id, payload)
        setUsuarios(prev => prev.map(u => u.id === editando.id ? actualizado : u))
      } else {
        const nuevo = await usuariosApi.crear(payload)
        setUsuarios(prev => [...prev, nuevo])
      }
      setModalAbierto(false)
    } catch (err) {
      setErrForm(err.error || 'Error al guardar.')
    } finally {
      setGuardando(false)
    }
  }

  async function toggleEstado(u) {
    const accion = u.estado ? 'desactivar' : 'activar'
    if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} al usuario "${u.username}"?`)) return
    try {
      const actualizado = await usuariosApi.cambiarEstado(u.id)
      setUsuarios(prev => prev.map(x => x.id === u.id ? actualizado : x))
    } catch (err) {
      alert(err.error || 'No se pudo cambiar el estado.')
    }
  }

  async function desbloquear(u) {
    try {
      const actualizado = await usuariosApi.desbloquear(u.id)
      setUsuarios(prev => prev.map(x => x.id === u.id ? actualizado : x))
    } catch {
      alert('No se pudo desbloquear.')
    }
  }

  // Empleados sin usuario activo (para el selector al crear)
  const empleadosDisponibles = editando
    ? empleados  // al editar mostrar todos
    : empleados.filter(emp => !usuarios.find(u => u.id_empleado === emp.id && u.estado))

  const filtrados = usuarios.filter(u => {
    const coincideBusq = (u.username + (u.empleado_nombre || '')).toLowerCase().includes(busqueda.toLowerCase())
    const coincideEst  = filtroEstado === '' || (filtroEstado === 'activo' ? u.estado : !u.estado)
    return coincideBusq && coincideEst
  })

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Usuarios</h1>
          <p className="page-subtitle">Gestión de accesos y roles del sistema</p>
        </div>
        <button className="btn btn-primary" onClick={abrirCrear}>+ Nuevo usuario</button>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input className="input" style={{ flex: 1, minWidth: 200 }}
            placeholder="Buscar por username o nombre..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <select className="input" style={{ minWidth: 160 }}
            value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="">Todos</option>
            <option value="activo">Solo activos</option>
            <option value="inactivo">Solo inactivos</option>
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className="card">
        {cargando ? (
          <div className="empty-state">Cargando usuarios...</div>
        ) : filtrados.length === 0 ? (
          <div className="empty-state">No se encontraron usuarios.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Empleado</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Último acceso</th>
                  <th style={{ width: 130 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{u.username}</div>
                      {u.email && <div className="text-sm text-muted">{u.email}</div>}
                    </td>
                    <td className="text-sm">{u.empleado_nombre || `#${u.id_empleado}`}</td>
                    <td>
                      <span className="badge badge-blue">{u.rol_nombre}</span>
                    </td>
                    <td>
                      {u.bloqueado ? (
                        <span className="badge badge-red">Bloqueado</span>
                      ) : u.estado ? (
                        <span className="badge badge-green">Activo</span>
                      ) : (
                        <span className="badge badge-gray">Inactivo</span>
                      )}
                    </td>
                    <td className="text-sm text-muted">{formatFecha(u.ultimo_acceso)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" title="Editar"
                          onClick={() => abrirEditar(u)}><Pencil size={14} /></button>
                        <button className="btn btn-ghost btn-sm"
                          title={u.estado ? 'Desactivar' : 'Activar'}
                          style={{ color: u.estado ? 'var(--danger)' : 'var(--success)' }}
                          onClick={() => toggleEstado(u)}>
                          {u.estado ? <Lock size={14} /> : <Unlock size={14} />}
                        </button>
                        {u.bloqueado && (
                          <button className="btn btn-ghost btn-sm" title="Desbloquear"
                            style={{ color: 'var(--warning)' }}
                            onClick={() => desbloquear(u)}><KeyRound size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="text-muted text-sm" style={{ padding: '10px 0 0' }}>
          {filtrados.length} usuario{filtrados.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Modal crear / editar */}
      {modalAbierto && (
        <div className="modal-overlay" onClick={() => setModalAbierto(false)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editando ? 'Editar usuario' : 'Nuevo usuario'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalAbierto(false)}><X size={14} /></button>
            </div>
            <form onSubmit={guardar}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Empleado *</label>
                    <select className="input" value={form.id_empleado}
                      onChange={e => setForm(f => ({ ...f, id_empleado: Number(e.target.value) || '' }))}
                      disabled={!!editando}>
                      <option value="">Seleccioná un empleado</option>
                      {empleadosDisponibles.map(e => (
                        <option key={e.id} value={e.id}>{e.nombre}</option>
                      ))}
                    </select>
                    {!editando && empleadosDisponibles.length === 0 && (
                      <div className="text-sm text-muted" style={{ marginTop: 4 }}>
                        Todos los empleados ya tienen usuario activo.
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Username *</label>
                    <input className="input" value={form.username}
                      onChange={e => setForm(f => ({ ...f, username: e.target.value.trim() }))}
                      placeholder="Ej: juan.perez" maxLength={50} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Rol *</label>
                    <select className="input" value={form.id_rol}
                      onChange={e => setForm(f => ({ ...f, id_rol: Number(e.target.value) || '' }))}>
                      <option value="">Seleccioná un rol</option>
                      {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                    </select>
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Email</label>
                    <input type="email" className="input" value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="correo@empresa.com" maxLength={100} />
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">
                      Contraseña {editando ? '(dejar vacío para no cambiar)' : '*'}
                    </label>
                    <input type="password" className="input" value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder={editando ? 'Nueva contraseña...' : 'Mínimo 6 caracteres'}
                      autoComplete="new-password" maxLength={255} />
                  </div>
                </div>
                {errForm && <div className="alert alert-danger" style={{ marginTop: 12 }}>{errForm}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModalAbierto(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={guardando}>
                  {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
