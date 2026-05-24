import { useState, useEffect } from 'react'
import { categoriasApi } from '../../api/categorias'
import { Pencil, Trash2, X, Tag } from 'lucide-react'

const FORM_VACIO = { nombre: '', descripcion: '' }

export default function CategoriasPage() {
  const [categorias, setCategorias]     = useState([])
  const [cargando, setCargando]         = useState(true)
  const [error, setError]               = useState(null)
  const [busqueda, setBusqueda]         = useState('')
  const [verInactivas, setVerInactivas] = useState(false)

  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando]         = useState(null)
  const [form, setForm]                 = useState(FORM_VACIO)
  const [guardando, setGuardando]       = useState(false)
  const [errForm, setErrForm]           = useState('')

  useEffect(() => { cargarDatos() }, [verInactivas])

  async function cargarDatos() {
    try {
      setCargando(true)
      setCategorias(await categoriasApi.listar(verInactivas))
    } catch {
      setError('No se pudieron cargar las categorías.')
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

  function abrirEditar(cat) {
    setEditando(cat)
    setForm({ nombre: cat.nombre, descripcion: cat.descripcion || '' })
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
    setGuardando(true); setErrForm('')
    try {
      if (editando) {
        const data = await categoriasApi.actualizar(editando.id, form)
        setCategorias(prev => prev.map(c => c.id === editando.id ? data : c))
      } else {
        const data = await categoriasApi.crear(form)
        setCategorias(prev => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      }
      cerrarModal()
    } catch (err) {
      setErrForm(err.response?.data?.error || 'Error al guardar.')
    } finally {
      setGuardando(false)
    }
  }

  async function desactivar(cat) {
    if (!confirm(`¿Desactivar la categoría "${cat.nombre}"?`)) return
    try {
      await categoriasApi.desactivar(cat.id)
      if (verInactivas) {
        setCategorias(prev => prev.map(c => c.id === cat.id ? { ...c, estado: false } : c))
      } else {
        setCategorias(prev => prev.filter(c => c.id !== cat.id))
      }
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo desactivar la categoría.')
    }
  }

  const filtradas = categorias.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.descripcion || '').toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Categorías</h1>
          <p className="page-subtitle">Clasificaciones para organizar los productos del catálogo</p>
        </div>
        <button className="btn btn-primary" onClick={abrirCrear}>+ Nueva categoría</button>
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
            <input type="checkbox" checked={verInactivas}
              onChange={e => setVerInactivas(e.target.checked)} />
            Ver inactivas
          </label>
        </div>
      </div>

      {/* Tabla */}
      <div className="card">
        {cargando ? (
          <div className="empty-state">Cargando categorías...</div>
        ) : error ? (
          <div className="empty-state" style={{ color: 'var(--danger)' }}>{error}</div>
        ) : filtradas.length === 0 ? (
          <div className="empty-state">
            <Tag size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
            <p>No se encontraron categorías.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th style={{ textAlign: 'center' }}>Productos activos</th>
                  {verInactivas && <th style={{ textAlign: 'center' }}>Estado</th>}
                  <th style={{ width: 90 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(cat => (
                  <tr key={cat.id} style={!cat.estado ? { opacity: 0.5 } : {}}>
                    <td style={{ fontWeight: 500 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Tag size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
                        {cat.nombre}
                      </div>
                    </td>
                    <td className="text-sm text-muted" style={{ maxWidth: 320 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cat.descripcion || '—'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {cat.total_productos > 0 ? (
                        <span className="badge badge-blue">{cat.total_productos}</span>
                      ) : (
                        <span className="text-muted text-sm">0</span>
                      )}
                    </td>
                    {verInactivas && (
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${cat.estado ? 'badge-green' : 'badge-red'}`}>
                          {cat.estado ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                    )}
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {cat.estado && (
                          <>
                            <button className="btn btn-ghost btn-sm" title="Editar"
                              onClick={() => abrirEditar(cat)}>
                              <Pencil size={14} />
                            </button>
                            <button className="btn btn-ghost btn-sm" title="Desactivar"
                              style={{ color: 'var(--danger)' }}
                              onClick={() => desactivar(cat)}>
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
          {filtradas.length} categoría{filtradas.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Modal crear / editar */}
      {modalAbierto && (
        <div className="modal-overlay" onClick={cerrarModal}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editando ? 'Editar categoría' : 'Nueva categoría'}
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
                    placeholder="Ej: Cámaras IP y Analógicas"
                    maxLength={100}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Descripción</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={form.descripcion}
                    onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                    placeholder="Descripción opcional de la categoría..."
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
                  {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear categoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
