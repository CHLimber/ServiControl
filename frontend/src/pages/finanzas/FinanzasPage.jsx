import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { proyectosApi } from '../../api/proyectos'
import { ordenesApi } from '../../api/ordenes'
import client from '../../api/client'
import { TrendingUp, TrendingDown, Clock, BarChart3, CheckCircle, X } from 'lucide-react'

const finanzasApi = {
  listarPagos:       ()           => client.get('/finanzas/pagos'),
  listarGastos:      ()           => client.get('/finanzas/gastos'),
  registrarPago:     (data)       => client.post('/finanzas/pagos', data),
  registrarGasto:    (data)       => client.post('/finanzas/gastos', data),
  cuentasPorCobrar:  ()           => client.get('/finanzas/cuentas-por-cobrar'),
}

const TIPOS_PAGO   = ['anticipo', 'pago_parcial', 'pago_final', 'otro']
const METODOS_PAGO = ['efectivo', 'transferencia', 'QR', 'otro']
const CONCEPTOS    = ['materiales', 'viaticos', 'transporte', 'otro']

const BADGE_TIPO = {
  anticipo:     'badge-blue',
  pago_parcial: 'badge-yellow',
  pago_final:   'badge-green',
  otro:         'badge-gray',
}

function formatBs(n) {
  return `Bs ${Number(n).toLocaleString('es-BO', { minimumFractionDigits: 2 })}`
}
function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-BO')
}

const FORM_PAGO_VACIO   = { id_proyecto: '', tipo_pago: 'anticipo', monto: '', fecha_pago: '', metodo: 'efectivo', observacion: '' }
const FORM_GASTO_VACIO  = { id_orden: '', concepto: 'materiales', monto: '', fecha_gasto: '', descripcion: '' }

export default function FinanzasPage() {
  const location = useLocation()
  const navigate = useNavigate()

  const tab = location.pathname === '/finanzas/cuentas' ? 'cuentas'
            : location.pathname === '/finanzas/gastos'  ? 'gastos'
            : 'pagos'

  function setTab(key) {
    navigate(key === 'cuentas' ? '/finanzas/cuentas' : key === 'gastos' ? '/finanzas/gastos' : '/finanzas/pago')
  }

  const [pagos, setPagos]         = useState([])
  const [gastos, setGastos]       = useState([])
  const [cuentas, setCuentas]     = useState([])
  const [cargando, setCargando]   = useState(true)
  const [proyectos, setProyectos] = useState([])
  const [ordenes, setOrdenes]     = useState([])

  const [modalPago, setModalPago]   = useState(false)
  const [modalGasto, setModalGasto] = useState(false)
  const [formPago, setFormPago]     = useState(FORM_PAGO_VACIO)
  const [formGasto, setFormGasto]   = useState(FORM_GASTO_VACIO)
  const [guardando, setGuardando]   = useState(false)
  const [errPago, setErrPago]       = useState('')
  const [errGasto, setErrGasto]     = useState('')

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setCargando(true)
    try {
      const [p, g, c, proys, ords] = await Promise.all([
        finanzasApi.listarPagos(),
        finanzasApi.listarGastos(),
        finanzasApi.cuentasPorCobrar(),
        proyectosApi.listar(),
        ordenesApi.listar(),
      ])
      setPagos(p)
      setGastos(g)
      setCuentas(c)
      setProyectos(proys)
      setOrdenes(ords)
    } catch {
      // cuentas puede fallar si no hay datos — no es crítico
    } finally {
      setCargando(false)
    }
  }

  async function guardarPago(e) {
    e.preventDefault()
    if (!formPago.id_proyecto || !formPago.monto || !formPago.fecha_pago) {
      setErrPago('Proyecto, monto y fecha son obligatorios.')
      return
    }
    setGuardando(true)
    setErrPago('')
    try {
      const nuevo = await finanzasApi.registrarPago(formPago)
      setPagos(prev => [nuevo, ...prev])
      setModalPago(false)
      setFormPago(FORM_PAGO_VACIO)
    } catch (err) {
      setErrPago(err.error || 'Error al registrar el pago.')
    } finally {
      setGuardando(false)
    }
  }

  async function guardarGasto(e) {
    e.preventDefault()
    if (!formGasto.id_orden || !formGasto.monto || !formGasto.fecha_gasto) {
      setErrGasto('Orden, monto y fecha son obligatorios.')
      return
    }
    setGuardando(true)
    setErrGasto('')
    try {
      const nuevo = await finanzasApi.registrarGasto(formGasto)
      setGastos(prev => [nuevo, ...prev])
      setModalGasto(false)
      setFormGasto(FORM_GASTO_VACIO)
    } catch (err) {
      setErrGasto(err.error || 'Error al registrar el gasto.')
    } finally {
      setGuardando(false)
    }
  }

  const totalPagos  = pagos.reduce((s, p) => s + p.monto, 0)
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0)
  const totalPendiente = cuentas.reduce((s, c) => s + c.saldo_pendiente, 0)

  const nombreProyecto = id => {
    const p = proyectos.find(p => p.id === id)
    return p ? `${p.codigo} — ${p.titulo}` : `Proy. #${id}`
  }
  const nombreOrden = id => {
    const o = ordenes.find(o => o.id === id)
    return o ? o.codigo : `OT #${id}`
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Finanzas</h1>
          <p className="page-subtitle">
            {tab === 'cuentas' ? 'Cuentas por cobrar — saldos pendientes por proyecto'
           : tab === 'gastos'  ? 'Gastos — egresos registrados por orden de trabajo'
           : 'Pagos — ingresos registrados por proyecto'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => { setErrGasto(''); setFormGasto(FORM_GASTO_VACIO); setModalGasto(true) }}>
            + Gasto
          </button>
          <button className="btn btn-primary" onClick={() => { setErrPago(''); setFormPago(FORM_PAGO_VACIO); setModalPago(true) }}>
            + Registrar pago
          </button>
        </div>
      </div>

      {/* Resumen */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-icon green"><TrendingUp size={20} /></div>
          <div className="stat-info">
            <div className="stat-value">{formatBs(totalPagos)}</div>
            <div className="stat-label">Total cobrado</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><TrendingDown size={20} /></div>
          <div className="stat-info">
            <div className="stat-value">{formatBs(totalGastos)}</div>
            <div className="stat-label">Total gastos</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><Clock size={20} /></div>
          <div className="stat-info">
            <div className="stat-value">{formatBs(totalPendiente)}</div>
            <div className="stat-label">Por cobrar</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><BarChart3 size={20} /></div>
          <div className="stat-info">
            <div className="stat-value">{cuentas.length}</div>
            <div className="stat-label">Proyectos con saldo</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[['pagos','Pagos'], ['gastos','Gastos'], ['cuentas','Cuentas por cobrar']].map(([key, label]) => (
          <button key={key} className={`btn ${tab === key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {/* Tab: Pagos */}
      {tab === 'pagos' && (
        <div className="card">
          {cargando ? <div className="empty-state">Cargando...</div> :
           pagos.length === 0 ? <div className="empty-state">No hay pagos registrados.</div> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Proyecto</th>
                    <th>Tipo</th>
                    <th>Método</th>
                    <th>Monto</th>
                    <th>Fecha</th>
                    <th>Observación</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map(p => (
                    <tr key={p.id}>
                      <td className="text-sm">{nombreProyecto(p.id_proyecto)}</td>
                      <td><span className={`badge ${BADGE_TIPO[p.tipo_pago] || 'badge-gray'}`}>{p.tipo_pago}</span></td>
                      <td className="text-sm text-muted">{p.metodo}</td>
                      <td style={{ fontWeight: 600 }}>{formatBs(p.monto)}</td>
                      <td className="text-sm text-muted">{formatFecha(p.fecha_pago)}</td>
                      <td className="text-sm text-muted">{p.observacion || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="text-muted text-sm" style={{ padding: '10px 0 0' }}>
            {pagos.length} pago{pagos.length !== 1 ? 's' : ''} · Total: {formatBs(totalPagos)}
          </div>
        </div>
      )}

      {/* Tab: Gastos */}
      {tab === 'gastos' && (
        <div className="card">
          {cargando ? <div className="empty-state">Cargando...</div> :
           gastos.length === 0 ? <div className="empty-state">No hay gastos registrados.</div> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Orden</th>
                    <th>Concepto</th>
                    <th>Descripción</th>
                    <th>Monto</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {gastos.map(g => (
                    <tr key={g.id}>
                      <td className="text-sm">{nombreOrden(g.id_orden)}</td>
                      <td><span className="badge badge-yellow">{g.concepto}</span></td>
                      <td className="text-sm text-muted">{g.descripcion || '—'}</td>
                      <td style={{ fontWeight: 600 }}>{formatBs(g.monto)}</td>
                      <td className="text-sm text-muted">{formatFecha(g.fecha_gasto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="text-muted text-sm" style={{ padding: '10px 0 0' }}>
            {gastos.length} gasto{gastos.length !== 1 ? 's' : ''} · Total: {formatBs(totalGastos)}
          </div>
        </div>
      )}

      {/* Tab: Cuentas por cobrar (CU36) */}
      {tab === 'cuentas' && (
        <div className="card">
          {cargando ? <div className="empty-state">Cargando...</div> :
           cuentas.length === 0 ? (
            <div className="empty-state">
              <div className="icon"><CheckCircle size={32} /></div>
              <p>Sin saldos pendientes por cobrar.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Proyecto</th>
                    <th>Cliente</th>
                    <th>Monto cotizado</th>
                    <th>Total pagado</th>
                    <th>Saldo pendiente</th>
                    <th>% Pagado</th>
                  </tr>
                </thead>
                <tbody>
                  {cuentas.map(c => {
                    const pct = c.monto_total_cotizacion > 0
                      ? Math.round((c.total_pagado / c.monto_total_cotizacion) * 100)
                      : 0
                    return (
                      <tr key={c.id_proyecto}>
                        <td>
                          <code style={{ fontSize: 12 }}>{c.codigo_proyecto}</code>
                          {c.titulo_proyecto && (
                            <div className="text-muted text-sm">{c.titulo_proyecto}</div>
                          )}
                        </td>
                        <td style={{ fontWeight: 500 }}>{c.cliente}</td>
                        <td className="text-sm">{formatBs(c.monto_total_cotizacion)}</td>
                        <td className="text-sm" style={{ color: 'var(--success)' }}>{formatBs(c.total_pagado)}</td>
                        <td style={{ fontWeight: 700, color: 'var(--danger)' }}>{formatBs(c.saldo_pendiente)}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{
                              flex: 1, height: 6, background: 'var(--border)',
                              borderRadius: 3, minWidth: 60, overflow: 'hidden',
                            }}>
                              <div style={{
                                height: '100%', width: `${pct}%`,
                                background: pct >= 100 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)',
                                borderRadius: 3, transition: 'width 0.3s',
                              }} />
                            </div>
                            <span className="text-sm text-muted">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {cuentas.length > 0 && (
            <div className="text-muted text-sm" style={{ padding: '10px 0 0' }}>
              {cuentas.length} proyecto{cuentas.length !== 1 ? 's' : ''} con saldo pendiente ·
              Total: <strong style={{ color: 'var(--danger)' }}>{formatBs(totalPendiente)}</strong>
            </div>
          )}
        </div>
      )}

      {/* Modal registrar pago */}
      {modalPago && (
        <div className="modal-overlay" onClick={() => setModalPago(false)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Registrar pago</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalPago(false)}><X size={14} /></button>
            </div>
            <form onSubmit={guardarPago}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Proyecto *</label>
                    <select className="input" value={formPago.id_proyecto}
                      onChange={e => setFormPago(f => ({ ...f, id_proyecto: Number(e.target.value) || '' }))}>
                      <option value="">Seleccioná un proyecto</option>
                      {proyectos.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.titulo}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Tipo de pago *</label>
                    <select className="input" value={formPago.tipo_pago}
                      onChange={e => setFormPago(f => ({ ...f, tipo_pago: e.target.value }))}>
                      {TIPOS_PAGO.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Método *</label>
                    <select className="input" value={formPago.metodo}
                      onChange={e => setFormPago(f => ({ ...f, metodo: e.target.value }))}>
                      {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Monto (Bs) *</label>
                    <input type="number" className="input" min="0.01" step="0.01"
                      value={formPago.monto}
                      onChange={e => setFormPago(f => ({ ...f, monto: e.target.value }))}
                      placeholder="0.00" />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Fecha *</label>
                    <input type="date" className="input" value={formPago.fecha_pago}
                      onChange={e => setFormPago(f => ({ ...f, fecha_pago: e.target.value }))} />
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Observación</label>
                    <textarea className="input" rows={2} value={formPago.observacion}
                      onChange={e => setFormPago(f => ({ ...f, observacion: e.target.value }))}
                      placeholder="Número de comprobante, referencia..." />
                  </div>
                </div>
                {errPago && <div className="alert alert-danger" style={{ marginTop: 12 }}>{errPago}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModalPago(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Registrar pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal registrar gasto */}
      {modalGasto && (
        <div className="modal-overlay" onClick={() => setModalGasto(false)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Registrar gasto</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalGasto(false)}><X size={14} /></button>
            </div>
            <form onSubmit={guardarGasto}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Orden de trabajo *</label>
                    <select className="input" value={formGasto.id_orden}
                      onChange={e => setFormGasto(f => ({ ...f, id_orden: Number(e.target.value) || '' }))}>
                      <option value="">Seleccioná una OT</option>
                      {ordenes.map(o => <option key={o.id} value={o.id}>{o.codigo}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Concepto *</label>
                    <select className="input" value={formGasto.concepto}
                      onChange={e => setFormGasto(f => ({ ...f, concepto: e.target.value }))}>
                      {CONCEPTOS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Monto (Bs) *</label>
                    <input type="number" className="input" min="0.01" step="0.01"
                      value={formGasto.monto}
                      onChange={e => setFormGasto(f => ({ ...f, monto: e.target.value }))}
                      placeholder="0.00" />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Fecha *</label>
                    <input type="date" className="input" value={formGasto.fecha_gasto}
                      onChange={e => setFormGasto(f => ({ ...f, fecha_gasto: e.target.value }))} />
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Descripción</label>
                    <textarea className="input" rows={2} value={formGasto.descripcion}
                      onChange={e => setFormGasto(f => ({ ...f, descripcion: e.target.value }))} />
                  </div>
                </div>
                {errGasto && <div className="alert alert-danger" style={{ marginTop: 12 }}>{errGasto}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModalGasto(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Registrar gasto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
