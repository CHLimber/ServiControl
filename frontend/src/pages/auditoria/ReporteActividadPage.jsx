import { useState, useEffect, useRef } from 'react'
import { getReporteActividad, exportarReporteActividad, getUsuariosConActividad } from '../../api/auditoria'
import {
  Building2, Wrench, Hammer, CreditCard, Users, Activity,
  BarChart3, FileText, FileSpreadsheet,
} from 'lucide-react'

function hace(dias) {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return d.toISOString().slice(0, 10)
}

function inicioDeMes() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

function inicioDeAnio() {
  return new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)
}

const PRESETS = [
  { label: 'Hoy',            desde: () => hace(0),      hasta: () => hace(0) },
  { label: 'Últimos 7 días', desde: () => hace(7),      hasta: () => hace(0) },
  { label: 'Últimos 30 días', desde: () => hace(30),    hasta: () => hace(0) },
  { label: 'Este mes',       desde: inicioDeMes,        hasta: () => hace(0) },
  { label: 'Este año',       desde: inicioDeAnio,       hasta: () => hace(0) },
]

function formatBs(n) {
  return `Bs ${Number(n || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const CARDS = [
  { key: 'proyectos_creados',         label: 'Proyectos creados',        Icono: Building2,  color: '#3b82f6' },
  { key: 'ot_generadas',              label: 'Órdenes generadas',        Icono: Wrench,     color: '#8b5cf6' },
  { key: 'mantenimientos_ejecutados', label: 'Mantenimientos ejecutados', Icono: Hammer,    color: '#f59e0b' },
  { key: 'pagos_registrados',         label: 'Pagos registrados',        Icono: CreditCard, color: '#10b981' },
  { key: 'usuarios_activos',          label: 'Usuarios activos',         Icono: Users,      color: '#06b6d4' },
  { key: 'acciones_registradas',      label: 'Acciones registradas',     Icono: Activity,   color: '#6b7280' },
]

const DESGLOSES = [
  { key: 'proyectos_por_estado',      titulo: 'Proyectos por estado',      color: '#3b82f6' },
  { key: 'ordenes_por_estado',        titulo: 'Órdenes por estado',        color: '#8b5cf6' },
  { key: 'mantenimientos_por_estado', titulo: 'Mantenimientos por estado', color: '#f59e0b' },
  { key: 'mantenimientos_por_tipo',   titulo: 'Mantenimientos por tipo',   color: '#f97316' },
  { key: 'pagos_por_metodo',          titulo: 'Pagos por método',          color: '#10b981' },
  { key: 'acciones_por_modulo',       titulo: 'Actividad por módulo',      color: '#06b6d4' },
  { key: 'top_usuarios',              titulo: 'Usuarios más activos',      color: '#ec4899' },
]

function TablaDesglose({ titulo, items, color }) {
  if (!items?.length) return null
  const max = Math.max(...items.map(i => i.cantidad), 1)
  const tieneMonto = items.some(i => i.monto !== undefined)
  return (
    <div className="card">
      <h3 className="card-title" style={{ marginBottom: 12, fontSize: '0.95rem' }}>{titulo}</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {items.map(item => (
            <tr key={item.nombre}>
              <td className="text-sm" style={{ padding: '4px 8px 4px 0', whiteSpace: 'nowrap' }}>
                {item.nombre}
              </td>
              <td style={{ width: '50%', padding: '4px 0' }}>
                <div style={{
                  height: 10, borderRadius: 5,
                  width: `${Math.max(4, (item.cantidad / max) * 100)}%`,
                  background: color, opacity: 0.85,
                }} />
              </td>
              <td className="text-sm" style={{ padding: '4px 0 4px 10px', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {item.cantidad}
                {tieneMonto && item.monto !== undefined && (
                  <span className="text-muted" style={{ fontWeight: 400, marginLeft: 8 }}>
                    {formatBs(item.monto)}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ReporteActividadPage() {
  const [desde, setDesde] = useState(hace(30))
  const [hasta, setHasta] = useState(hace(0))
  const [idUsuario, setIdUsuario] = useState('')
  const [usuarios, setUsuarios] = useState([])
  const [reporte, setReporte] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [exportando, setExportando] = useState('')
  const [error, setError] = useState('')
  const cargoInicial = useRef(false)

  useEffect(() => {
    getUsuariosConActividad().then(setUsuarios).catch(() => {})
  }, [])

  async function generar(params = null) {
    const filtros = params || { desde, hasta, ...(idUsuario && { id_usuario: idUsuario }) }
    setError('')
    if (filtros.desde > filtros.hasta) {
      setError('La fecha inicial no puede ser posterior a la final.')
      return
    }
    setCargando(true)
    try {
      const data = await getReporteActividad(filtros)
      setReporte(data)
    } catch (err) {
      setError(err?.error || 'No se pudo generar el reporte.')
      setReporte(null)
    } finally {
      setCargando(false)
    }
  }

  // Reporte por defecto al abrir la página: últimos 30 días
  useEffect(() => {
    if (cargoInicial.current) return
    cargoInicial.current = true
    generar({ desde: hace(30), hasta: hace(0) })
  }, [])

  function aplicarPreset(preset) {
    const d = preset.desde()
    const h = preset.hasta()
    setDesde(d)
    setHasta(h)
    generar({ desde: d, hasta: h, ...(idUsuario && { id_usuario: idUsuario }) })
  }

  async function exportar(formato) {
    setExportando(formato)
    setError('')
    try {
      const params = { desde, hasta, formato, ...(idUsuario && { id_usuario: idUsuario }) }
      const blob = await exportarReporteActividad(params)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte_actividad_${desde}_${hasta}.${formato}`
      document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      setError('No se pudo exportar el reporte.')
    } finally {
      setExportando('')
    }
  }

  const presetActivo = PRESETS.find(p => p.desde() === desde && p.hasta() === hasta)

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reporte de actividad</h1>
          <p className="page-subtitle">Resumen consolidado de la actividad operativa por período</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {PRESETS.map(p => (
            <button key={p.label}
              className={`btn ${presetActivo?.label === p.label ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              onClick={() => aplicarPreset(p)} disabled={cargando}>
              {p.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Desde</label>
            <input type="date" className="input" value={desde} onChange={e => setDesde(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Hasta</label>
            <input type="date" className="input" value={hasta} onChange={e => setHasta(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: 180 }}>
            <label className="form-label">Usuario</label>
            <select className="input" value={idUsuario} onChange={e => setIdUsuario(e.target.value)}>
              <option value="">Todos los usuarios</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={() => generar()} disabled={cargando}>
            <BarChart3 size={16} style={{ marginRight: 6 }} />
            {cargando ? 'Generando...' : 'Generar reporte'}
          </button>
          {reporte && (
            <>
              <button className="btn btn-ghost" onClick={() => exportar('pdf')} disabled={!!exportando}>
                <FileText size={16} style={{ marginRight: 6 }} />
                {exportando === 'pdf' ? 'Generando...' : 'Exportar PDF'}
              </button>
              <button className="btn btn-ghost" onClick={() => exportar('xlsx')} disabled={!!exportando}>
                <FileSpreadsheet size={16} style={{ marginRight: 6 }} />
                {exportando === 'xlsx' ? 'Generando...' : 'Exportar Excel'}
              </button>
            </>
          )}
        </div>
        {error && <div className="alert alert-danger" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      {!reporte ? (
        <div className="empty-state">
          <BarChart3 size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
          <div>{cargando ? 'Generando reporte...' : 'Definí un rango de fechas y generá el reporte.'}</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
            {CARDS.map(({ key, label, Icono, color }) => (
              <div key={key} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                  background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icono size={22} color={color} />
                </div>
                <div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, lineHeight: 1 }}>
                    {reporte.metricas[key]}
                  </div>
                  <div className="text-sm text-muted" style={{ marginTop: 4 }}>{label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, maxWidth: 360, marginBottom: 20 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10, flexShrink: 0,
              background: '#10b98122', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CreditCard size={22} color="#10b981" />
            </div>
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, lineHeight: 1 }}>
                {formatBs(reporte.metricas.monto_cobrado)}
              </div>
              <div className="text-sm text-muted" style={{ marginTop: 4 }}>Monto cobrado en el período</div>
            </div>
          </div>

          {reporte.desglose && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
              {DESGLOSES.map(({ key, titulo, color }) => (
                <TablaDesglose key={key} titulo={titulo} items={reporte.desglose[key]} color={color} />
              ))}
            </div>
          )}

          <p className="text-muted text-sm" style={{ marginTop: 16 }}>
            Período: {reporte.desde} al {reporte.hasta}
            {reporte.usuario && <> — Usuario: <strong>{reporte.usuario}</strong></>}
          </p>
        </>
      )}
    </>
  )
}
