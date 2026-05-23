import { useState, useEffect } from 'react'
import { ordenesApi } from '../../api/ordenes'
import { proyectosApi } from '../../api/proyectos'
import { catalogosApi } from '../../api/catalogos'
import { Eye, RefreshCw, Pencil, Star, Users, Package, X } from 'lucide-react'

const BADGE_ESTADO = {
  'Pendiente':   'badge-gray',
  'Asignada':    'badge-blue',
  'En proceso':  'badge-yellow',
  'Completada':  'badge-green',
  'Cancelada':   'badge-red',
}

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-BO')
}

function formatFechaHora(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-BO')
}

export default function OrdenesPage({ abrirCrearInicial = false }) {
  const [ordenes, setOrdenes]       = useState([])
  const [cargando, setCargando]     = useState(true)
  const [error, setError]           = useState(null)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [busqueda, setBusqueda]     = useState('')

  // Detalle (CU25 + CU27)
  const [detalle, setDetalle]               = useState(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [modoConsumo, setModoConsumo]       = useState(false)
  const [consumos, setConsumos]             = useState([])
  const [guardandoConsumo, setGuardandoConsumo] = useState(false)

  // Modal crear
  const [modalCrear, setModalCrear] = useState(false)
  const [estados, setEstados]       = useState([])
  const [proyectos, setProyectos]   = useState([])
  const [servicios, setServicios]   = useState([])
  const [empleados, setEmpleados]   = useState([])
  const [productos, setProductos]   = useState([])
  const [form, setForm]             = useState({
    id_proyecto: '', id_servicio: '', id_estado_orden: '',
    descripcion: '', fecha_ejecucion: '', tiempo_estimado: '', observaciones: '',
    empleados: [], productos: [],
  })
  const [guardando, setGuardando]   = useState(false)
  const [errForm, setErrForm]       = useState('')

  // Modal editar personal — CU23
  const [modalEditPersonal, setModalEditPersonal]   = useState(false)
  const [editEmpleados, setEditEmpleados]           = useState([])
  const [guardandoPersonal, setGuardandoPersonal]   = useState(false)

  // Modal editar materiales — CU24
  const [modalEditMateriales, setModalEditMateriales] = useState(false)
  const [editProductos, setEditProductos]             = useState([])
  const [guardandoMat, setGuardandoMat]               = useState(false)

  // Modal cambio estado
  const [modalEstado, setModalEstado] = useState(null)
  const [nuevoEstado, setNuevoEstado] = useState('')
  const [obsEstado, setObsEstado]   = useState('')

  useEffect(() => {
    cargarOrdenes()
    if (abrirCrearInicial) setModalCrear(true)
  }, [])

  async function cargarOrdenes() {
    try {
      setCargando(true)
      setOrdenes(await ordenesApi.listar())
    } catch {
      setError('No se pudo cargar las órdenes.')
    } finally {
      setCargando(false)
    }
  }

  // CU27 — abre detalle con historial completo; también carga productos para CU25
  async function abrirDetalle(o) {
    setDetalle({ ...o, historial: null, productos: null })
    setModoConsumo(false)
    setCargandoDetalle(true)
    try {
      const full = await ordenesApi.obtener(o.id)
      setDetalle(full)
      setConsumos((full.productos || []).map(p => ({
        id_producto: p.id_producto,
        cantidad_usada: p.cantidad_usada ?? '',
        observacion: p.observacion ?? '',
      })))
    } catch {
      // muestra lo que ya tenemos
    } finally {
      setCargandoDetalle(false)
    }
  }

  async function abrirModalEstado(o) {
    setModalEstado(o)
    setNuevoEstado('')
    setObsEstado('')
    if (estados.length === 0) {
      const ests = await ordenesApi.estados()
      setEstados(ests)
    }
  }

  // CU25 — guarda el consumo real de materiales
  async function guardarConsumo() {
    setGuardandoConsumo(true)
    try {
      const actualizada = await ordenesApi.reportarConsumo(detalle.id, { consumos })
      setDetalle(actualizada)
      setOrdenes(prev => prev.map(o => o.id === actualizada.id ? actualizada : o))
      setModoConsumo(false)
    } catch {
      alert('No se pudo guardar el consumo.')
    } finally {
      setGuardandoConsumo(false)
    }
  }

  function actualizarConsumo(id_producto, campo, valor) {
    setConsumos(prev => prev.map(c =>
      c.id_producto === id_producto ? { ...c, [campo]: valor } : c
    ))
  }

  async function abrirCrear() {
    setForm({ id_proyecto: '', id_servicio: '', id_estado_orden: '',
              descripcion: '', fecha_ejecucion: '', tiempo_estimado: '', observaciones: '',
              empleados: [], productos: [] })
    setErrForm('')
    setModalCrear(true)
    const [ests, proys, servs, emps, prods] = await Promise.all([
      ordenesApi.estados(),
      proyectosApi.listar(),
      catalogosApi.servicios(),
      catalogosApi.empleados(),
      catalogosApi.categorias().then(() => import('../../api/productos').then(m => m.productosApi.listar())),
    ])
    setEstados(ests)
    setProyectos(proys)
    setServicios(servs)
    setEmpleados(emps)
    setProductos(prods)
    if (ests.length > 0) setForm(f => ({ ...f, id_estado_orden: ests[0].id }))
  }

  function toggleEmpleado(id_empleado) {
    setForm(f => {
      const existe = f.empleados.find(e => e.id_empleado === id_empleado)
      if (existe) return { ...f, empleados: f.empleados.filter(e => e.id_empleado !== id_empleado) }
      return { ...f, empleados: [...f.empleados, { id_empleado, es_responsable: f.empleados.length === 0 }] }
    })
  }

  function toggleResponsable(id_empleado) {
    setForm(f => ({
      ...f,
      empleados: f.empleados.map(e => ({ ...e, es_responsable: e.id_empleado === id_empleado }))
    }))
  }

  function agregarProducto() {
    setForm(f => ({ ...f, productos: [...f.productos, { id_producto: '', cantidad_asignada: 1 }] }))
  }

  function actualizarProducto(idx, campo, valor) {
    setForm(f => ({
      ...f,
      productos: f.productos.map((p, i) => i === idx ? { ...p, [campo]: valor } : p)
    }))
  }

  function quitarProducto(idx) {
    setForm(f => ({ ...f, productos: f.productos.filter((_, i) => i !== idx) }))
  }

  async function guardar(e) {
    e.preventDefault()
    if (!form.id_proyecto || !form.id_servicio || !form.id_estado_orden) {
      setErrForm('Proyecto, servicio y estado son obligatorios.')
      return
    }
    setGuardando(true)
    setErrForm('')
    try {
      const productosValidos = form.productos.filter(p => p.id_producto && p.cantidad_asignada > 0)
      const nueva = await ordenesApi.crear({ ...form, productos: productosValidos })
      setOrdenes(prev => [nueva, ...prev])
      setModalCrear(false)
    } catch (err) {
      setErrForm(err.error || 'Error al crear la orden.')
    } finally {
      setGuardando(false)
    }
  }

  // CU23 — abrir modal editar personal
  async function abrirEditPersonal() {
    setEditEmpleados((detalle?.empleados || []).map(e => ({ ...e })))
    setModalEditPersonal(true)
    if (empleados.length === 0) {
      const emps = await catalogosApi.empleados()
      setEmpleados(emps)
    }
  }

  function toggleEditEmpleado(id_empleado) {
    setEditEmpleados(prev => {
      const existe = prev.find(e => e.id_empleado === id_empleado)
      if (existe) return prev.filter(e => e.id_empleado !== id_empleado)
      return [...prev, { id_empleado, es_responsable: prev.length === 0 }]
    })
  }

  function toggleEditResponsable(id_empleado) {
    setEditEmpleados(prev => prev.map(e => ({ ...e, es_responsable: e.id_empleado === id_empleado })))
  }

  async function guardarPersonal() {
    setGuardandoPersonal(true)
    try {
      const actualizada = await ordenesApi.actualizarEmpleados(detalle.id, { empleados: editEmpleados })
      setDetalle(actualizada)
      setOrdenes(prev => prev.map(o => o.id === actualizada.id ? actualizada : o))
      setModalEditPersonal(false)
    } catch {
      alert('No se pudo actualizar el personal.')
    } finally {
      setGuardandoPersonal(false)
    }
  }

  // CU24 — abrir modal editar materiales
  async function abrirEditMateriales() {
    setEditProductos((detalle?.productos || []).map(p => ({
      id_producto: p.id_producto,
      cantidad_asignada: p.cantidad_asignada,
    })))
    setModalEditMateriales(true)
    if (productos.length === 0) {
      const prods = await import('../../api/productos').then(m => m.productosApi.listar())
      setProductos(prods)
    }
  }

  function agregarEditProducto() {
    setEditProductos(prev => [...prev, { id_producto: '', cantidad_asignada: 1 }])
  }

  function actualizarEditProducto(idx, campo, valor) {
    setEditProductos(prev => prev.map((p, i) => i === idx ? { ...p, [campo]: valor } : p))
  }

  function quitarEditProducto(idx) {
    setEditProductos(prev => prev.filter((_, i) => i !== idx))
  }

  async function guardarMateriales() {
    const validos = editProductos.filter(p => p.id_producto && p.cantidad_asignada > 0)
    setGuardandoMat(true)
    try {
      const actualizada = await ordenesApi.actualizarMateriales(detalle.id, { productos: validos })
      setDetalle(actualizada)
      setConsumos((actualizada.productos || []).map(p => ({
        id_producto: p.id_producto,
        cantidad_usada: p.cantidad_usada ?? '',
        observacion: p.observacion ?? '',
      })))
      setOrdenes(prev => prev.map(o => o.id === actualizada.id ? actualizada : o))
      setModalEditMateriales(false)
    } catch {
      alert('No se pudo actualizar los materiales.')
    } finally {
      setGuardandoMat(false)
    }
  }

  async function cambiarEstado(e) {
    e.preventDefault()
    if (!nuevoEstado) return
    try {
      const actualizada = await ordenesApi.actualizar(modalEstado.id, {
        id_estado_orden: Number(nuevoEstado),
        observacion_cambio: obsEstado,
      })
      setOrdenes(prev => prev.map(o => o.id === modalEstado.id ? actualizada : o))
      if (detalle?.id === modalEstado.id) setDetalle(actualizada)
      setModalEstado(null)
    } catch {
      alert('No se pudo cambiar el estado.')
    }
  }

  const nombresEstado = [...new Set(ordenes.map(o => o.estado_nombre).filter(Boolean))]
  const filtradas = ordenes.filter(o => {
    const coincideEstado = filtroEstado === '' || o.estado_nombre === filtroEstado
    const coincideBusqueda = o.codigo.toLowerCase().includes(busqueda.toLowerCase())
    return coincideEstado && coincideBusqueda
  })

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Órdenes de trabajo</h1>
          <p className="page-subtitle">Asignación y seguimiento de tareas técnicas</p>
        </div>
        <button className="btn btn-primary" onClick={abrirCrear}>+ Nueva OT</button>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input className="input" style={{ flex: 1, minWidth: 180 }}
            placeholder="Buscar por código..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <select className="input" style={{ minWidth: 180 }}
            value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            {nombresEstado.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className="card">
        {cargando ? (
          <div className="empty-state">Cargando órdenes...</div>
        ) : error ? (
          <div className="empty-state" style={{ color: 'var(--danger)' }}>{error}</div>
        ) : filtradas.length === 0 ? (
          <div className="empty-state">No hay órdenes de trabajo.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Estado</th>
                  <th>Proyecto</th>
                  <th>Ejecución</th>
                  <th>Horas est.</th>
                  <th style={{ width: 110 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(o => (
                  <tr key={o.id}>
                    <td><code style={{ fontSize: 12 }}>{o.codigo}</code></td>
                    <td>
                      <span className={`badge ${BADGE_ESTADO[o.estado_nombre] || 'badge-gray'}`}>
                        {o.estado_nombre || '—'}
                      </span>
                    </td>
                    <td className="text-sm text-muted">Proy. #{o.id_proyecto}</td>
                    <td className="text-sm text-muted">{formatFecha(o.fecha_ejecucion)}</td>
                    <td className="text-sm text-muted">{o.tiempo_estimado ? `${o.tiempo_estimado}h` : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => abrirDetalle(o)} title="Ver detalle e historial"><Eye size={14} /></button>
                        <button className="btn btn-ghost btn-sm" title="Cambiar estado"
                          onClick={() => abrirModalEstado(o)}><RefreshCw size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="text-muted text-sm" style={{ padding: '10px 0 0' }}>
          {filtradas.length} orden{filtradas.length !== 1 ? 'es' : ''}
        </div>
      </div>

      {/* ── Modal detalle: historial (CU27) + consumo (CU25) ── */}
      {detalle && (
        <div className="modal-overlay" onClick={() => { setDetalle(null); setModoConsumo(false) }}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">{detalle.codigo}</h2>
                <span className={`badge ${BADGE_ESTADO[detalle.estado_nombre] || 'badge-gray'}`}>
                  {detalle.estado_nombre}
                </span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => { setDetalle(null); setModoConsumo(false) }}><X size={14} /></button>
            </div>

            <div className="modal-body">
              {/* Info básica */}
              <div className="form-grid" style={{ marginBottom: 16 }}>
                <div>
                  <div className="text-sm text-muted">Proyecto</div>
                  <div style={{ fontWeight: 500 }}>#{detalle.id_proyecto}</div>
                </div>
                <div>
                  <div className="text-sm text-muted">Ejecución</div>
                  <div style={{ fontWeight: 500 }}>{formatFecha(detalle.fecha_ejecucion)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted">Horas estimadas</div>
                  <div style={{ fontWeight: 500 }}>{detalle.tiempo_estimado ? `${detalle.tiempo_estimado}h` : '—'}</div>
                </div>
              </div>
              {detalle.descripcion && (
                <p className="text-sm" style={{ marginBottom: 16 }}>{detalle.descripcion}</p>
              )}

              {/* CU23 — Personal asignado */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users size={15} /> Personal asignado
                </div>
                <button className="btn btn-ghost btn-sm" onClick={abrirEditPersonal}>
                  <Pencil size={13} style={{ marginRight: 4 }} />Editar personal
                </button>
              </div>
              {cargandoDetalle ? (
                <div className="text-muted text-sm" style={{ marginBottom: 16 }}>Cargando...</div>
              ) : !detalle.empleados || detalle.empleados.length === 0 ? (
                <div className="text-muted text-sm" style={{ marginBottom: 16 }}>Sin personal asignado.</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                  {detalle.empleados.map(e => (
                    <span key={e.id_empleado} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', borderRadius: 20, fontSize: '0.82rem',
                      background: 'var(--bg)', border: '1px solid var(--border)',
                    }}>
                      {e.nombre_empleado}
                      {e.es_responsable && <Star size={11} fill="var(--accent)" color="var(--accent)" />}
                    </span>
                  ))}
                </div>
              )}

              {/* CU25 — Materiales y consumo */}
              {cargandoDetalle ? (
                <div className="text-muted text-sm" style={{ marginBottom: 16 }}>Cargando materiales...</div>
              ) : detalle.productos && detalle.productos.length > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Package size={15} /> Materiales
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {!modoConsumo && (
                        <button className="btn btn-ghost btn-sm" onClick={abrirEditMateriales}>
                          <Pencil size={13} style={{ marginRight: 4 }} />Editar asignación
                        </button>
                      )}
                      {!modoConsumo ? (
                        <button className="btn btn-ghost btn-sm" onClick={() => setModoConsumo(true)}>
                          Reportar consumo
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setModoConsumo(false)}>Cancelar</button>
                          <button className="btn btn-primary btn-sm" onClick={guardarConsumo} disabled={guardandoConsumo}>
                            {guardandoConsumo ? 'Guardando...' : 'Guardar consumo'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="table-wrap" style={{ marginBottom: 20 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Material</th>
                          <th>Asignado</th>
                          <th>{modoConsumo ? 'Usado (editar)' : 'Usado'}</th>
                          {modoConsumo && <th>Obs.</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {detalle.productos.map(p => {
                          const c = consumos.find(x => x.id_producto === p.id_producto) || {}
                          return (
                            <tr key={p.id_producto}>
                              <td style={{ fontWeight: 500 }}>{p.nombre_producto}</td>
                              <td className="text-sm">{p.cantidad_asignada}</td>
                              <td>
                                {modoConsumo ? (
                                  <input type="number" className="input" style={{ width: 80, padding: '4px 8px' }}
                                    min="0" step="0.01"
                                    value={c.cantidad_usada ?? ''}
                                    onChange={e => actualizarConsumo(p.id_producto, 'cantidad_usada', e.target.value)}
                                    placeholder="0" />
                                ) : (
                                  <span className={p.cantidad_usada != null ? 'text-sm' : 'text-muted text-sm'}>
                                    {p.cantidad_usada != null ? p.cantidad_usada : '—'}
                                  </span>
                                )}
                              </td>
                              {modoConsumo && (
                                <td>
                                  <input className="input" style={{ width: 140, padding: '4px 8px', fontSize: '0.8rem' }}
                                    value={c.observacion ?? ''}
                                    onChange={e => actualizarConsumo(p.id_producto, 'observacion', e.target.value)}
                                    placeholder="Nota..." />
                                </td>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* CU27 — Historial de estados */}
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Historial de estados</div>
              {cargandoDetalle ? (
                <div className="text-muted text-sm">Cargando historial...</div>
              ) : !detalle.historial || detalle.historial.length === 0 ? (
                <div className="text-muted text-sm">Sin historial registrado.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {detalle.historial.map((h, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 12, paddingBottom: 12,
                      borderLeft: '2px solid var(--accent)', paddingLeft: 14, position: 'relative',
                    }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: 'var(--accent)', position: 'absolute', left: -6, top: 4,
                      }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          {h.estado_anterior && (
                            <>
                              <span className={`badge ${BADGE_ESTADO[h.estado_anterior] || 'badge-gray'}`}
                                style={{ fontSize: '0.7rem', padding: '2px 7px' }}>
                                {h.estado_anterior}
                              </span>
                              <span className="text-muted" style={{ fontSize: 12 }}>→</span>
                            </>
                          )}
                          <span className={`badge ${BADGE_ESTADO[h.estado_nuevo] || 'badge-gray'}`}
                            style={{ fontSize: '0.7rem', padding: '2px 7px' }}>
                            {h.estado_nuevo}
                          </span>
                        </div>
                        <div className="text-muted text-sm" style={{ marginTop: 2 }}>
                          {formatFechaHora(h.fecha_cambio)}
                        </div>
                        {h.observacion && (
                          <div className="text-sm" style={{ marginTop: 2, fontStyle: 'italic' }}>
                            "{h.observacion}"
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost"
                onClick={() => { abrirModalEstado(detalle); setDetalle(null); setModoConsumo(false) }}>
                Cambiar estado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal cambio estado */}
      {modalEstado && (
        <div className="modal-overlay" onClick={() => setModalEstado(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Cambiar estado — {modalEstado.codigo}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalEstado(null)}><X size={14} /></button>
            </div>
            <form onSubmit={cambiarEstado}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nuevo estado *</label>
                  <select className="input" value={nuevoEstado} onChange={e => setNuevoEstado(e.target.value)}>
                    <option value="">Seleccioná</option>
                    {estados.map(e => (
                      <option key={e.id} value={e.id}
                        disabled={e.id === modalEstado.id_estado_orden}>
                        {e.nombre}{e.id === modalEstado.id_estado_orden ? ' (actual)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Observación</label>
                  <textarea className="input" rows={2} value={obsEstado}
                    onChange={e => setObsEstado(e.target.value)} placeholder="Motivo..." />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModalEstado(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={!nuevoEstado}>Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal crear */}
      {modalCrear && (
        <div className="modal-overlay" onClick={() => setModalCrear(false)}>
          <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nueva orden de trabajo</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalCrear(false)}><X size={14} /></button>
            </div>
            <form onSubmit={guardar}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Proyecto *</label>
                    <select className="input" value={form.id_proyecto}
                      onChange={e => setForm(f => ({ ...f, id_proyecto: Number(e.target.value) || '' }))}>
                      <option value="">Seleccioná</option>
                      {proyectos.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.titulo}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Servicio *</label>
                    <select className="input" value={form.id_servicio}
                      onChange={e => setForm(f => ({ ...f, id_servicio: Number(e.target.value) || '' }))}>
                      <option value="">Seleccioná</option>
                      {servicios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Estado inicial *</label>
                    <select className="input" value={form.id_estado_orden}
                      onChange={e => setForm(f => ({ ...f, id_estado_orden: Number(e.target.value) }))}>
                      {estados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Fecha de ejecución</label>
                    <input type="date" className="input" value={form.fecha_ejecucion}
                      onChange={e => setForm(f => ({ ...f, fecha_ejecucion: e.target.value }))} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Horas estimadas</label>
                    <input type="number" className="input" min="1" value={form.tiempo_estimado}
                      onChange={e => setForm(f => ({ ...f, tiempo_estimado: e.target.value }))}
                      placeholder="Ej: 8" />
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Descripción</label>
                    <textarea className="input" rows={2} value={form.descripcion}
                      onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                      placeholder="Detalle de la tarea..." />
                  </div>
                </div>

                <div style={{ fontWeight: 600, margin: '16px 0 8px', fontSize: '0.9rem' }}>Técnicos asignados</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                  {empleados.map(emp => {
                    const asignado = form.empleados.find(e => e.id_empleado === emp.id)
                    const esResp   = asignado?.es_responsable
                    return (
                      <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                          padding: '4px 10px', borderRadius: 20,
                          background: asignado ? 'var(--accent-light)' : 'var(--bg)',
                          border: `1px solid ${asignado ? 'var(--accent)' : 'var(--border)'}`,
                          fontSize: '0.82rem' }}>
                          <input type="checkbox" checked={!!asignado}
                            onChange={() => toggleEmpleado(emp.id)} style={{ display: 'none' }} />
                          {emp.nombre}
                          {esResp && <span style={{ color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', marginLeft: 2 }}><Star size={11} fill="currentColor" /></span>}
                        </label>
                        {asignado && !esResp && (
                          <button type="button" className="btn btn-ghost btn-sm"
                            title="Marcar como responsable"
                            onClick={() => toggleResponsable(emp.id)}
                            style={{ padding: '2px 6px' }}><Star size={12} /></button>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="text-muted text-sm" style={{ marginBottom: 16 }}>
                  Hacé click en <Star size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> para marcar al responsable principal.
                </div>

                <div style={{ fontWeight: 600, margin: '4px 0 8px', fontSize: '0.9rem' }}>Materiales</div>
                {form.productos.map((prod, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <select className="input" style={{ flex: 2 }} value={prod.id_producto}
                      onChange={e => actualizarProducto(idx, 'id_producto', Number(e.target.value) || '')}>
                      <option value="">Seleccioná producto</option>
                      {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                    <input type="number" className="input" style={{ width: 80 }} min="0.01" step="0.01"
                      value={prod.cantidad_asignada}
                      onChange={e => actualizarProducto(idx, 'cantidad_asignada', e.target.value)}
                      placeholder="Cant." />
                    <button type="button" className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--danger)' }} onClick={() => quitarProducto(idx)}><X size={14} /></button>
                  </div>
                ))}
                <button type="button" className="btn btn-ghost btn-sm" onClick={agregarProducto}>
                  + Agregar material
                </button>

                {errForm && <div className="alert alert-danger" style={{ marginTop: 12 }}>{errForm}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModalCrear(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Crear orden'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal editar personal — CU23 ── */}
      {modalEditPersonal && detalle && (
        <div className="modal-overlay" onClick={() => setModalEditPersonal(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Editar personal — {detalle.codigo}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalEditPersonal(false)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {empleados.map(emp => {
                  const asignado = editEmpleados.find(e => e.id_empleado === emp.id)
                  const esResp   = asignado?.es_responsable
                  return (
                    <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <label style={{
                        display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                        padding: '4px 10px', borderRadius: 20,
                        background: asignado ? 'var(--accent-light)' : 'var(--bg)',
                        border: `1px solid ${asignado ? 'var(--accent)' : 'var(--border)'}`,
                        fontSize: '0.82rem',
                      }}>
                        <input type="checkbox" checked={!!asignado}
                          onChange={() => toggleEditEmpleado(emp.id)} style={{ display: 'none' }} />
                        {emp.nombre}
                        {esResp && <Star size={11} fill="var(--accent)" color="var(--accent)" />}
                      </label>
                      {asignado && !esResp && (
                        <button type="button" className="btn btn-ghost btn-sm"
                          title="Marcar como responsable"
                          onClick={() => toggleEditResponsable(emp.id)}
                          style={{ padding: '2px 6px' }}><Star size={12} /></button>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="text-muted text-sm">
                Hacé click en <Star size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> para marcar al responsable principal.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalEditPersonal(false)}>Cancelar</button>
              <button className="btn btn-primary" disabled={guardandoPersonal} onClick={guardarPersonal}>
                {guardandoPersonal ? 'Guardando...' : 'Guardar personal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal editar materiales asignados — CU24 ── */}
      {modalEditMateriales && detalle && (
        <div className="modal-overlay" onClick={() => setModalEditMateriales(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Editar materiales — {detalle.codigo}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalEditMateriales(false)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              {editProductos.map((prod, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <select className="input" style={{ flex: 2 }} value={prod.id_producto}
                    onChange={e => actualizarEditProducto(idx, 'id_producto', Number(e.target.value) || '')}>
                    <option value="">Seleccioná producto</option>
                    {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  <input type="number" className="input" style={{ width: 90 }} min="0.01" step="0.01"
                    value={prod.cantidad_asignada}
                    onChange={e => actualizarEditProducto(idx, 'cantidad_asignada', e.target.value)}
                    placeholder="Cant." />
                  <button type="button" className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--danger)' }} onClick={() => quitarEditProducto(idx)}><X size={14} /></button>
                </div>
              ))}
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 4 }}
                onClick={agregarEditProducto}>
                + Agregar material
              </button>
              <div className="text-muted text-sm" style={{ marginTop: 10 }}>
                El consumo ya reportado se preserva para los productos que permanezcan.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalEditMateriales(false)}>Cancelar</button>
              <button className="btn btn-primary" disabled={guardandoMat} onClick={guardarMateriales}>
                {guardandoMat ? 'Guardando...' : 'Guardar materiales'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
