import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificacionesApi } from '../../api/notificaciones'
import {
  AlertTriangle, Wrench, FolderOpen, CreditCard, Package,
  Bell, Check, CheckCheck, Trash2, ExternalLink,
} from 'lucide-react'

function formatFecha(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'Hace un momento'
  if (mins < 60) return `Hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `Hace ${hrs} h`
  const dias = Math.floor(hrs / 24)
  if (dias < 7)  return `Hace ${dias} día${dias !== 1 ? 's' : ''}`
  return d.toLocaleDateString('es-BO')
}

const TIPO_CONFIG = {
  alerta_mantenimiento: { Icono: AlertTriangle, color: '#f59e0b', badge: 'badge-yellow', label: 'Mantenimiento' },
  orden_asignada:       { Icono: Wrench,         color: '#3b82f6', badge: 'badge-blue',   label: 'Orden asignada' },
  proyecto_actualizado: { Icono: FolderOpen,      color: '#3b82f6', badge: 'badge-blue',   label: 'Proyecto' },
  pago_registrado:      { Icono: CreditCard,      color: '#10b981', badge: 'badge-green',  label: 'Pago' },
  stock_critico:        { Icono: Package,          color: '#ef4444', badge: 'badge-red',    label: 'Stock crítico' },
}

const FILTROS = [
  { key: 'todas',     label: 'Todas' },
  { key: 'no_leidas', label: 'Sin leer' },
  { key: 'leidas',    label: 'Leídas' },
]

export default function NotificacionesPage() {
  const navigate = useNavigate()
  const [notifs, setNotifs]     = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro]     = useState('todas')
  const [tipo, setTipo]         = useState('')
  const [marcando, setMarcando] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    try {
      const data = await notificacionesApi.listar()
      setNotifs(data)
    } catch {
      // silencioso
    } finally {
      setCargando(false)
    }
  }

  async function marcarLeida(id) {
    try {
      await notificacionesApi.marcarLeida(id)
      setNotifs(ns => ns.map(n => n.id === id ? { ...n, leida: true } : n))
    } catch {
      // silencioso
    }
  }

  async function marcarTodas() {
    setMarcando(true)
    try {
      await notificacionesApi.marcarTodas()
      setNotifs(ns => ns.map(n => ({ ...n, leida: true })))
    } catch {
      // silencioso
    } finally {
      setMarcando(false)
    }
  }

  async function eliminar(id) {
    try {
      await notificacionesApi.eliminar(id)
      setNotifs(ns => ns.filter(n => n.id !== id))
    } catch {
      // silencioso
    }
  }

  const visibles = notifs.filter(n => {
    if (filtro === 'no_leidas' && n.leida)  return false
    if (filtro === 'leidas'    && !n.leida) return false
    if (tipo && n.tipo !== tipo)            return false
    return true
  })

  const noLeidasCount = notifs.filter(n => !n.leida).length

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Notificaciones</h1>
          <p className="page-subtitle">
            {noLeidasCount > 0 ? `${noLeidasCount} sin leer` : 'Todo al día'}
          </p>
        </div>
        {noLeidasCount > 0 && (
          <button className="btn btn-primary" disabled={marcando} onClick={marcarTodas}>
            <CheckCheck size={16} style={{ marginRight: 6 }} />
            {marcando ? 'Marcando...' : 'Marcar todas como leídas'}
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {FILTROS.map(f => (
            <button key={f.key}
              className={`btn btn-sm ${filtro === f.key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFiltro(f.key)}>
              {f.label}
              {f.key === 'no_leidas' && noLeidasCount > 0 && (
                <span style={{
                  marginLeft: 6, background: '#ef4444', color: '#fff',
                  borderRadius: 10, fontSize: 11, padding: '0 6px',
                }}>
                  {noLeidasCount}
                </span>
              )}
            </button>
          ))}

          <div style={{ flex: 1 }} />

          <select className="input" style={{ minWidth: 180 }}
            value={tipo}
            onChange={e => setTipo(e.target.value)}>
            <option value="">Todos los tipos</option>
            {Object.entries(TIPO_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista */}
      {cargando ? (
        <div className="empty-state">Cargando notificaciones...</div>
      ) : visibles.length === 0 ? (
        <div className="empty-state">
          <Bell size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
          <div>No hay notificaciones{filtro !== 'todas' ? ' en este filtro' : ''}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visibles.map(n => {
            const cfg = TIPO_CONFIG[n.tipo] || { Icono: Bell, color: '#6b7280', badge: 'badge-gray', label: n.tipo }
            const { Icono } = cfg
            return (
              <div key={n.id} className="card"
                style={{ opacity: n.leida ? 0.6 : 1, borderLeft: `4px solid ${cfg.color}`, padding: '12px 16px' }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>

                  <div style={{ flexShrink: 0, marginTop: 2 }}>
                    <Icono size={20} color={cfg.color} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontWeight: n.leida ? 400 : 700 }}>{n.titulo}</span>
                      <span className={`badge ${cfg.badge}`}>{cfg.label}</span>
                      {!n.leida && (
                        <span style={{
                          background: '#3b82f6', color: '#fff', borderRadius: 4,
                          fontSize: 10, padding: '1px 6px', fontWeight: 600,
                        }}>
                          Nueva
                        </span>
                      )}
                    </div>
                    <div className="text-sm" style={{ marginBottom: 4 }}>{n.mensaje}</div>
                    <div className="text-sm text-muted">{formatFecha(n.fecha_creacion)}</div>
                  </div>

                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {n.url && (
                      <button className="btn btn-ghost btn-sm" title="Ir al detalle"
                        onClick={() => navigate(n.url)}>
                        <ExternalLink size={14} />
                      </button>
                    )}
                    {!n.leida && (
                      <button className="btn btn-ghost btn-sm" title="Marcar como leída"
                        onClick={() => marcarLeida(n.id)}>
                        <Check size={14} />
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" title="Eliminar notificación"
                      onClick={() => eliminar(n.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>

                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
