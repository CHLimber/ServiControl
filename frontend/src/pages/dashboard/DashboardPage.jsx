import { Building2, Wrench, FileText, Hammer, TrendingUp, Users } from 'lucide-react'
import { formatBs } from '../../utils'

const STATS = [
  { icon: <Building2 size={20} />, color: 'blue',   valor: 12,         label: 'Proyectos activos',     delta: '+2 este mes',     tipo: 'up' },
  { icon: <Wrench size={20} />,   color: 'yellow', valor: 8,          label: 'OT pendientes',          delta: '3 vencidas',      tipo: 'down' },
  { icon: <FileText size={20} />, color: 'purple', valor: 5,          label: 'Cotizaciones en espera', delta: '+1 hoy',          tipo: 'up' },
  { icon: <Hammer size={20} />,   color: 'green',  valor: 3,          label: 'Mantenimientos próximos',delta: 'Esta semana',     tipo: 'up' },
  { icon: <TrendingUp size={20} />,color: 'green', valor: 'Bs 42.800',label: 'Cobrado este mes',       delta: '+18% vs anterior',tipo: 'up' },
  { icon: <Users size={20} />,    color: 'blue',   valor: 47,         label: 'Clientes registrados',   delta: '+4 este mes',     tipo: 'up' },
]

const PROYECTOS_RECIENTES = [
  { id: 1, nombre: 'CCTV Edificio Los Pinos',    cliente: 'Importadora Rojas SRL', estado: 'En ejecución', monto: 18500, avance: 65 },
  { id: 2, nombre: 'Cerco eléctrico Urb. Norte', cliente: 'Carlos Méndez Ríos',    estado: 'Planificación', monto: 7200,  avance: 10 },
  { id: 3, nombre: 'Control acceso ENERSOL',     cliente: 'ENERSOL SA',            estado: 'En ejecución', monto: 31000, avance: 40 },
  { id: 4, nombre: 'Alarma residencia Piraí',    cliente: 'Lucía Vargas Pedraza',  estado: 'Finalizado',   monto: 4800,  avance: 100 },
]

const OT_RECIENTES = [
  { id: 101, titulo: 'Revisión cámaras piso 3',    tecnico: 'Juan Torrez',    prioridad: 'alta',   estado: 'Asignada' },
  { id: 102, titulo: 'Mantenimiento DVR principal', tecnico: 'Mario Aguilar', prioridad: 'media',  estado: 'En proceso' },
  { id: 103, titulo: 'Cambio sensor puerta 2',      tecnico: 'Juan Torrez',   prioridad: 'baja',   estado: 'Asignada' },
  { id: 104, titulo: 'Instalación teclado acceso',  tecnico: 'Luis Pedraza',  prioridad: 'urgente',estado: 'Pendiente' },
]

const BADGE_ESTADO = {
  'En ejecución': 'badge-blue',
  'Planificación': 'badge-yellow',
  'Finalizado':   'badge-green',
  'Pausado':      'badge-gray',
}

const BADGE_PRIORIDAD = {
  urgente: 'badge-red',
  alta:    'badge-yellow',
  media:   'badge-blue',
  baja:    'badge-gray',
}

const BADGE_OT = {
  'Asignada':   'badge-blue',
  'En proceso': 'badge-yellow',
  'Pendiente':  'badge-gray',
  'Completada': 'badge-green',
}

export default function DashboardPage() {
  return (
    <>
      {/* Stats */}
      <div className="stats-grid">
        {STATS.map((s, i) => (
          <div key={i} className="stat-card">
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
            <button className="btn btn-ghost btn-sm">Ver todos</button>
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
                {PROYECTOS_RECIENTES.map(p => (
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
                    <td className="text-sm">{formatBs(p.monto)}</td>
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
            <button className="btn btn-ghost btn-sm">Ver todas</button>
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
                {OT_RECIENTES.map(o => (
                  <tr key={o.id}>
                    <td className="text-muted text-sm">{o.id}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{o.titulo}</div>
                      <div className="text-muted text-sm">{o.tecnico}</div>
                    </td>
                    <td>
                      <span className={`badge ${BADGE_PRIORIDAD[o.prioridad]}`}>
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
