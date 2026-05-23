import { useState, useEffect } from 'react'
import { entidadesApi } from '../../api/entidades'
import { NotebookPen, Pencil, Trash2, X } from 'lucide-react'

const FORM_NATURAL = {
  tipo: 'natural', nombre: '', ci: '', sexo: '', fecha_nacimiento: '',
  email: '', cliente: true, empleado: false,
}
const FORM_JURIDICA = {
  tipo: 'juridica', razon_social: '', nombre_comercial: '', nit: '',
  email: '', cliente: true, empleado: false,
}

function formatFechaHora(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-BO')
}

export default function EntidadesPage({ abrirCrearInicial = false }) {
  const [entidades, setEntidades]     = useState([])
  const [cargando, setCargando]       = useState(true)
  const [error, setError]             = useState(null)
  const [busqueda, setBusqueda]       = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando]       = useState(null)
  const [form, setForm]               = useState(FORM_NATURAL)
  const [guardando, setGuardando]     = useState(false)
  const [errForm, setErrForm]         = useState('')

  // CU28 — Bitácora de cliente
  const [modalBitacora, setModalBitacora] = useState(null)
  const [notas, setNotas]             = useState([])
  const [cargandoNotas, setCargandoNotas] = useState(false)
  const [nuevaNota, setNuevaNota]     = useState('')
  const [guardandoNota, setGuardandoNota] = useState(false)

  useEffect(() => {
    cargarDatos()
    if (abrirCrearInicial) setModalAbierto(true)
  }, [])

  async function cargarDatos() {
    try {
      setCargando(true)
      setEntidades(await entidadesApi.listar())
    } catch {
      setError('No se pudo cargar las entidades.')
    } finally {
      setCargando(false)
    }
  }

  function abrirCrear() {
    setEditando(null)
    setForm(FORM_NATURAL)
    setErrForm('')
    setModalAbierto(true)
  }

  function abrirEditar(e) {
    setEditando(e)
    if (e.tipo === 'natural') {
      setForm({ tipo: 'natural', nombre: e.nombre || '', ci: e.ci || '',
                sexo: e.sexo || '', fecha_nacimiento: e.fecha_nacimiento || '',
                email: e.email || '', cliente: e.cliente, empleado: e.empleado })
    } else {
      setForm({ tipo: 'juridica', razon_social: e.nombre || '',
                nombre_comercial: e.nombre_comercial || '', nit: e.nit || '',
                email: e.email || '', cliente: e.cliente, empleado: e.empleado })
    }
    setErrForm('')
    setModalAbierto(true)
  }

  function cerrarModal() {
    setModalAbierto(false)
    setEditando(null)
    setErrForm('')
  }

  function cambiarTipo(tipo) {
    setForm(tipo === 'natural' ? FORM_NATURAL : FORM_JURIDICA)
    setErrForm('')
  }

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    setErrForm('')
    try {
      if (editando) {
        const data = await entidadesApi.actualizar(editando.id, form)
        setEntidades(prev => prev.map(x => x.id === editando.id ? data : x))
      } else {
        const data = await entidadesApi.crear(form)
        setEntidades(prev => [...prev, data])
      }
      cerrarModal()
    } catch (err) {
      setErrForm(err.error || err.message || 'Error al guardar.')
    } finally {
      setGuardando(false)
    }
  }

  async function desactivar(id, nombre) {
    if (!confirm(`¿Desactivar "${nombre}"?`)) return
    try {
      await entidadesApi.desactivar(id)
      setEntidades(prev => prev.filter(x => x.id !== id))
    } catch {
      alert('No se pudo desactivar la entidad.')
    }
  }

  // CU28 — Abrir bitácora
  async function abrirBitacora(entidad) {
    setModalBitacora(entidad)
    setNuevaNota('')
    setNotas([])
    setCargandoNotas(true)
    try {
      const resultado = await entidadesApi.listarBitacora(entidad.id)
      setNotas(resultado)
    } catch {
      // sin notas o error
    } finally {
      setCargandoNotas(false)
    }
  }

  async function guardarNota(e) {
    e.preventDefault()
    const texto = nuevaNota.trim()
    if (!texto) return
    setGuardandoNota(true)
    try {
      const nueva = await entidadesApi.crearNota(modalBitacora.id, { nota: texto })
      setNotas(prev => [nueva, ...prev])
      setNuevaNota('')
    } catch {
      alert('No se pudo guardar la nota.')
    } finally {
      setGuardandoNota(false)
    }
  }

  const filtradas = entidades.filter(e => {
    if (!e.cliente) return false
    const txt = (e.nombre + (e.ci || '') + (e.nit || '')).toLowerCase()
    return txt.includes(busqueda.toLowerCase())
  })

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">Personas naturales y jurídicas registradas como clientes</p>
        </div>
        <button className="btn btn-primary" onClick={abrirCrear}>+ Nuevo cliente</button>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 20 }}>
        <input className="input"
          placeholder="Buscar por nombre, CI o NIT..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)} />
      </div>

      {/* Tabla */}
      <div className="card">
        {cargando ? (
          <div className="empty-state">Cargando clientes...</div>
        ) : error ? (
          <div className="empty-state" style={{ color: 'var(--danger)' }}>{error}</div>
        ) : filtradas.length === 0 ? (
          <div className="empty-state">No se encontraron clientes.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Documento</th>
                  <th>Email</th>
                  <th style={{ width: 120 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(e => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 500 }}>{e.nombre}</td>
                    <td>
                      <span className={`badge ${e.tipo === 'natural' ? 'badge-blue' : 'badge-purple'}`}>
                        {e.tipo === 'natural' ? 'Natural' : 'Jurídica'}
                      </span>
                    </td>
                    <td className="text-sm text-muted">
                      {e.tipo === 'natural' ? `CI: ${e.ci}` : e.nit ? `NIT: ${e.nit}` : '—'}
                    </td>
                    <td className="text-sm text-muted">{e.email || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {e.cliente && (
                          <button className="btn btn-ghost btn-sm" onClick={() => abrirBitacora(e)}
                            title="Bitácora de cliente"><NotebookPen size={14} /></button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(e)} title="Editar"><Pencil size={14} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => desactivar(e.id, e.nombre)}
                          title="Desactivar" style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="text-muted text-sm" style={{ padding: '10px 0 0' }}>
          {filtradas.length} cliente{filtradas.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── Modal Bitácora de cliente (CU28) ── */}
      {modalBitacora && (
        <div className="modal-overlay" onClick={() => setModalBitacora(null)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={ev => ev.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Bitácora</h2>
                <div className="text-sm text-muted">{modalBitacora.nombre}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalBitacora(null)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              {/* Formulario nueva nota */}
              <form onSubmit={guardarNota} style={{ marginBottom: 20 }}>
                <div className="form-group">
                  <label className="form-label">Nueva nota</label>
                  <textarea className="input" rows={3} value={nuevaNota}
                    onChange={e => setNuevaNota(e.target.value)}
                    placeholder="Escribí una observación sobre este cliente..." />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary btn-sm"
                    disabled={guardandoNota || !nuevaNota.trim()}>
                    {guardandoNota ? 'Guardando...' : '+ Agregar nota'}
                  </button>
                </div>
              </form>

              {/* Listado de notas */}
              <div style={{ fontWeight: 600, marginBottom: 10 }}>
                Historial de notas {notas.length > 0 && `(${notas.length})`}
              </div>
              {cargandoNotas ? (
                <div className="text-muted text-sm">Cargando notas...</div>
              ) : notas.length === 0 ? (
                <div className="empty-state" style={{ padding: '24px 0' }}>
                  <div className="icon"><NotebookPen size={32} /></div>
                  <p>Sin notas registradas para este cliente.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto' }}>
                  {notas.map(n => (
                    <div key={n.id} style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 14px',
                    }}>
                      <p className="text-sm" style={{ marginBottom: 6, whiteSpace: 'pre-wrap' }}>{n.nota}</p>
                      <div className="text-muted text-sm">
                        {n.usuario} · {formatFechaHora(n.fecha_creacion)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal crear / editar entidad */}
      {modalAbierto && (
        <div className="modal-overlay" onClick={cerrarModal}>
          <div className="modal" onClick={ev => ev.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editando ? 'Editar cliente' : 'Nuevo cliente'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={cerrarModal}><X size={14} /></button>
            </div>

            <form onSubmit={guardar}>
              <div className="modal-body">
                {!editando && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                    <button type="button"
                      className={`btn ${form.tipo === 'natural' ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ flex: 1 }} onClick={() => cambiarTipo('natural')}>
                      Persona natural
                    </button>
                    <button type="button"
                      className={`btn ${form.tipo === 'juridica' ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ flex: 1 }} onClick={() => cambiarTipo('juridica')}>
                      Persona jurídica
                    </button>
                  </div>
                )}

                <div className="form-grid">
                  {form.tipo === 'natural' ? (
                    <>
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Nombre completo *</label>
                        <input className="input" value={form.nombre}
                          onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                          placeholder="Ej: Juan Carlos Pérez Ríos" maxLength={150} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">CI *</label>
                        <input className="input" value={form.ci}
                          onChange={e => setForm(f => ({ ...f, ci: e.target.value }))}
                          placeholder="Ej: 7654321 SC" maxLength={20} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Sexo</label>
                        <select className="input" value={form.sexo}
                          onChange={e => setForm(f => ({ ...f, sexo: e.target.value }))}>
                          <option value="">Sin especificar</option>
                          <option value="M">Masculino</option>
                          <option value="F">Femenino</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Fecha de nacimiento</label>
                        <input type="date" className="input" value={form.fecha_nacimiento}
                          onChange={e => setForm(f => ({ ...f, fecha_nacimiento: e.target.value }))} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Razón social *</label>
                        <input className="input" value={form.razon_social}
                          onChange={e => setForm(f => ({ ...f, razon_social: e.target.value }))}
                          placeholder="Ej: Importadora Rojas SRL" maxLength={200} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Nombre comercial</label>
                        <input className="input" value={form.nombre_comercial}
                          onChange={e => setForm(f => ({ ...f, nombre_comercial: e.target.value }))}
                          placeholder="Ej: Rojas Import" maxLength={150} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">NIT</label>
                        <input className="input" value={form.nit}
                          onChange={e => setForm(f => ({ ...f, nit: e.target.value }))}
                          placeholder="Ej: 123456789" maxLength={20} />
                      </div>
                    </>
                  )}

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Email</label>
                    <input type="email" className="input" value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="contacto@empresa.com" maxLength={100} />
                  </div>

                </div>

                {errForm && <div className="alert alert-danger" style={{ marginTop: 12 }}>{errForm}</div>}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={cerrarModal}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={guardando}>
                  {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
