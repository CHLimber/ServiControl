import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Wrench, FileText, Hammer, TrendingUp, Users, AlertCircle, RefreshCw } from 'lucide-react'
import { formatBs } from '../../utils'
import { dashboardApi } from '../../api/dashboard'

const BADGE_ESTADO = {
  'Levantamiento': 'badge-gray',
  'Cotizado':      'badge-purple',
  'Aprobado':      'badge-blue',
  'En Ejecución':  'badge-orange',
  'En Ejecucion':  'badge-orange',
  'Detenido':      'badge-yellow',
  'Bloqueado':     'badge-red',
  'Completado':    'badge-green',
  'En Garantía':   'badge-green',
  'En Garantia':   'badge-green',
  'Cerrado':       'badge-gray',
  'Cancelado':     'badge-red',
}

const BADGE_PRIORIDAD = {
  urgente: 'badge-red',
  alta:    'badge-yellow',
  media:   'badge-blue',
  baja:    'badge-gray',
}

const BADGE_OT = {
  'Creada':     'badge-gray',
  'Asignada':   'badge-blue',
  'En Camino':  'badge-purple',
  'Iniciada':   'badge-orange',
  'En Pausa':   'badge-yellow',
  'Completada': 'badge-green',
  'Validada':   'badge-green',
  'Cancelada':  'badge-red',
}

function buildStats(data) {
  const s = data?.stats || {}
  const cobrado = s.cobrado_mes ?? 0
  const deltaPct = s.cobrado_delta_pct ?? 0
  const deltaCobrado = deltaPct === 0
    ? 'Sin movimientos previos'
    : `${deltaPct > 0 ? '+' : ''}${deltaPct}% vs mes anterior`

  return [
    {
      icon: <Building2 size={20} />, color: 'blue',
      valor: s.proyectos_activos ?? 0,
      label: 'Proyectos activos',
      delta: `${s.proyectos_nuevos_mes ?? 0} este mes`,
      tipo: 'up',
    },
    {
      icon: <Wrench size={20} />, color: 'yellow',
      valor: s.ot_pendientes ?? 0,
      label: 'OT pendientes',
      delta: (s.ot_vencidas ?? 0) > 0 ? `${s.ot_vencidas} vencidas` : 'Al día',
      tipo: (s.ot_vencidas ?? 0) > 0 ? 'down' : 'up',
    },
    {
      icon: <FileText size={20} />, color: 'purple',
      valor: s.cotizaciones_espera ?? 0,
      label: 'Cotizaciones en espera',
      delta: `${s.cotizaciones_nuevas_hoy ?? 0} hoy`,
      tipo: 'up',
    },
    {
      icon: <Hammer size={20} />, color: 'green',
      valor: s.mantenimientos_proximos ?? 0,
      label: 'Mantenimientos próximos',
      delta: 'Próximos 7 días',
      tipo: 'up',
    },
    {
      icon: <TrendingUp size={20} />, color: 'green',
      valor: formatBs(cobrado),
      label: 'Cobrado este mes',
      delta: deltaCobrado,
      tipo: deltaPct >= 0 ? 'up' : 'down',
    },
    {
      icon: <Users size={20} />, color: 'blue',
      valor: s.clientes_total ?? 0,
      label: 'Clientes registrados',
      delta: `+${s.clientes_nuevos_mes ?? 0} este mes`,
      tipo: 'up',
    },
  ]
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const cargar = async () => {
    setCargando(true)
    setError('')
    try {
      const res = await dashboardApi.resumen()
      setData(res)
    } catch (e) {
      setError(e?.error || 'No se pudo cargar el dashboard')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargar() }, [])

  if (cargando && !data) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 48 }}>
        <div className="text-muted">Cargando dashboard…</div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 48 }}>
        <AlertCircle size={32} style={{ color: 'var(--danger)', marginBottom: 12 }} />
        <div style={{ marginBottom: 16 }}>{error}</div>
        <button className="btn btn-primary btn-sm" onClick={cargar}>
          <RefreshCw size={14} /> Reintentar
        </button>
      </div>
    )
  }

  const stats = buildStats(data)
  const proyectos = data?.proyectos_recientes || []
  const ordenes = data?.ordenes_recientes || []

  return (
    <>
      {/* Stats */}
      <div className="stats-grid">
        {stats.map((s, i) => (
          <div key={i} className={`stat-card ${s.color}`}>
            <div className={`stat-icon ${s.color}`}>{s.icon}</div>
            <div className="stat-info">
              <div className="stat-value">{s.valor}</div>
              <div className="stat-label">{s.label}</div>
              <div className={`stat-delta ${s.tipo}`}>{s.delta}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tablas */}
      <div className="grid-2">
        {/* Proyectos recientes */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Proyectos recientes</span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate('/proyectos')}
            >
              Ver todos
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Proyecto</th>
                  <th>Estado</th>
                  <th>Avance</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody>
                {proyectos.length === 0 && (
                  <tr><td colSpan={4} className="text-muted text-sm" style={{ textAlign: 'center', padding: 16 }}>
                    Sin proyectos registrados
                  </td></tr>
                )}
                {proyectos.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{p.nombre}</div>
                      <div className="text-muted text-sm">{p.cliente}</div>
                    </td>
                    <td>
                      <span className={`badge ${BADGE_ESTADO[p.estado] || 'badge-gray'}`}>
                        {p.estado}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          flex: 1, height: 6, borderRadius: 3,
                          background: 'var(--border)', overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${p.avance}%`, height: '100%',
                            background: p.avance === 100 ? 'var(--success)' : 'var(--accent)',
                            borderRadius: 3
                          }} />
                        </div>
                        <span className="text-sm text-muted">{p.avance}%</span>
                      </div>
                    </td>
                    <td className="text-sm">{p.monto ? formatBs(p.monto) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* OT recientes */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Órdenes de trabajo</span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate('/ordenes')}
            >
              Ver todas
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Tarea</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {ordenes.length === 0 && (
                  <tr><td colSpan={4} className="text-muted text-sm" style={{ textAlign: 'center', padding: 16 }}>
                    Sin órdenes registradas
                  </td></tr>
                )}
                {ordenes.map(o => (
                  <tr key={o.id}>
                    <td className="text-muted text-sm">{o.codigo}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{o.titulo}</div>
                      <div className="text-muted text-sm">{o.tecnico}</div>
                    </td>
                    <td>
                      <span className={`badge ${BADGE_PRIORIDAD[o.prioridad] || 'badge-gray'}`}>
                        {o.prioridad}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${BADGE_OT[o.estado] || 'badge-gray'}`}>
                        {o.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
