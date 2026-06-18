import { useState, useEffect } from 'react'
import { serviciosApi } from '../../api/servicios'
import { Pencil, Trash2, X, List } from 'lucide-react'

const FORM_VACIO = { nombre: '', descripcion: '', precio: '' }

function formatPrecio(v) {
  return Number(v).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ServiciosPage() {
  const [servicios, setServicios]       = useState([])
  const [cargando, setCargando]         = useState(true)
  const [error, setError]               = useState(null)
  const [busqueda, setBusqueda]         = useState('')
  const [verInactivos, setVerInactivos] = useState(false)

  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando]         = useState(null)
  const [form, setForm]                 = useState(FORM_VACIO)
  const [guardando, setGuardando]       = useState(false)
  const [errForm, setErrForm]           = useState('')

  useEffect(() => { cargarDatos() }, [verInactivos])

  async function cargarDatos() {
    try {
      setCargando(true)
      setServicios(await serviciosApi.listar(verInactivos))
    } catch {
      setError('No se pudieron cargar los servicios.')
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

  function abrirEditar(s) {
    setEditando(s)
    setForm({ nombre: s.nombre, descripcion: s.descripcion || '', precio: String(s.precio) })
    setErrForm('')
    setModalAbierto(true)
  }

  function cerrarModal() {
    setModalAbierto(false)
    setEditando(null)
    setErrForm('')
  }

  async function guardar(e) {
    e.preventDefault()
    if (!form.nombre.trim()) { setErrForm('El nombre es requerido.'); return }
    const precio = parseFloat(form.precio)
    if (!precio || precio <= 0) { setErrForm('El precio debe ser mayor a cero.'); return }

    setGuardando(true); setErrForm('')
    try {
      const payload = { nombre: form.nombre.trim(), descripcion: form.descripcion.trim() || null, precio }
      if (editando) {
        const data = await serviciosApi.actualizar(editando.id, payload)
        setServicios(prev => prev.map(s => s.id === editando.id ? data : s))
      } else {
        const data = await serviciosApi.crear(payload)
        setServicios(prev => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      }
      cerrarModal()
    } catch (err) {
      setErrForm(err.response?.data?.error || 'Error al guardar.')
    } finally {
      setGuardando(false)
    }
  }

  async function desactivar(s) {
    if (!confirm(`¿Desactivar el servicio "${s.nombre}"?`)) return
    try {
      await serviciosApi.desactivar(s.id)
      if (verInactivos) {
        setServicios(prev => prev.map(x => x.id === s.id ? { ...x, estado: false } : x))
      } else {
        setServicios(prev => prev.filter(x => x.id !== s.id))
      }
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo desactivar el servicio.')
    }
  }

  const filtrados = servicios.filter(s =>
    s.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (s.descripcion || '').toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Servicios</h1>
          <p className="page-subtitle">Servicios disponibles con nombre, descripción y precio base</p>
        </div>
        <button className="btn btn-primary" onClick={abrirCrear}>+ Nuevo servicio</button>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="input" style={{ flex: 1, minWidth: 200 }}
            placeholder="Buscar por nombre o descripción..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={verInactivos}
              onChange={e => setVerInactivos(e.target.checked)} />
            Ver inactivos
          </label>
          {busqueda && (
            <button className="btn btn-ghost" onClick={() => setBusqueda('')}>Limpiar</button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="card">
        {cargando ? (
          <div className="empty-state">Cargando servicios...</div>
        ) : error ? (
          <div className="empty-state" style={{ color: 'var(--danger)' }}>{error}</div>
        ) : filtrados.length === 0 ? (
          <div className="empty-state">
            <List size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
            <p>No se encontraron servicios.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th style={{ textAlign: 'right' }}>Precio base (Bs)</th>
                  {verInactivos && <th style={{ textAlign: 'center' }}>Estado</th>}
                  <th style={{ width: 90 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(s => (
                  <tr key={s.id} style={!s.estado ? { opacity: 0.5 } : {}}>
                    <td style={{ fontWeight: 500 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <List size={14} style={{ opacity: 0.4, flexShrink: 0 }} />
                        {s.nombre}
                      </div>
                    </td>
                    <td className="text-sm text-muted" style={{ maxWidth: 340 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.descripcion || '—'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {formatPrecio(s.precio)}
                    </td>
                    {verInactivos && (
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${s.estado ? 'badge-green' : 'badge-red'}`}>
                          {s.estado ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                    )}
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {s.estado && (
                          <>
                            <button className="btn btn-ghost btn-sm" title="Editar"
                              onClick={() => abrirEditar(s)}>
                              <Pencil size={14} />
                            </button>
                            <button className="btn btn-ghost btn-sm" title="Desactivar"
                              style={{ color: 'var(--danger)' }}
                              onClick={() => desactivar(s)}>
                              <Trash2 size={14} />
                            </button>
                          </>
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
          {filtrados.length} servicio{filtrados.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Modal crear / editar */}
      {modalAbierto && (
        <div className="modal-overlay" onClick={cerrarModal}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editando ? 'Editar servicio' : 'Nuevo servicio'}
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={cerrarModal}>
                <X size={14} />
              </button>
            </div>

            <form onSubmit={guardar}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nombre *</label>
                  <input
                    className="input"
                    value={form.nombre}
                    onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                    placeholder="Ej: Instalación"
                    maxLength={150}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Precio base (Bs) *</label>
                  <input
                    type="number"
                    className="input"
                    min="0.01"
                    step="0.01"
                    value={form.precio}
                    onChange={e => setForm(f => ({ ...f, precio: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Descripción</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={form.descripcion}
                    onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                    placeholder="Descripción breve del servicio..."
                  />
                </div>

                {errForm && (
                  <div className="alert alert-danger" style={{ marginTop: 8 }}>{errForm}</div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={cerrarModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={guardando}>
                  {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear servicio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
