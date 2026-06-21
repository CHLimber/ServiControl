import { useState, useEffect } from 'react'
import { catalogosApi } from '../../api/catalogos'
import { useAuth } from '../../context/AuthContext'
import { RefreshCw, X, CalendarClock } from 'lucide-react'

const ESTADOS  = ['pendiente', 'confirmado', 'reprogramado', 'completado', 'vencido']
const TIPOS    = ['preventivo', 'correctivo']

const BADGE_ESTADO = {
  pendiente:     'badge-gray',
  confirmado:    'badge-blue',
  reprogramado:  'badge-yellow',
  completado:    'badge-green',
  vencido:       'badge-red',
}

const BADGE_TIPO = {
  preventivo: 'badge-blue',
  correctivo: 'badge-yellow',
}

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-BO')
}

// API de mantenimiento inline (no hay archivo separado aún)
import client from '../../api/client'
const mantApi = {
  listar:      ()           => client.get('/mantenimiento/'),
  crear:       (data)       => client.post('/mantenimiento/', data),
  actualizar:  (id, data)   => client.put(`/mantenimiento/${id}`, data),
  reprogramar: (id, data)   => client.put(`/mantenimiento/${id}/reprogramar`, data),
}

const ESTADOS_NO_REPROG = ['completado', 'vencido']
const hoyISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const FORM_VACIO = {
  id_sistema: '', tipo: 'preventivo', fecha_programada: '',
  estado: 'pendiente', periodicidad_dias: '',
}

export default function MantenimientoPage() {
  const { puede } = useAuth()
  const puedeGestionar = puede('gestionar_mantenimientos')
  const [lista, setLista]           = useState([])
  const [cargando, setCargando]     = useState(true)
  const [error, setError]           = useState(null)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [busqueda, setBusqueda]     = useState('')

  const [modalCrear, setModalCrear] = useState(false)
  const [sistemas, setSistemas]     = useState([])
  const [form, setForm]             = useState(FORM_VACIO)
  const [guardando, setGuardando]   = useState(false)
  const [errForm, setErrForm]       = useState('')

  const [modalEstado, setModalEstado] = useState(null)
  const [nuevoEstado, setNuevoEstado] = useState('')
  const [nuevaFecha, setNuevaFecha]   = useState('')

  // CU41 — Reprogramar
  const [modalReprog, setModalReprog]   = useState(null)
  const [fechaReprog, setFechaReprog]   = useState('')
  const [obsReprog, setObsReprog]       = useState('')
  const [errReprog, setErrReprog]       = useState('')
  const [reprogramando, setReprogramando] = useState(false)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    try {
      setCargando(true)
      const [mants, sis] = await Promise.all([mantApi.listar(), catalogosApi.sistemas()])
      setLista(mants)
      setSistemas(sis)
    } catch {
      setError('No se pudo cargar los mantenimientos.')
    } finally {
      setCargando(false)
    }
  }

  async function guardar(e) {
    e.preventDefault()
    if (!form.id_sistema || !form.fecha_programada) {
      setErrForm('Sistema y fecha programada son obligatorios.')
      return
    }
    setGuardando(true)
    setErrForm('')
    try {
      const nuevo = await mantApi.crear({
        ...form,
        periodicidad_dias: form.periodicidad_dias ? Number(form.periodicidad_dias) : null,
      })
      setLista(prev => [...prev, nuevo].sort((a, b) => a.fecha_programada > b.fecha_programada ? 1 : -1))
      setModalCrear(false)
      setForm(FORM_VACIO)
    } catch (err) {
      setErrForm(err.error || 'Error al crear el mantenimiento.')
    } finally {
      setGuardando(false)
    }
  }

  async function actualizarEstado(e) {
    e.preventDefault()
    if (!nuevoEstado) return
    const payload = { estado: nuevoEstado }
    if (nuevoEstado === 'reprogramado' && nuevaFecha) payload.fecha_programada = nuevaFecha
    try {
      const actualizado = await mantApi.actualizar(modalEstado.id, payload)
      setLista(prev => prev.map(m => m.id === modalEstado.id ? actualizado : m))
      setModalEstado(null)
    } catch {
      alert('No se pudo actualizar el mantenimiento.')
    }
  }

  function abrirReprogramar(m) {
    setModalReprog(m)
    setFechaReprog('')
    setObsReprog('')
    setErrReprog('')
  }

  async function reprogramar(e) {
    e.preventDefault()
    setErrReprog('')
    if (!fechaReprog) {
      setErrReprog('Seleccioná la nueva fecha programada.')
      return
    }
    if (fechaReprog <= hoyISO()) {
      setErrReprog('La nueva fecha debe ser posterior a hoy.')
      return
    }
    setReprogramando(true)
    try {
      const actualizado = await mantApi.reprogramar(modalReprog.id, {
        fecha_programada: fechaReprog,
        observacion: obsReprog,
      })
      setLista(prev => prev.map(m => m.id === modalReprog.id ? actualizado : m))
      setModalReprog(null)
    } catch (err) {
      setErrReprog(err?.error || 'No se pudo reprogramar el mantenimiento.')
    } finally {
      setReprogramando(false)
    }
  }

  const nombreSistema = id => sistemas.find(s => s.id === id)?.nombre || `Sistema #${id}`

  const filtrados = lista.filter(m => {
    const coincideEstado = filtroEstado === '' || m.estado === filtroEstado
    const coincideTipo   = filtroTipo   === '' || m.tipo   === filtroTipo
    const coincideBusq   = busqueda === '' || nombreSistema(m.id_sistema).toLowerCase().includes(busqueda.toLowerCase())
    return coincideEstado && coincideTipo && coincideBusq
  })

  // Agrupar por estado para el tablero
  const porEstado = ESTADOS.reduce((acc, e) => {
    acc[e] = lista.filter(m => m.estado === e).length
    return acc
  }, {})

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mantenimiento</h1>
          <p className="page-subtitle">Mantenimientos preventivos y correctivos</p>
        </div>
        {puedeGestionar && (
          <button className="btn btn-primary" onClick={() => { setForm(FORM_VACIO); setErrForm(''); setModalCrear(true) }}>
            + Programar mantenimiento
          </button>
        )}
      </div>

      {/* Resumen rápido */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {ESTADOS.map(e => (
          <div key={e} className="card" style={{ flex: 1, minWidth: 120, padding: '12px 16px', cursor: 'pointer',
            border: filtroEstado === e ? '2px solid var(--accent)' : undefined }}
            onClick={() => setFiltroEstado(filtroEstado === e ? '' : e)}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{porEstado[e]}</div>
            <div className="text-sm text-muted" style={{ textTransform: 'capitalize' }}>{e}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="input" style={{ flex: 1, minWidth: 180 }}
            placeholder="Buscar por sistema..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <select className="input" style={{ minWidth: 150 }}
            value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="input" style={{ minWidth: 150, textTransform: 'capitalize' }}
            value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          {(busqueda || filtroTipo || filtroEstado) && (
            <button className="btn btn-ghost" onClick={() => { setBusqueda(''); setFiltroTipo(''); setFiltroEstado('') }}>
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="card">
        {cargando ? (
          <div className="empty-state">Cargando mantenimientos...</div>
        ) : error ? (
          <div className="empty-state" style={{ color: 'var(--danger)' }}>{error}</div>
        ) : filtrados.length === 0 ? (
          <div className="empty-state">No hay mantenimientos registrados.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Sistema</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Fecha programada</th>
                  <th>Periodicidad</th>
                  <th style={{ width: 80 }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 500 }}>{nombreSistema(m.id_sistema)}</td>
                    <td><span className={`badge ${BADGE_TIPO[m.tipo]}`}>{m.tipo}</span></td>
                    <td><span className={`badge ${BADGE_ESTADO[m.estado] || 'badge-gray'}`}>{m.estado}</span></td>
                    <td className="text-sm">{formatFecha(m.fecha_programada)}</td>
                    <td className="text-sm text-muted">
                      {m.periodicidad_dias ? `Cada ${m.periodicidad_dias} días` : '—'}
                    </td>
                    <td>
                      {puedeGestionar && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" title="Cambiar estado"
                            onClick={() => { setModalEstado(m); setNuevoEstado(''); setNuevaFecha('') }}>
                            <RefreshCw size={14} />
                          </button>
                          <button className="btn btn-ghost btn-sm" title="Reprogramar"
                            disabled={ESTADOS_NO_REPROG.includes(m.estado)}
                            onClick={() => abrirReprogramar(m)}>
                            <CalendarClock size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="text-muted text-sm" style={{ padding: '10px 0 0' }}>
          {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Modal cambio de estado */}
      {modalEstado && (
        <div className="modal-overlay" onClick={() => setModalEstado(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Actualizar mantenimiento</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalEstado(null)}><X size={14} /></button>
            </div>
            <form onSubmit={actualizarEstado}>
              <div className="modal-body">
                <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
                  Sistema: <strong>{nombreSistema(modalEstado.id_sistema)}</strong>
                  {' · '}{modalEstado.tipo}
                  {' · '}{formatFecha(modalEstado.fecha_programada)}
                </p>
                <div className="form-group">
                  <label className="form-label">Nuevo estado *</label>
                  <select className="input" value={nuevoEstado} onChange={e => setNuevoEstado(e.target.value)}>
                    <option value="">Seleccioná</option>
                    {ESTADOS.map(s => (
                      <option key={s} value={s} disabled={s === modalEstado.estado}>
                        {s}{s === modalEstado.estado ? ' (actual)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {nuevoEstado === 'reprogramado' && (
                  <div className="form-group">
                    <label className="form-label">Nueva fecha programada</label>
                    <input type="date" className="input" value={nuevaFecha}
                      onChange={e => setNuevaFecha(e.target.value)} />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModalEstado(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={!nuevoEstado}>Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal reprogramar (CU41) */}
      {modalReprog && (
        <div className="modal-overlay" onClick={() => setModalReprog(null)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Reprogramar mantenimiento</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalReprog(null)}><X size={14} /></button>
            </div>
            <form onSubmit={reprogramar}>
              <div className="modal-body">
                <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
                  Sistema: <strong>{nombreSistema(modalReprog.id_sistema)}</strong>
                  {' · '}{modalReprog.tipo}
                  <br />
                  Fecha actual: <strong>{formatFecha(modalReprog.fecha_programada)}</strong>
                </p>
                <div className="form-group">
                  <label className="form-label">Nueva fecha programada *</label>
                  <input type="date" className="input" value={fechaReprog} min={hoyISO()}
                    onChange={e => setFechaReprog(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Observación de reprogramación</label>
                  <textarea className="input" rows={3} value={obsReprog}
                    onChange={e => setObsReprog(e.target.value)}
                    placeholder="Motivo del cambio de fecha (opcional)" />
                </div>
                {errReprog && <div className="alert alert-danger" style={{ marginTop: 4 }}>{errReprog}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModalReprog(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={reprogramando}>
                  {reprogramando ? 'Reprogramando...' : 'Reprogramar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal crear */}
      {modalCrear && (
        <div className="modal-overlay" onClick={() => setModalCrear(false)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Programar mantenimiento</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalCrear(false)}><X size={14} /></button>
            </div>
            <form onSubmit={guardar}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Sistema *</label>
                    <select className="input" value={form.id_sistema}
                      onChange={e => setForm(f => ({ ...f, id_sistema: Number(e.target.value) || '' }))}>
                      <option value="">Seleccioná un sistema</option>
                      {sistemas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Tipo *</label>
                    <select className="input" value={form.tipo}
                      onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                      {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Estado inicial</label>
                    <select className="input" value={form.estado}
                      onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                      {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Fecha programada *</label>
                    <input type="date" className="input" value={form.fecha_programada}
                      onChange={e => setForm(f => ({ ...f, fecha_programada: e.target.value }))} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Periodicidad (días)</label>
                    <input type="number" className="input" min="1" value={form.periodicidad_dias}
                      onChange={e => setForm(f => ({ ...f, periodicidad_dias: e.target.value }))}
                      placeholder="Ej: 90 (dejar vacío si es único)" />
                  </div>
                </div>
                {errForm && <div className="alert alert-danger" style={{ marginTop: 12 }}>{errForm}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModalCrear(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Programar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
