import { useState, useEffect } from 'react'
import { AlertTriangle, RefreshCw, Plus, X, Eye } from 'lucide-react'
import { mantenimientoApi } from '../../api/mantenimiento'
import { catalogosApi } from '../../api/catalogos'
import { useAuth } from '../../context/AuthContext'

const ESTADOS_ALERTA = ['pendiente', 'enviada', 'leida', 'completada']
const ESTADOS_MANT   = ['pendiente', 'confirmado', 'reprogramado', 'completado', 'vencido']

const BADGE_ALERTA = {
  pendiente:   'badge-gray',
  enviada:     'badge-blue',
  leida:       'badge-yellow',
  completada:  'badge-green',
}

const BADGE_MANT = {
  pendiente:   'badge-gray',
  confirmado:  'badge-blue',
  reprogramado:'badge-yellow',
  completado:  'badge-green',
  vencido:     'badge-red',
}

const BADGE_TIPO = {
  preventivo: 'badge-blue',
  correctivo: 'badge-yellow',
}

function formatFecha(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-BO')
}

function formatFechaHora(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? iso : d.toLocaleString('es-BO')
}

const FORM_ALERTA_VACIO = {
  id_mantenimiento: '',
  id_establecimiento: '',
  observacion: '',
}

export default function AlertasMantenimientoPage() {
  const { puede } = useAuth()
  const puedeGestionar = puede('gestionar_mantenimientos')
  const [alertas, setAlertas]         = useState([])
  const [mantenimientos, setMants]    = useState([])
  const [sistemas, setSistemas]       = useState([])
  const [cargando, setCargando]       = useState(true)
  const [error, setError]             = useState(null)

  const [filtroEstado, setFiltroEstado] = useState('')
  const [busqueda, setBusqueda]         = useState('')

  const [modalCrear, setModalCrear]   = useState(false)
  const [form, setForm]               = useState(FORM_ALERTA_VACIO)
  const [guardando, setGuardando]     = useState(false)
  const [errForm, setErrForm]         = useState('')

  const [modalEstado, setModalEstado] = useState(null)
  const [nuevoEstado, setNuevoEstado] = useState('')
  const [nuevaObs, setNuevaObs]       = useState('')

  const [modalDetalle, setModalDetalle] = useState(null)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    try {
      setCargando(true)
      const [als, mants, sis] = await Promise.all([
        mantenimientoApi.listarAlertas(),
        mantenimientoApi.listar(),
        catalogosApi.sistemas(),
      ])
      setAlertas(als)
      setMants(mants)
      setSistemas(sis)
    } catch {
      setError('No se pudieron cargar las alertas.')
    } finally {
      setCargando(false)
    }
  }

  function nombreSistema(idSistema) {
    return sistemas.find(s => s.id === idSistema)?.nombre || `Sistema #${idSistema}`
  }

  function onSeleccionarMant(idMant) {
    const mant = mantenimientos.find(m => m.id === Number(idMant))
    if (!mant) {
      setForm(f => ({ ...f, id_mantenimiento: idMant, id_establecimiento: '' }))
      return
    }
    const sis = sistemas.find(s => s.id === mant.id_sistema)
    setForm(f => ({
      ...f,
      id_mantenimiento:   idMant,
      id_establecimiento: sis?.id_establecimiento || '',
    }))
  }

  async function guardarAlerta(e) {
    e.preventDefault()
    if (!form.id_mantenimiento || !form.id_establecimiento) {
      setErrForm('Seleccioná un mantenimiento.')
      return
    }
    setGuardando(true)
    setErrForm('')
    try {
      const nueva = await mantenimientoApi.crearAlerta({
        id_mantenimiento:   Number(form.id_mantenimiento),
        id_establecimiento: Number(form.id_establecimiento),
        observacion:        form.observacion || null,
      })
      setAlertas(prev => [nueva, ...prev])
      setModalCrear(false)
      setForm(FORM_ALERTA_VACIO)
    } catch (err) {
      setErrForm(err?.error || 'Error al crear la alerta.')
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarEstado(e) {
    e.preventDefault()
    if (!nuevoEstado) return
    try {
      const actualizada = await mantenimientoApi.actualizarAlerta(modalEstado.id, {
        estado: nuevoEstado,
        ...(nuevaObs !== '' ? { observacion: nuevaObs } : {}),
      })
      setAlertas(prev => prev.map(a => a.id === modalEstado.id ? actualizada : a))
      setModalEstado(null)
    } catch {
      alert('No se pudo actualizar la alerta.')
    }
  }

  const porEstado = ESTADOS_ALERTA.reduce((acc, e) => {
    acc[e] = alertas.filter(a => a.estado === e).length
    return acc
  }, {})

  const filtradas = alertas.filter(a => {
    const coincideEstado = !filtroEstado || a.estado === filtroEstado
    const q = busqueda.toLowerCase()
    const coincideBusq = !busqueda ||
      (a.sistema_nombre || '').toLowerCase().includes(q) ||
      (a.establecimiento_nombre || '').toLowerCase().includes(q)
    return coincideEstado && coincideBusq
  })

  const mantsSinCompletar = mantenimientos.filter(m =>
    m.estado === 'pendiente' || m.estado === 'vencido' || m.estado === 'confirmado'
  )

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Alertas de mantenimiento</h1>
          <p className="page-subtitle">Alertas pendientes de sistemas con mantenimiento vencido o próximo</p>
        </div>
        {puedeGestionar && (
          <button className="btn btn-primary"
            onClick={() => { setForm(FORM_ALERTA_VACIO); setErrForm(''); setModalCrear(true) }}>
            <Plus size={16} style={{ marginRight: 6 }} />
            Nueva alerta
          </button>
        )}
      </div>

      {/* Resumen */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {ESTADOS_ALERTA.map(e => (
          <div key={e} className="card"
            style={{ flex: 1, minWidth: 120, padding: '12px 16px', cursor: 'pointer',
              border: filtroEstado === e ? '2px solid var(--accent)' : undefined }}
            onClick={() => setFiltroEstado(filtroEstado === e ? '' : e)}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{porEstado[e]}</div>
            <div className="text-sm text-muted" style={{ textTransform: 'capitalize' }}>{e}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input className="input" style={{ flex: 1, minWidth: 200 }}
            placeholder="Buscar por sistema o establecimiento..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <select className="input" style={{ minWidth: 160 }}
            value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            {ESTADOS_ALERTA.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className="card">
        {cargando ? (
          <div className="empty-state">Cargando alertas...</div>
        ) : error ? (
          <div className="empty-state" style={{ color: 'var(--danger)' }}>{error}</div>
        ) : filtradas.length === 0 ? (
          <div className="empty-state">
            <AlertTriangle size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
            <div>No hay alertas{filtroEstado ? ` en estado "${filtroEstado}"` : ''}.</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Sistema</th>
                  <th>Tipo</th>
                  <th>Est. mantenimiento</th>
                  <th>Fecha mant.</th>
                  <th>Establecimiento</th>
                  <th>Fecha alerta</th>
                  <th>Estado alerta</th>
                  <th style={{ width: 100 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 500 }}>{a.sistema_nombre || `Sistema #${a.id_sistema}`}</td>
                    <td>
                      {a.mantenimiento_tipo
                        ? <span className={`badge ${BADGE_TIPO[a.mantenimiento_tipo]}`}>{a.mantenimiento_tipo}</span>
                        : '—'}
                    </td>
                    <td>
                      {a.mantenimiento_estado
                        ? <span className={`badge ${BADGE_MANT[a.mantenimiento_estado] || 'badge-gray'}`}>{a.mantenimiento_estado}</span>
                        : '—'}
                    </td>
                    <td className="text-sm">{formatFecha(a.mantenimiento_fecha_programada)}</td>
                    <td className="text-sm">{a.establecimiento_nombre}</td>
                    <td className="text-sm text-muted">{formatFechaHora(a.fecha)}</td>
                    <td>
                      <span className={`badge ${BADGE_ALERTA[a.estado] || 'badge-gray'}`}>{a.estado}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" title="Ver detalle"
                          onClick={() => setModalDetalle(a)}>
                          <Eye size={14} />
                        </button>
                        {puedeGestionar && (
                          <button className="btn btn-ghost btn-sm" title="Cambiar estado"
                            onClick={() => { setModalEstado(a); setNuevoEstado(''); setNuevaObs(a.observacion || '') }}>
                            <RefreshCw size={14} />
                          </button>
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
          {filtradas.length} alerta{filtradas.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Modal detalle */}
      {modalDetalle && (
        <div className="modal-overlay" onClick={() => setModalDetalle(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Detalle de alerta</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalDetalle(null)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {[
                    ['Sistema',              modalDetalle.sistema_nombre || '—'],
                    ['Tipo mantenimiento',   modalDetalle.mantenimiento_tipo || '—'],
                    ['Estado mantenimiento', modalDetalle.mantenimiento_estado || '—'],
                    ['Fecha programada',     formatFecha(modalDetalle.mantenimiento_fecha_programada)],
                    ['Establecimiento',      modalDetalle.establecimiento_nombre],
                    ['Estado alerta',        modalDetalle.estado],
                    ['Fecha alerta',         formatFechaHora(modalDetalle.fecha)],
                    ['Creada por',           modalDetalle.usuario_nombre || '—'],
                    ['Observación',          modalDetalle.observacion || '—'],
                  ].map(([label, valor]) => (
                    <tr key={label}>
                      <td className="text-sm text-muted" style={{ padding: '6px 0', width: '45%', verticalAlign: 'top' }}>
                        {label}
                      </td>
                      <td className="text-sm" style={{ padding: '6px 0', fontWeight: 500 }}>
                        {valor}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalDetalle(null)}>Cerrar</button>
              {puedeGestionar && (
                <button className="btn btn-primary"
                  onClick={() => { setModalEstado(modalDetalle); setNuevoEstado(''); setNuevaObs(modalDetalle.observacion || ''); setModalDetalle(null) }}>
                  Cambiar estado
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal cambiar estado */}
      {modalEstado && (
        <div className="modal-overlay" onClick={() => setModalEstado(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Actualizar alerta</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalEstado(null)}><X size={14} /></button>
            </div>
            <form onSubmit={cambiarEstado}>
              <div className="modal-body">
                <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
                  {modalEstado.sistema_nombre} · {modalEstado.mantenimiento_tipo} · {modalEstado.establecimiento_nombre}
                </p>
                <div className="form-group">
                  <label className="form-label">Nuevo estado *</label>
                  <select className="input" value={nuevoEstado} onChange={e => setNuevoEstado(e.target.value)}>
                    <option value="">Seleccioná</option>
                    {ESTADOS_ALERTA.map(s => (
                      <option key={s} value={s} disabled={s === modalEstado.estado}>
                        {s}{s === modalEstado.estado ? ' (actual)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Observación</label>
                  <textarea className="input" rows={3} value={nuevaObs}
                    onChange={e => setNuevaObs(e.target.value)}
                    placeholder="Notas adicionales (opcional)" />
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

      {/* Modal crear alerta */}
      {modalCrear && (
        <div className="modal-overlay" onClick={() => setModalCrear(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nueva alerta de mantenimiento</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setModalCrear(false)}><X size={14} /></button>
            </div>
            <form onSubmit={guardarAlerta}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Mantenimiento *</label>
                  <select className="input" value={form.id_mantenimiento}
                    onChange={e => onSeleccionarMant(e.target.value)}>
                    <option value="">Seleccioná un mantenimiento</option>
                    {mantsSinCompletar.map(m => (
                      <option key={m.id} value={m.id}>
                        {nombreSistema(m.id_sistema)} — {m.tipo} — {formatFecha(m.fecha_programada)} [{m.estado}]
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-muted" style={{ marginTop: 4 }}>
                    Solo se muestran mantenimientos en estado pendiente, confirmado o vencido.
                  </p>
                </div>

                {form.id_mantenimiento && (
                  <div className="form-group">
                    <label className="form-label">Establecimiento</label>
                    <input className="input" readOnly
                      value={
                        (() => {
                          const mant = mantenimientos.find(m => m.id === Number(form.id_mantenimiento))
                          const sis  = mant ? sistemas.find(s => s.id === mant.id_sistema) : null
                          return sis ? `ID establecimiento: ${sis.id_establecimiento}` : 'No disponible'
                        })()
                      }
                    />
                    <p className="text-sm text-muted" style={{ marginTop: 4 }}>
                      Asignado automáticamente según el sistema seleccionado.
                    </p>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Observación</label>
                  <textarea className="input" rows={3} value={form.observacion}
                    onChange={e => setForm(f => ({ ...f, observacion: e.target.value }))}
                    placeholder="Descripción o contexto de la alerta (opcional)" />
                </div>

                {errForm && <div className="alert alert-danger" style={{ marginTop: 8 }}>{errForm}</div>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModalCrear(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Crear alerta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
