import { useState, useEffect } from 'react'
import { cotizacionesApi } from '../../api/cotizaciones'
import { entidadesApi } from '../../api/entidades'
import { catalogosApi } from '../../api/catalogos'
import { productosApi } from '../../api/productos'
import { Eye, Pencil, X } from 'lucide-react'

const ESTADOS = ['borrador', 'enviada', 'aprobada', 'rechazada', 'vencida']

const BADGE_ESTADO = {
  borrador:  'badge-gray',
  enviada:   'badge-blue',
  aprobada:  'badge-green',
  rechazada: 'badge-red',
  vencida:   'badge-yellow',
}

const FILA_VACIA = { id_producto: '', id_proveedor: '', cantidad: 1, precio_unitario: '', observacion: '' }

function formatBs(n) {
  return `Bs ${Number(n).toLocaleString('es-BO', { minimumFractionDigits: 2 })}`
}

export default function CotizacionesPage({ abrirCrearInicial = false }) {
  const [cotizaciones, setCotizaciones] = useState([])
  const [cargando, setCargando]         = useState(true)
  const [error, setError]               = useState(null)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [busqueda, setBusqueda]         = useState('')

  // Modal lista → detalle
  const [detalle, setDetalle]           = useState(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)

  // Modal crear
  const [modalCrear, setModalCrear]     = useState(false)
  const [clientes, setClientes]         = useState([])
  const [servicios, setServicios]       = useState([])
  const [proveedores, setProveedores]   = useState([])
  const [productos, setProductos]       = useState([])
  const [tiposSistema, setTiposSistema] = useState([])
  const [sistemasCliente, setSistemasCliente] = useState([])
  const [form, setForm]                 = useState({
    id_entidad: '', id_servicio: '', id_sistema: '',
    mano_de_obra: 0, vigencia_dias: 30, observacion: '', detalles: [{ ...FILA_VACIA }],
  })
  const [guardando, setGuardando]       = useState(false)
  const [errForm, setErrForm]           = useState('')

  // Modal editar cotización en borrador (CU16)
  const [modalEditar, setModalEditar]       = useState(null)  // objeto cotizacion o null
  const [formEditar, setFormEditar]         = useState({ mano_de_obra: 0, vigencia_dias: 30, observacion: '', detalles: [] })
  const [guardandoEditar, setGuardandoEditar] = useState(false)
  const [errEditar, setErrEditar]           = useState('')

  // Mini-modal nuevo sistema
  const [modalSistema, setModalSistema] = useState(false)
  const [formSistema, setFormSistema]   = useState({ nombre: '', id_tipo_sistema: '', tiene_mantenimiento: false, periodicidad_dias: '', direccion: '' })
  const [guardandoSistema, setGuardandoSistema] = useState(false)
  const [errSistema, setErrSistema]     = useState('')

  useEffect(() => {
    cargarCotizaciones()
    if (abrirCrearInicial) setModalCrear(true)
  }, [])

  async function cargarCotizaciones() {
    try {
      setCargando(true)
      setCotizaciones(await cotizacionesApi.listar())
    } catch {
      setError('No se pudo cargar las cotizaciones.')
    } finally {
      setCargando(false)
    }
  }

  async function abrirDetalle(id) {
    setCargandoDetalle(true)
    setDetalle({ cargando: true })
    try {
      setDetalle(await cotizacionesApi.obtener(id))
    } catch {
      setDetalle(null)
    } finally {
      setCargandoDetalle(false)
    }
  }

  async function abrirCrear() {
    setForm({ id_entidad: '', id_servicio: '', id_sistema: '', mano_de_obra: 0, vigencia_dias: 30, observacion: '', detalles: [{ ...FILA_VACIA }] })
    setErrForm('')
    setSistemasCliente([])
    setModalCrear(true)

    // Cargar datos de referencia en paralelo
    const [ents, servs, provs, prods, tiposSis] = await Promise.all([
      entidadesApi.listar(),
      catalogosApi.servicios(),
      catalogosApi.proveedores(),
      productosApi.listar(),
      catalogosApi.tiposSistema(),
    ])
    setClientes(ents.filter(e => e.cliente))
    setServicios(servs)
    setProveedores(provs)
    setProductos(prods)
    setTiposSistema(tiposSis)
  }

  async function onCambiarCliente(id_entidad) {
    setForm(f => ({ ...f, id_entidad, id_sistema: '' }))
    setSistemasCliente([])
    if (!id_entidad) return
    try {
      setSistemasCliente(await cotizacionesApi.sistemasPorEntidad(id_entidad))
    } catch {
      setSistemasCliente([])
    }
  }

  async function guardarSistema(e) {
    e.preventDefault()
    if (!formSistema.nombre || !formSistema.id_tipo_sistema) {
      setErrSistema('Nombre y tipo de sistema son obligatorios.')
      return
    }
    setGuardandoSistema(true)
    setErrSistema('')
    try {
      const nuevo = await cotizacionesApi.crearSistema(form.id_entidad, formSistema)
      setSistemasCliente(prev => [...prev, nuevo])
      setForm(f => ({ ...f, id_sistema: nuevo.id }))
      setModalSistema(false)
      setFormSistema({ nombre: '', id_tipo_sistema: '', tiene_mantenimiento: false, periodicidad_dias: '', direccion: '' })
    } catch (err) {
      setErrSistema(err.error || 'Error al crear el sistema.')
    } finally {
      setGuardandoSistema(false)
    }
  }

  // Manejo de filas de detalle
  function agregarFila() {
    setForm(f => ({ ...f, detalles: [...f.detalles, { ...FILA_VACIA }] }))
  }

  function eliminarFila(idx) {
    setForm(f => ({ ...f, detalles: f.detalles.filter((_, i) => i !== idx) }))
  }

  function actualizarFila(idx, campo, valor) {
    setForm(f => {
      const detalles = f.detalles.map((d, i) => i === idx ? { ...d, [campo]: valor } : d)
      return { ...f, detalles }
    })
  }

  function subtotalFila(fila) {
    const c = parseFloat(fila.cantidad) || 0
    const p = parseFloat(fila.precio_unitario) || 0
    return c * p
  }

  const subtotalProductos = form.detalles.reduce((s, f) => s + subtotalFila(f), 0)
  const total = subtotalProductos + (parseFloat(form.mano_de_obra) || 0)

  async function guardar(e) {
    e.preventDefault()
    if (!form.id_entidad || !form.id_servicio || !form.id_sistema) {
      setErrForm('Cliente, servicio y sistema son obligatorios.')
      return
    }
    const detallesValidos = form.detalles.filter(d => d.id_producto && d.id_proveedor && d.cantidad > 0 && d.precio_unitario > 0)
    if (detallesValidos.length === 0) {
      setErrForm('Agregá al menos un producto con cantidad y precio.')
      return
    }
    setGuardando(true)
    setErrForm('')
    try {
      const nueva = await cotizacionesApi.crear({ ...form, detalles: detallesValidos })
      setCotizaciones(prev => [nueva, ...prev])
      setModalCrear(false)
    } catch (err) {
      setErrForm(err.error || 'Error al crear la cotización.')
    } finally {
      setGuardando(false)
    }
  }

  // CU16 — abrir edición de cotización en borrador
  async function abrirEditar(cot) {
    setFormEditar({
      mano_de_obra:  cot.mano_de_obra,
      vigencia_dias: cot.vigencia_dias,
      observacion:   cot.observacion || '',
      detalles: (cot.detalles || []).map(d => ({
        id_producto:    d.id_producto,
        id_proveedor:   d.id_proveedor,
        cantidad:       d.cantidad,
        precio_unitario: d.precio_unitario,
        observacion:    d.observacion || '',
      })),
    })
    setErrEditar('')
    setModalEditar(cot)
    if (productos.length === 0 || proveedores.length === 0) {
      const [provs, prods] = await Promise.all([catalogosApi.proveedores(), productosApi.listar()])
      if (proveedores.length === 0) setProveedores(provs)
      if (productos.length === 0)   setProductos(prods)
    }
  }

  function agregarFilaEditar() {
    setFormEditar(f => ({ ...f, detalles: [...f.detalles, { ...FILA_VACIA }] }))
  }
  function eliminarFilaEditar(idx) {
    setFormEditar(f => ({ ...f, detalles: f.detalles.filter((_, i) => i !== idx) }))
  }
  function actualizarFilaEditar(idx, campo, valor) {
    setFormEditar(f => ({
      ...f,
      detalles: f.detalles.map((d, i) => i === idx ? { ...d, [campo]: valor } : d),
    }))
  }

  async function guardarEdicion(e) {
    e.preventDefault()
    const detallesValidos = formEditar.detalles.filter(
      d => d.id_producto && d.id_proveedor && d.cantidad > 0 && d.precio_unitario > 0
    )
    if (detallesValidos.length === 0) {
      setErrEditar('Agregá al menos un producto con cantidad y precio.')
      return
    }
    setGuardandoEditar(true)
    setErrEditar('')
    try {
      await cotizacionesApi.actualizar(modalEditar.id, {
        mano_de_obra:  formEditar.mano_de_obra,
        vigencia_dias: formEditar.vigencia_dias,
        observacion:   formEditar.observacion,
      })
      const actualizada = await cotizacionesApi.editarDetalles(modalEditar.id, { detalles: detallesValidos })
      setCotizaciones(prev => prev.map(c => c.id === modalEditar.id ? actualizada : c))
      if (detalle?.id === modalEditar.id) setDetalle(actualizada)
      setModalEditar(null)
    } catch (err) {
      setErrEditar(err.error || 'Error al guardar.')
    } finally {
      setGuardandoEditar(false)
    }
  }

  async function cambiarEstado(id, estado) {
    try {
      const actualizada = await cotizacionesApi.cambiarEstado(id, estado)
      setCotizaciones(prev => prev.map(c => c.id === id ? actualizada : c))
      if (detalle?.id === id) setDetalle(d => ({ ...d, estado }))
    } catch {
      alert('No se pudo cambiar el estado.')
    }
  }

  const filtradas = cotizaciones.filter(c => {
    const coincideEstado = filtroEstado === '' || c.estado === filtroEstado
    const coincideBusqueda = c.codigo.toLowerCase().includes(busqueda.toLowerCase())
    return coincideEstado && coincideBusqueda
  })

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cotizaciones</h1>
          <p className="page-subtitle">Propuestas comerciales a clientes</p>
        </div>
        <button className="btn btn-primary" onClick={abrirCrear}>+ Nueva cotización</button>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input className="input" style={{ flex: 1, minWidth: 180 }}
            placeholder="Buscar por código..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <select className="input" style={{ minWidth: 160 }}
            value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className="card">
        {cargando ? (
          <div className="empty-state">Cargando cotizaciones...</div>
        ) : error ? (
          <div className="empty-state" style={{ color: 'var(--danger)' }}>{error}</div>
        ) : filtradas.length === 0 ? (
          <div className="empty-state">No hay cotizaciones.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Estado</th>
                  <th>Total</th>
                  <th>Vigencia</th>
                  <th>Fecha</th>
                  <th style={{ width: 80 }}>Ver</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>{c.codigo}</td>
                    <td><span className={`badge ${BADGE_ESTADO[c.estado] || 'badge-gray'}`}>{c.estado}</span></td>
                    <td>{formatBs(c.total)}</td>
                    <td className="text-sm text-muted">{c.vigencia_dias} días</td>
                    <td className="text-sm text-muted">
                      {c.fecha_creacion ? new Date(c.fecha_creacion).toLocaleDateString('es-BO') : '—'}
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => abrirDetalle(c.id)}><Eye size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="text-muted text-sm" style={{ padding: '10px 0 0' }}>
          {filtradas.length} cotización{filtradas.length !== 1 ? 'es' : ''}
        </div>
      </div>

      {/* Modal detalle */}
      {detalle && (
        <div className="modal-overlay" onClick={() => setDetalle(null)}>
          <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {detalle.cargando ? 'Cargando...' : detalle.codigo}
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setDetalle(null)}><X size={14} /></button>
            </div>
            {!detalle.cargando && (
              <>
                <div className="modal-body">
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                    <span className={`badge ${BADGE_ESTADO[detalle.estado] || 'badge-gray'}`}>{detalle.estado}</span>
                    <span className="text-muted text-sm">Vigencia: {detalle.vigencia_dias} días</span>
                  </div>
                  {detalle.observacion && (
                    <p className="text-sm text-muted" style={{ marginBottom: 16 }}>{detalle.observacion}</p>
                  )}
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Proveedor</th>
                          <th style={{ width: 70 }}>Cant.</th>
                          <th style={{ width: 110 }}>P. Unit.</th>
                          <th style={{ width: 110 }}>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detalle.detalles || []).map((d, i) => (
                          <tr key={i}>
                            <td className="text-sm">{d.nombre_producto || `Prod. #${d.id_producto}`}</td>
                            <td className="text-sm text-muted">{d.nombre_proveedor || `Prov. #${d.id_proveedor}`}</td>
                            <td className="text-sm">{d.cantidad}</td>
                            <td className="text-sm">{formatBs(d.precio_unitario)}</td>
                            <td className="text-sm">{formatBs(d.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: 16, textAlign: 'right' }}>
                    <div className="text-sm text-muted">Subtotal productos: {formatBs(detalle.subtotal_productos)}</div>
                    <div className="text-sm text-muted">Mano de obra: {formatBs(detalle.mano_de_obra)}</div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', marginTop: 4 }}>Total: {formatBs(detalle.total)}</div>
                  </div>
                </div>
                {detalle.estado === 'borrador' && (
                  <div className="modal-footer">
                    <button className="btn btn-ghost" onClick={() => abrirEditar(detalle)}>
                      <Pencil size={14} style={{ marginRight: 6 }} />Editar
                    </button>
                    <button className="btn btn-ghost" onClick={() => cambiarEstado(detalle.id, 'enviada')}>
                      Marcar como enviada
                    </button>
                    <button className="btn btn-ghost" style={{ color: 'var(--danger)' }}
                      onClick={() => cambiarEstado(detalle.id, 'rechazada')}>
                      Rechazar
                    </button>
                  </div>
                )}
                {detalle.estado === 'enviada' && (
                  <div className="modal-footer">
                    <button className="btn btn-primary" onClick={() => cambiarEstado(detalle.id, 'aprobada')}>
                      Aprobar
                    </button>
                    <button className="btn btn-ghost" style={{ color: 'var(--danger)' }}
                      onClick={() => cambiarEstado(detalle.id, 'rechazada')}>
                      Rechazar
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Mini-modal nuevo sistema */}
      {modalSistema && (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setModalSistema(false)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nuevo sistema</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalSistema(false)}><X size={14} /></button>
            </div>
            <form onSubmit={guardarSistema}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nombre del sistema *</label>
                  <input className="input" value={formSistema.nombre}
                    onChange={e => setFormSistema(f => ({ ...f, nombre: e.target.value }))}
                    placeholder="Ej: CCTV Oficina Principal" />
                </div>
                <div className="form-group">
                  <label className="form-label">Tipo de sistema *</label>
                  <select className="input" value={formSistema.id_tipo_sistema}
                    onChange={e => setFormSistema(f => ({ ...f, id_tipo_sistema: Number(e.target.value) || '' }))}>
                    <option value="">Seleccioná</option>
                    {tiposSistema.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Dirección del establecimiento</label>
                  <input className="input" value={formSistema.direccion}
                    onChange={e => setFormSistema(f => ({ ...f, direccion: e.target.value }))}
                    placeholder="Solo requerida si el cliente no tiene establecimientos" />
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={formSistema.tiene_mantenimiento}
                      onChange={e => setFormSistema(f => ({ ...f, tiene_mantenimiento: e.target.checked }))} />
                    <span className="form-label" style={{ margin: 0 }}>Requiere mantenimiento periódico</span>
                  </label>
                </div>
                {formSistema.tiene_mantenimiento && (
                  <div className="form-group">
                    <label className="form-label">Periodicidad (días)</label>
                    <input type="number" className="input" min="1" value={formSistema.periodicidad_dias}
                      onChange={e => setFormSistema(f => ({ ...f, periodicidad_dias: e.target.value }))}
                      placeholder="Ej: 90" />
                  </div>
                )}
                {errSistema && <div className="alert alert-danger">{errSistema}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModalSistema(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={guardandoSistema}>
                  {guardandoSistema ? 'Guardando...' : 'Crear sistema'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal crear */}
      {modalCrear && (
        <div className="modal-overlay" onClick={() => setModalCrear(false)}>
          <div className="modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nueva cotización</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalCrear(false)}><X size={14} /></button>
            </div>
            <form onSubmit={guardar}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Cliente *</label>
                    <select className="input" value={form.id_entidad}
                      onChange={e => onCambiarCliente(Number(e.target.value) || '')}>
                      <option value="">Seleccioná un cliente</option>
                      {clientes.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Servicio *</label>
                    <select className="input" value={form.id_servicio}
                      onChange={e => setForm(f => ({ ...f, id_servicio: Number(e.target.value) || '' }))}>
                      <option value="">Seleccioná un servicio</option>
                      {servicios.map(s => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Sistema del cliente *</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select className="input" value={form.id_sistema}
                        onChange={e => setForm(f => ({ ...f, id_sistema: Number(e.target.value) || '' }))}
                        disabled={!form.id_entidad}>
                        <option value="">
                          {form.id_entidad
                            ? sistemasCliente.length === 0 ? 'Sin sistemas — creá uno con +' : 'Seleccioná un sistema'
                            : 'Primero seleccioná un cliente'}
                        </option>
                        {sistemasCliente.map(s => (
                          <option key={s.id} value={s.id}>{s.nombre || `Sistema #${s.id}`}</option>
                        ))}
                      </select>
                      <button type="button" className="btn btn-ghost"
                        title="Registrar nuevo sistema"
                        disabled={!form.id_entidad}
                        onClick={() => { setErrSistema(''); setModalSistema(true) }}>
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tabla de productos */}
                <div style={{ margin: '20px 0 8px', fontWeight: 600, fontSize: '0.9rem' }}>Productos</div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Proveedor</th>
                        <th style={{ width: 80 }}>Cantidad</th>
                        <th style={{ width: 120 }}>P. Unitario</th>
                        <th style={{ width: 110 }}>Subtotal</th>
                        <th style={{ width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.detalles.map((fila, idx) => (
                        <tr key={idx}>
                          <td>
                            <select className="input" value={fila.id_producto}
                              onChange={e => actualizarFila(idx, 'id_producto', Number(e.target.value) || '')}>
                              <option value="">Seleccioná</option>
                              {productos.map(p => (
                                <option key={p.id} value={p.id}>{p.nombre}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select className="input" value={fila.id_proveedor}
                              onChange={e => actualizarFila(idx, 'id_proveedor', Number(e.target.value) || '')}>
                              <option value="">Seleccioná</option>
                              {proveedores.map(p => (
                                <option key={p.id} value={p.id}>{p.nombre}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input type="number" className="input" min="0.01" step="0.01"
                              value={fila.cantidad}
                              onChange={e => actualizarFila(idx, 'cantidad', e.target.value)} />
                          </td>
                          <td>
                            <input type="number" className="input" min="0" step="0.01"
                              placeholder="0.00"
                              value={fila.precio_unitario}
                              onChange={e => actualizarFila(idx, 'precio_unitario', e.target.value)} />
                          </td>
                          <td className="text-sm" style={{ textAlign: 'right' }}>
                            {formatBs(subtotalFila(fila))}
                          </td>
                          <td>
                            {form.detalles.length > 1 && (
                              <button type="button" className="btn btn-ghost btn-sm"
                                style={{ color: 'var(--danger)' }}
                                onClick={() => eliminarFila(idx)}><X size={14} /></button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }}
                  onClick={agregarFila}>
                  + Agregar producto
                </button>

                {/* Totales y otros campos */}
                <div className="form-grid" style={{ marginTop: 20 }}>
                  <div className="form-group">
                    <label className="form-label">Mano de obra (Bs)</label>
                    <input type="number" className="input" min="0" step="0.01"
                      value={form.mano_de_obra}
                      onChange={e => setForm(f => ({ ...f, mano_de_obra: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vigencia (días)</label>
                    <input type="number" className="input" min="1"
                      value={form.vigencia_dias}
                      onChange={e => setForm(f => ({ ...f, vigencia_dias: Number(e.target.value) }))} />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Observación</label>
                    <textarea className="input" rows={2} value={form.observacion}
                      onChange={e => setForm(f => ({ ...f, observacion: e.target.value }))} />
                  </div>
                </div>

                {/* Resumen */}
                <div style={{ textAlign: 'right', marginTop: 8 }}>
                  <div className="text-sm text-muted">Subtotal productos: {formatBs(subtotalProductos)}</div>
                  <div className="text-sm text-muted">Mano de obra: {formatBs(form.mano_de_obra || 0)}</div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', marginTop: 4 }}>
                    Total: {formatBs(total)}
                  </div>
                </div>

                {errForm && <div className="alert alert-danger" style={{ marginTop: 12 }}>{errForm}</div>}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModalCrear(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Crear cotización'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal editar cotización borrador — CU16 */}
      {modalEditar && (
        <div className="modal-overlay" onClick={() => setModalEditar(null)}>
          <div className="modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Editar cotización — {modalEditar.codigo}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalEditar(null)}><X size={14} /></button>
            </div>
            <form onSubmit={guardarEdicion}>
              <div className="modal-body">

                {/* Tabla de productos */}
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '0.9rem' }}>Productos</div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Proveedor</th>
                        <th style={{ width: 80 }}>Cantidad</th>
                        <th style={{ width: 120 }}>P. Unitario</th>
                        <th style={{ width: 110 }}>Subtotal</th>
                        <th style={{ width: 40 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formEditar.detalles.map((fila, idx) => (
                        <tr key={idx}>
                          <td>
                            <select className="input" value={fila.id_producto}
                              onChange={e => actualizarFilaEditar(idx, 'id_producto', Number(e.target.value) || '')}>
                              <option value="">Seleccioná</option>
                              {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select>
                          </td>
                          <td>
                            <select className="input" value={fila.id_proveedor}
                              onChange={e => actualizarFilaEditar(idx, 'id_proveedor', Number(e.target.value) || '')}>
                              <option value="">Seleccioná</option>
                              {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select>
                          </td>
                          <td>
                            <input type="number" className="input" min="0.01" step="0.01"
                              value={fila.cantidad}
                              onChange={e => actualizarFilaEditar(idx, 'cantidad', e.target.value)} />
                          </td>
                          <td>
                            <input type="number" className="input" min="0" step="0.01"
                              value={fila.precio_unitario}
                              onChange={e => actualizarFilaEditar(idx, 'precio_unitario', e.target.value)} />
                          </td>
                          <td className="text-sm" style={{ textAlign: 'right' }}>
                            {formatBs(subtotalFila(fila))}
                          </td>
                          <td>
                            {formEditar.detalles.length > 1 && (
                              <button type="button" className="btn btn-ghost btn-sm"
                                style={{ color: 'var(--danger)' }}
                                onClick={() => eliminarFilaEditar(idx)}><X size={14} /></button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }}
                  onClick={agregarFilaEditar}>
                  + Agregar producto
                </button>

                <div className="form-grid" style={{ marginTop: 20 }}>
                  <div className="form-group">
                    <label className="form-label">Mano de obra (Bs)</label>
                    <input type="number" className="input" min="0" step="0.01"
                      value={formEditar.mano_de_obra}
                      onChange={e => setFormEditar(f => ({ ...f, mano_de_obra: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vigencia (días)</label>
                    <input type="number" className="input" min="1"
                      value={formEditar.vigencia_dias}
                      onChange={e => setFormEditar(f => ({ ...f, vigencia_dias: Number(e.target.value) }))} />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Observación</label>
                    <textarea className="input" rows={2} value={formEditar.observacion}
                      onChange={e => setFormEditar(f => ({ ...f, observacion: e.target.value }))} />
                  </div>
                </div>

                <div style={{ textAlign: 'right', marginTop: 8 }}>
                  <div className="text-sm text-muted">
                    Subtotal productos: {formatBs(formEditar.detalles.reduce((s, f) => s + subtotalFila(f), 0))}
                  </div>
                  <div className="text-sm text-muted">
                    Mano de obra: {formatBs(formEditar.mano_de_obra || 0)}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', marginTop: 4 }}>
                    Total: {formatBs(
                      formEditar.detalles.reduce((s, f) => s + subtotalFila(f), 0) +
                      (parseFloat(formEditar.mano_de_obra) || 0)
                    )}
                  </div>
                </div>

                {errEditar && <div className="alert alert-danger" style={{ marginTop: 12 }}>{errEditar}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModalEditar(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={guardandoEditar}>
                  {guardandoEditar ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
