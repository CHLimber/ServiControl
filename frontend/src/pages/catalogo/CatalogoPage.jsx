import { useState, useEffect } from 'react'
import { productosApi } from '../../api/productos'
import { catalogosApi } from '../../api/catalogos'

const UNIDADES = ['unidad', 'caja', 'rollo', 'bolsa', 'paquete', 'metro', 'par', 'kit']

const FORM_VACIO = { codigo: '', nombre: '', unidad_medida: 'unidad', id_categoria: '', descripcion: '' }

export default function ProductosPage() {
  const [productos, setProductos]     = useState([])
  const [categorias, setCategorias]   = useState([])
  const [cargando, setCargando]       = useState(true)
  const [error, setError]             = useState(null)
  const [busqueda, setBusqueda]       = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando]       = useState(null)   // null = crear, objeto = editar
  const [form, setForm]               = useState(FORM_VACIO)
  const [guardando, setGuardando]     = useState(false)
  const [errForm, setErrForm]         = useState('')

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    try {
      setCargando(true)
      const [resProd, resCat] = await Promise.all([
        productosApi.listar(),
        catalogosApi.categorias(),
      ])
      setProductos(resProd)
      setCategorias(resCat)
    } catch {
      setError('No se pudo cargar los datos. Verificá la conexión.')
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

  function abrirEditar(p) {
    setEditando(p)
    setForm({
      codigo:        p.codigo,
      nombre:        p.nombre,
      unidad_medida: p.unidad_medida,
      id_categoria:  p.id_categoria,
      descripcion:   p.descripcion || '',
    })
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
    if (!form.codigo.trim() || !form.nombre.trim() || !form.id_categoria) {
      setErrForm('Código, nombre y categoría son obligatorios.')
      return
    }
    setGuardando(true)
    setErrForm('')
    try {
      if (editando) {
        const data = await productosApi.actualizar(editando.id, form)
        setProductos(prev => prev.map(p => p.id === editando.id ? data : p))
      } else {
        const data = await productosApi.crear(form)
        setProductos(prev => [...prev, data])
      }
      cerrarModal()
    } catch (err) {
      setErrForm(err.response?.data?.error || 'Error al guardar.')
    } finally {
      setGuardando(false)
    }
  }

  async function desactivar(id, nombre) {
    if (!confirm(`¿Desactivar el producto "${nombre}"?`)) return
    try {
      await productosApi.desactivar(id)
      setProductos(prev => prev.filter(p => p.id !== id))
    } catch {
      alert('No se pudo desactivar el producto.')
    }
  }

  const nombreCategoria = (id) => categorias.find(c => c.id === id)?.nombre || '—'

  const productosFiltrados = productos.filter(p => {
    const coincideBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
                             p.codigo.toLowerCase().includes(busqueda.toLowerCase())
    const coincideCategoria = filtroCategoria === '' || p.id_categoria === Number(filtroCategoria)
    return coincideBusqueda && coincideCategoria
  })

  return (
    <>
      {/* Encabezado */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Productos</h1>
          <p className="page-subtitle">Catálogo de equipos y materiales</p>
        </div>
        <button className="btn btn-primary" onClick={abrirCrear}>
          + Nuevo producto
        </button>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 200 }}
            placeholder="Buscar por nombre o código..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          <select
            className="input"
            style={{ minWidth: 200 }}
            value={filtroCategoria}
            onChange={e => setFiltroCategoria(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {categorias.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className="card">
        {cargando ? (
          <div className="empty-state">Cargando productos...</div>
        ) : error ? (
          <div className="empty-state" style={{ color: 'var(--danger)' }}>{error}</div>
        ) : productosFiltrados.length === 0 ? (
          <div className="empty-state">No se encontraron productos.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Unidad</th>
                  <th>Descripción</th>
                  <th style={{ width: 100 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {productosFiltrados.map(p => (
                  <tr key={p.id}>
                    <td><code style={{ fontSize: 12 }}>{p.codigo}</code></td>
                    <td style={{ fontWeight: 500 }}>{p.nombre}</td>
                    <td>
                      <span className="badge badge-blue">{nombreCategoria(p.id_categoria)}</span>
                    </td>
                    <td className="text-muted text-sm">{p.unidad_medida}</td>
                    <td className="text-muted text-sm" style={{ maxWidth: 250 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.descripcion || '—'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => abrirEditar(p)}
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => desactivar(p.id, p.nombre)}
                          title="Desactivar"
                          style={{ color: 'var(--danger)' }}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="text-muted text-sm" style={{ padding: '10px 0 0' }}>
          {productosFiltrados.length} producto{productosFiltrados.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Modal crear / editar */}
      {modalAbierto && (
        <div className="modal-overlay" onClick={cerrarModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editando ? 'Editar producto' : 'Nuevo producto'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={cerrarModal}>✕</button>
            </div>

            <form onSubmit={guardar}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Código *</label>
                    <input
                      className="input"
                      value={form.codigo}
                      onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
                      placeholder="Ej: CAM-001"
                      maxLength={20}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Unidad de medida *</label>
                    <select
                      className="input"
                      value={form.unidad_medida}
                      onChange={e => setForm(f => ({ ...f, unidad_medida: e.target.value }))}
                    >
                      {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Nombre *</label>
                    <input
                      className="input"
                      value={form.nombre}
                      onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                      placeholder="Ej: Cámara Domo IP 2MP"
                      maxLength={150}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Categoría *</label>
                    <select
                      className="input"
                      value={form.id_categoria}
                      onChange={e => setForm(f => ({ ...f, id_categoria: Number(e.target.value) }))}
                    >
                      <option value="">Seleccioná una categoría</option>
                      {categorias.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Descripción</label>
                    <textarea
                      className="input"
                      rows={3}
                      value={form.descripcion}
                      onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                      placeholder="Detalles técnicos del producto..."
                    />
                  </div>
                </div>

                {errForm && (
                  <div className="alert alert-danger" style={{ marginTop: 12 }}>{errForm}</div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={cerrarModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={guardando}>
                  {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
