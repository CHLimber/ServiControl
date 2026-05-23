import { useState, useEffect } from 'react'
import { proveedoresApi } from '../../api/proveedores'
import { productosApi } from '../../api/productos'
import { Pencil, Trash2, X, Plus, Phone, Package, Star, StarOff } from 'lucide-react'

const DEPARTAMENTOS = [
  'Santa Cruz', 'La Paz', 'Cochabamba', 'Potosí',
  'Chuquisaca', 'Tarija', 'Beni', 'Pando', 'Oruro',
]

const FORM_VACIO = { nombre: '', email: '', direccion: '', departamento: '', telefonos: [''] }
const PROD_FORM_VACIO = { id_producto: '', precio_unitario: '', es_principal: false }

export default function ProveedoresPage() {
  // ── estado principal ──────────────────────────────────────────
  const [proveedores, setProveedores]   = useState([])
  const [cargando, setCargando]         = useState(true)
  const [error, setError]               = useState(null)
  const [busqueda, setBusqueda]         = useState('')
  const [filtroDep, setFiltroDep]       = useState('')

  // ── modal CRUD proveedor (CU13) ───────────────────────────────
  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando]         = useState(null)
  const [form, setForm]                 = useState(FORM_VACIO)
  const [guardando, setGuardando]       = useState(false)
  const [errForm, setErrForm]           = useState('')

  // ── modal catálogo de productos (CU14) ───────────────────────
  const [modalCatalogo, setModalCatalogo]         = useState(null)   // proveedor seleccionado
  const [productosProv, setProductosProv]         = useState([])
  const [cargandoProds, setCargandoProds]         = useState(false)
  const [todosProd, setTodosProd]                 = useState([])     // catálogo completo
  const [formProd, setFormProd]                   = useState(PROD_FORM_VACIO)
  const [editandoProd, setEditandoProd]           = useState(null)   // { id_producto, precio, principal }
  const [guardandoProd, setGuardandoProd]         = useState(false)
  const [errProd, setErrProd]                     = useState('')

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    try {
      setCargando(true)
      setProveedores(await proveedoresApi.listar())
    } catch {
      setError('No se pudo cargar los proveedores.')
    } finally {
      setCargando(false)
    }
  }

  // ── CRUD proveedor ────────────────────────────────────────────
  function abrirCrear() {
    setEditando(null)
    setForm(FORM_VACIO)
    setErrForm('')
    setModalAbierto(true)
  }

  function abrirEditar(p) {
    setEditando(p)
    setForm({
      nombre:       p.nombre,
      email:        p.email || '',
      direccion:    p.direccion || '',
      departamento: p.departamento || '',
      telefonos:    p.telefonos?.length ? p.telefonos.map(t => t.numero) : [''],
    })
    setErrForm('')
    setModalAbierto(true)
  }

  function cerrarModal() {
    setModalAbierto(false)
    setEditando(null)
    setErrForm('')
  }

  function agregarTelefono() {
    setForm(f => ({ ...f, telefonos: [...f.telefonos, ''] }))
  }

  function quitarTelefono(idx) {
    setForm(f => ({ ...f, telefonos: f.telefonos.filter((_, i) => i !== idx) }))
  }

  function cambiarTelefono(idx, valor) {
    setForm(f => { const t = [...f.telefonos]; t[idx] = valor; return { ...f, telefonos: t } })
  }

  async function guardar(e) {
    e.preventDefault()
    if (!form.nombre.trim()) { setErrForm('El nombre es requerido.'); return }
    setGuardando(true); setErrForm('')
    const payload = { ...form, telefonos: form.telefonos.map(t => t.trim()).filter(Boolean) }
    try {
      if (editando) {
        const data = await proveedoresApi.actualizar(editando.id, payload)
        setProveedores(prev => prev.map(p => p.id === editando.id ? data : p))
      } else {
        const data = await proveedoresApi.crear(payload)
        setProveedores(prev => [...prev, data])
      }
      cerrarModal()
    } catch (err) {
      setErrForm(err.response?.data?.error || 'Error al guardar.')
    } finally {
      setGuardando(false)
    }
  }

  async function desactivar(id, nombre) {
    if (!confirm(`¿Desactivar al proveedor "${nombre}"?`)) return
    try {
      await proveedoresApi.desactivar(id)
      setProveedores(prev => prev.filter(p => p.id !== id))
    } catch {
      alert('No se pudo desactivar el proveedor.')
    }
  }

  // ── Catálogo de productos (CU14) ──────────────────────────────
  async function abrirCatalogo(proveedor) {
    setModalCatalogo(proveedor)
    setFormProd(PROD_FORM_VACIO)
    setEditandoProd(null)
    setErrProd('')
    setCargandoProds(true)
    try {
      const [prods, todos] = await Promise.all([
        proveedoresApi.listarProductos(proveedor.id),
        productosApi.listar(),
      ])
      setProductosProv(prods)
      setTodosProd(todos)
    } catch {
      setProductosProv([])
    } finally {
      setCargandoProds(false)
    }
  }

  function cerrarCatalogo() {
    setModalCatalogo(null)
    setProductosProv([])
    setEditandoProd(null)
    setFormProd(PROD_FORM_VACIO)
    setErrProd('')
  }

  // Productos que aún no están vinculados a este proveedor
  const idsVinculados = new Set(productosProv.map(p => p.id_producto))
  const productosDisponibles = todosProd.filter(p => !idsVinculados.has(p.id))

  function iniciarEditarProd(prod) {
    setEditandoProd(prod)
    setFormProd({
      id_producto:     prod.id_producto,
      precio_unitario: String(prod.precio_unitario),
      es_principal:    prod.es_principal,
    })
    setErrProd('')
  }

  function cancelarEditarProd() {
    setEditandoProd(null)
    setFormProd(PROD_FORM_VACIO)
    setErrProd('')
  }

  async function guardarProd(e) {
    e.preventDefault()
    const precio = parseFloat(formProd.precio_unitario)
    if (!precio || precio <= 0) { setErrProd('El precio debe ser mayor a cero.'); return }

    if (!editandoProd && !formProd.id_producto) {
      setErrProd('Seleccioná un producto.'); return
    }
    setGuardandoProd(true); setErrProd('')
    try {
      if (editandoProd) {
        const data = await proveedoresApi.actualizarProducto(
          modalCatalogo.id, editandoProd.id_producto,
          { precio_unitario: precio, es_principal: formProd.es_principal }
        )
        setProductosProv(prev => prev.map(p =>
          p.id_producto === editandoProd.id_producto
            ? { ...p, precio_unitario: data.precio_unitario, es_principal: data.es_principal }
            : p
        ))
        cancelarEditarProd()
      } else {
        const data = await proveedoresApi.agregarProducto(modalCatalogo.id, {
          id_producto:     Number(formProd.id_producto),
          precio_unitario: precio,
          es_principal:    formProd.es_principal,
        })
        setProductosProv(prev => [...prev, data])
        setFormProd(PROD_FORM_VACIO)
      }
    } catch (err) {
      setErrProd(err.response?.data?.error || 'Error al guardar.')
    } finally {
      setGuardandoProd(false)
    }
  }

  async function quitarProd(idProducto, nombre) {
    if (!confirm(`¿Quitar "${nombre}" del catálogo de este proveedor?`)) return
    try {
      await proveedoresApi.quitarProducto(modalCatalogo.id, idProducto)
      setProductosProv(prev => prev.filter(p => p.id_producto !== idProducto))
    } catch {
      alert('No se pudo quitar el producto.')
    }
  }

  // ── filtros tabla principal ───────────────────────────────────
  const filtrados = proveedores.filter(p => {
    const txt = (p.nombre + (p.email || '') + (p.direccion || '')).toLowerCase()
    return txt.includes(busqueda.toLowerCase()) && (filtroDep === '' || p.departamento === filtroDep)
  })

  // ── render ────────────────────────────────────────────────────
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Proveedores</h1>
          <p className="page-subtitle">Empresas y personas que suministran productos al inventario</p>
        </div>
        <button className="btn btn-primary" onClick={abrirCrear}>+ Nuevo proveedor</button>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input className="input" style={{ flex: 1, minWidth: 200 }}
            placeholder="Buscar por nombre, email o dirección..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <select className="input" style={{ minWidth: 180 }}
            value={filtroDep} onChange={e => setFiltroDep(e.target.value)}>
            <option value="">Todos los departamentos</option>
            {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* Tabla proveedores */}
      <div className="card">
        {cargando ? (
          <div className="empty-state">Cargando proveedores...</div>
        ) : error ? (
          <div className="empty-state" style={{ color: 'var(--danger)' }}>{error}</div>
        ) : filtrados.length === 0 ? (
          <div className="empty-state">No se encontraron proveedores.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Departamento</th>
                  <th>Email</th>
                  <th>Teléfonos</th>
                  <th>Dirección</th>
                  <th style={{ width: 110 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500 }}>{p.nombre}</td>
                    <td>
                      {p.departamento
                        ? <span className="badge badge-blue">{p.departamento}</span>
                        : <span className="text-muted">—</span>}
                    </td>
                    <td className="text-sm text-muted">{p.email || '—'}</td>
                    <td className="text-sm text-muted">
                      {p.telefonos?.length ? p.telefonos.map(t => t.numero).join(', ') : '—'}
                    </td>
                    <td className="text-sm text-muted" style={{ maxWidth: 180 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.direccion || '—'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" title="Catálogo de productos"
                          onClick={() => abrirCatalogo(p)}>
                          <Package size={14} />
                        </button>
                        <button className="btn btn-ghost btn-sm" title="Editar"
                          onClick={() => abrirEditar(p)}>
                          <Pencil size={14} />
                        </button>
                        <button className="btn btn-ghost btn-sm" title="Desactivar"
                          style={{ color: 'var(--danger)' }} onClick={() => desactivar(p.id, p.nombre)}>
                          <Trash2 size={14} />
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
          {filtrados.length} proveedor{filtrados.length !== 1 ? 'es' : ''}
        </div>
      </div>

      {/* ── Modal catálogo de productos (CU14) ── */}
      {modalCatalogo && (
        <div className="modal-overlay" onClick={cerrarCatalogo}>
          <div className="modal" style={{ maxWidth: 780 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Catálogo de productos</h2>
                <div className="text-sm text-muted">{modalCatalogo.nombre}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={cerrarCatalogo}><X size={14} /></button>
            </div>

            <div className="modal-body">
              {/* Lista de productos vinculados */}
              {cargandoProds ? (
                <div className="empty-state" style={{ padding: '20px 0' }}>Cargando...</div>
              ) : productosProv.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 0' }}>
                  <Package size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
                  <p>Sin productos asociados. Agregá uno abajo.</p>
                </div>
              ) : (
                <div className="table-wrap" style={{ marginBottom: 24 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Producto</th>
                        <th>Categoría</th>
                        <th>Unidad</th>
                        <th style={{ textAlign: 'right' }}>Precio (Bs)</th>
                        <th style={{ textAlign: 'center' }}>Principal</th>
                        <th style={{ width: 80 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {productosProv.map(prod => (
                        <tr key={prod.id_producto}
                          style={editandoProd?.id_producto === prod.id_producto
                            ? { background: 'var(--bg)' } : {}}>
                          <td><code style={{ fontSize: 12 }}>{prod.codigo}</code></td>

                          {/* Fila en edición */}
                          {editandoProd?.id_producto === prod.id_producto ? (
                            <>
                              <td colSpan={2} style={{ fontWeight: 500 }}>{prod.nombre}</td>
                              <td className="text-sm text-muted">{prod.unidad_medida}</td>
                              <td>
                                <input type="number" className="input" min="0.01" step="0.01"
                                  style={{ textAlign: 'right', width: 100 }}
                                  value={formProd.precio_unitario}
                                  onChange={e => setFormProd(f => ({ ...f, precio_unitario: e.target.value }))} />
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <input type="checkbox" checked={formProd.es_principal}
                                  onChange={e => setFormProd(f => ({ ...f, es_principal: e.target.checked }))} />
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button className="btn btn-primary btn-sm" disabled={guardandoProd}
                                    onClick={guardarProd}>
                                    {guardandoProd ? '...' : 'OK'}
                                  </button>
                                  <button className="btn btn-ghost btn-sm" onClick={cancelarEditarProd}>
                                    <X size={12} />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td style={{ fontWeight: 500 }}>{prod.nombre}</td>
                              <td><span className="badge badge-blue">{prod.categoria}</span></td>
                              <td className="text-sm text-muted">{prod.unidad_medida}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                {prod.precio_unitario.toFixed(2)}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {prod.es_principal
                                  ? <Star size={14} style={{ color: 'var(--warning, #f59e0b)' }} />
                                  : <StarOff size={14} style={{ opacity: 0.3 }} />}
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button className="btn btn-ghost btn-sm" title="Editar precio"
                                    onClick={() => iniciarEditarProd(prod)}><Pencil size={12} /></button>
                                  <button className="btn btn-ghost btn-sm" title="Quitar"
                                    style={{ color: 'var(--danger)' }}
                                    onClick={() => quitarProd(prod.id_producto, prod.nombre)}>
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {errProd && !editandoProd && (
                <div className="alert alert-danger" style={{ marginBottom: 12 }}>{errProd}</div>
              )}

              {/* Formulario agregar producto */}
              {!editandoProd && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <div style={{ fontWeight: 600, marginBottom: 12 }}>Agregar producto</div>
                  <form onSubmit={guardarProd}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <div className="form-group" style={{ flex: 2, minWidth: 200, margin: 0 }}>
                        <label className="form-label">Producto *</label>
                        <select className="input" value={formProd.id_producto}
                          onChange={e => setFormProd(f => ({ ...f, id_producto: e.target.value }))}>
                          <option value="">Seleccioná un producto...</option>
                          {productosDisponibles.map(p => (
                            <option key={p.id} value={p.id}>{p.nombre} ({p.codigo})</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group" style={{ flex: 1, minWidth: 130, margin: 0 }}>
                        <label className="form-label">Precio (Bs) *</label>
                        <input type="number" className="input" min="0.01" step="0.01"
                          placeholder="0.00"
                          value={formProd.precio_unitario}
                          onChange={e => setFormProd(f => ({ ...f, precio_unitario: e.target.value }))} />
                      </div>
                      <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 2 }}>
                        <input type="checkbox" id="chk-principal"
                          checked={formProd.es_principal}
                          onChange={e => setFormProd(f => ({ ...f, es_principal: e.target.checked }))} />
                        <label htmlFor="chk-principal" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>
                          Proveedor principal
                        </label>
                      </div>
                      <button type="submit" className="btn btn-primary" disabled={guardandoProd}
                        style={{ marginBottom: 2 }}>
                        <Plus size={14} /> {guardandoProd ? 'Agregando...' : 'Agregar'}
                      </button>
                    </div>
                    {errProd && (
                      <div className="alert alert-danger" style={{ marginTop: 8 }}>{errProd}</div>
                    )}
                  </form>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <span className="text-muted text-sm">
                {productosProv.length} producto{productosProv.length !== 1 ? 's' : ''} vinculado{productosProv.length !== 1 ? 's' : ''}
              </span>
              <button className="btn btn-ghost" onClick={cerrarCatalogo}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal crear / editar proveedor (CU13) ── */}
      {modalAbierto && (
        <div className="modal-overlay" onClick={cerrarModal}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editando ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>
              <button className="btn btn-ghost btn-sm" onClick={cerrarModal}><X size={14} /></button>
            </div>
            <form onSubmit={guardar}>
              <div className="modal-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Nombre */}
                  <div>
                    <label className="form-label">Nombre *</label>
                    <input className="input" value={form.nombre}
                      onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                      placeholder="Ej: TecnoBolivia SRL" maxLength={150} />
                  </div>

                  {/* Email | Departamento */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label className="form-label">Email</label>
                      <input type="email" className="input" value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="contacto@proveedor.com" maxLength={100} />
                    </div>
                    <div>
                      <label className="form-label">Departamento</label>
                      <select className="input" value={form.departamento}
                        onChange={e => setForm(f => ({ ...f, departamento: e.target.value }))}>
                        <option value="">Sin especificar</option>
                        {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Dirección */}
                  <div>
                    <label className="form-label">Dirección</label>
                    <input className="input" value={form.direccion}
                      onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
                      placeholder="Ej: Av. Cañoto 123, local 5" maxLength={255} />
                  </div>

                  {/* Teléfonos */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <label className="form-label" style={{ margin: 0 }}>
                        <Phone size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                        Teléfonos
                      </label>
                      <button type="button" className="btn btn-ghost btn-sm"
                        onClick={agregarTelefono}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                        <Plus size={12} /> Agregar
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {form.telefonos.map((tel, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input className="input" style={{ flex: 1 }} value={tel}
                            onChange={e => cambiarTelefono(idx, e.target.value)}
                            placeholder="Ej: 78110011" maxLength={20} />
                          {form.telefonos.length > 1 && (
                            <button type="button" className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--danger)', flexShrink: 0 }}
                              onClick={() => quitarTelefono(idx)}>
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {errForm && <div className="alert alert-danger">{errForm}</div>}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={cerrarModal}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={guardando}>
                  {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
