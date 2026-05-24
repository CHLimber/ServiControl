import { useState } from 'react'
import { finanzasApi } from '../../api/finanzas'
import { TrendingUp, TrendingDown, Activity, Printer, Search } from 'lucide-react'

function formatBs(n) {
  return `Bs ${Number(n || 0).toLocaleString('es-BO', { minimumFractionDigits: 2 })}`
}
function formatMes(ym) {
  if (!ym || ym === 'sin-fecha') return '—'
  const [y, m] = ym.split('-')
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${meses[parseInt(m, 10) - 1]} ${y}`
}

const COLORES_TIPO = {
  anticipo:     '#3b82f6',
  pago_parcial: '#f59e0b',
  pago_final:   '#10b981',
  otro:         '#6b7280',
}
const COLORES_CONCEPTO = {
  materiales:  '#8b5cf6',
  viaticos:    '#f59e0b',
  transporte:  '#3b82f6',
  otro:        '#6b7280',
}

const HOY = new Date().toISOString().slice(0, 10)
const INICIO_AÑO = `${new Date().getFullYear()}-01-01`

const PERIODOS = [
  { label: 'Este año',        fi: INICIO_AÑO,                                    ff: HOY },
  { label: 'Últimos 6 meses', fi: new Date(Date.now() - 180*86400000).toISOString().slice(0,10), ff: HOY },
  { label: 'Este mes',        fi: HOY.slice(0,7)+'-01',                           ff: HOY },
  { label: 'Año anterior',    fi: `${new Date().getFullYear()-1}-01-01`,           ff: `${new Date().getFullYear()-1}-12-31` },
  { label: 'Personalizado',   fi: '',                                             ff: '' },
]

function BarraHorizontal({ valor, maximo, color = 'var(--accent)', label, sublabel }) {
  const pct = maximo > 0 ? Math.min(100, (valor / maximo) * 100) : 0
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
        <span style={{ fontWeight: 500 }}>{label}</span>
        <span style={{ color: 'var(--text-muted)' }}>{sublabel}</span>
      </div>
      <div style={{ background: 'var(--border)', borderRadius: 4, height: 12, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}

function GraficoMensual({ datos }) {
  if (!datos || datos.length === 0) return <div className="text-muted text-sm">Sin datos en el período.</div>
  const maxVal = Math.max(...datos.flatMap(d => [d.ingresos, d.gastos]), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, paddingBottom: 20, position: 'relative', overflowX: 'auto' }}>
      {datos.map(d => (
        <div key={d.mes} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 44, flex: '0 0 44px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 90 }}>
            <div title={`Ingresos: ${formatBs(d.ingresos)}`} style={{
              width: 16, background: '#10b981', borderRadius: '3px 3px 0 0',
              height: `${(d.ingresos / maxVal) * 90}px`, minHeight: d.ingresos > 0 ? 2 : 0,
            }} />
            <div title={`Gastos: ${formatBs(d.gastos)}`} style={{
              width: 16, background: '#ef4444', borderRadius: '3px 3px 0 0',
              height: `${(d.gastos / maxVal) * 90}px`, minHeight: d.gastos > 0 ? 2 : 0,
            }} />
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>
            {formatMes(d.mes)}
          </div>
        </div>
      ))}
      <div style={{ position: 'absolute', bottom: 0, left: 0, display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-muted)' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#10b981', borderRadius: 2, marginRight: 4 }} />Ingresos</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#ef4444', borderRadius: 2, marginRight: 4 }} />Gastos</span>
      </div>
    </div>
  )
}

export default function ReporteFinancieroPage() {
  const [periodoIdx, setPeriodoIdx]   = useState(0)
  const [fechaInicio, setFechaInicio] = useState(INICIO_AÑO)
  const [fechaFin, setFechaFin]       = useState(HOY)
  const [reporte, setReporte]         = useState(null)
  const [cargando, setCargando]       = useState(false)
  const [error, setError]             = useState('')

  function onCambiarPeriodo(idx) {
    setPeriodoIdx(idx)
    const p = PERIODOS[idx]
    if (p.fi) setFechaInicio(p.fi)
    if (p.ff) setFechaFin(p.ff)
  }

  async function generar() {
    if (!fechaInicio || !fechaFin) { setError('Ambas fechas son requeridas.'); return }
    if (fechaInicio > fechaFin) { setError('La fecha de inicio no puede ser posterior a la de fin.'); return }
    setError('')
    setCargando(true)
    try {
      const data = await finanzasApi.reporte({ fecha_inicio: fechaInicio, fecha_fin: fechaFin })
      setReporte(data)
    } catch {
      setError('No se pudo generar el reporte. Intenta nuevamente.')
    } finally {
      setCargando(false)
    }
  }

  const r = reporte?.resumen
  const margen = r && r.total_ingresos > 0
    ? ((r.utilidad / r.total_ingresos) * 100).toFixed(1)
    : null
  const maxIngTipo = reporte ? Math.max(...(reporte.por_tipo_pago.map(x => x.total)), 1) : 1
  const maxGasCon  = reporte ? Math.max(...(reporte.por_concepto_gasto.map(x => x.total)), 1) : 1

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reporte financiero</h1>
          <p className="page-subtitle">Vista consolidada de ingresos, gastos y utilidad por período</p>
        </div>
        {reporte && (
          <button className="btn btn-ghost" onClick={() => window.print()}>
            <Printer size={15} style={{ marginRight: 6 }} />Imprimir
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Período</label>
            <select className="input" style={{ minWidth: 180 }} value={periodoIdx}
              onChange={e => onCambiarPeriodo(Number(e.target.value))}>
              {PERIODOS.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Desde</label>
            <input type="date" className="input" value={fechaInicio}
              onChange={e => { setFechaInicio(e.target.value); setPeriodoIdx(4) }} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Hasta</label>
            <input type="date" className="input" value={fechaFin}
              onChange={e => { setFechaFin(e.target.value); setPeriodoIdx(4) }} />
          </div>
          <button className="btn btn-primary" onClick={generar} disabled={cargando}
            style={{ alignSelf: 'flex-end', paddingBottom: 9 }}>
            <Search size={14} style={{ marginRight: 6 }} />
            {cargando ? 'Generando...' : 'Generar reporte'}
          </button>
        </div>
        {error && <div className="alert alert-danger" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      {!reporte && !cargando && (
        <div className="card">
          <div className="empty-state" style={{ padding: '40px 0' }}>
            <Activity size={36} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
            <p>Seleccioná un período y hacé clic en <strong>Generar reporte</strong>.</p>
          </div>
        </div>
      )}

      {reporte && (
        <>
          {/* KPIs */}
          <div className="stats-grid" style={{ marginBottom: 20 }}>
            <div className="stat-card">
              <div className="stat-icon green"><TrendingUp size={20} /></div>
              <div className="stat-info">
                <div className="stat-value">{formatBs(r.total_ingresos)}</div>
                <div className="stat-label">Ingresos · {r.cantidad_pagos} pago{r.cantidad_pagos !== 1 ? 's' : ''}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon red"><TrendingDown size={20} /></div>
              <div className="stat-info">
                <div className="stat-value">{formatBs(r.total_gastos)}</div>
                <div className="stat-label">Gastos · {r.cantidad_gastos} registro{r.cantidad_gastos !== 1 ? 's' : ''}</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: r.utilidad >= 0 ? 'var(--success-bg, #d1fae5)' : 'var(--danger-bg, #fee2e2)' }}>
                <Activity size={20} style={{ color: r.utilidad >= 0 ? 'var(--success)' : 'var(--danger)' }} />
              </div>
              <div className="stat-info">
                <div className="stat-value" style={{ color: r.utilidad >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {formatBs(r.utilidad)}
                </div>
                <div className="stat-label">Utilidad neta</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon blue"><Activity size={20} /></div>
              <div className="stat-info">
                <div className="stat-value">{margen !== null ? `${margen}%` : '—'}</div>
                <div className="stat-label">Margen sobre ingresos</div>
              </div>
            </div>
          </div>

          {/* Distribución */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Ingresos por tipo */}
            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 16 }}>Ingresos por tipo de pago</div>
              {reporte.por_tipo_pago.length === 0 ? (
                <div className="text-muted text-sm">Sin pagos en el período.</div>
              ) : reporte.por_tipo_pago.map(x => (
                <BarraHorizontal key={x.tipo} label={x.tipo} valor={x.total} maximo={maxIngTipo}
                  sublabel={`${formatBs(x.total)} (${x.porcentaje}%)`}
                  color={COLORES_TIPO[x.tipo] || 'var(--accent)'} />
              ))}
            </div>

            {/* Gastos por concepto */}
            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 16 }}>Gastos por concepto</div>
              {reporte.por_concepto_gasto.length === 0 ? (
                <div className="text-muted text-sm">Sin gastos en el período.</div>
              ) : reporte.por_concepto_gasto.map(x => (
                <BarraHorizontal key={x.concepto} label={x.concepto} valor={x.total} maximo={maxGasCon}
                  sublabel={`${formatBs(x.total)} (${x.porcentaje}%)`}
                  color={COLORES_CONCEPTO[x.concepto] || '#6b7280'} />
              ))}
            </div>
          </div>

          {/* Evolución mensual */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 16 }}>Evolución mensual</div>
            <GraficoMensual datos={reporte.por_mes} />
          </div>

          {/* Detalle por proyecto */}
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 16 }}>
              Detalle por proyecto
              <span className="text-muted text-sm" style={{ fontWeight: 400, marginLeft: 8 }}>
                {reporte.por_proyecto.length} proyecto{reporte.por_proyecto.length !== 1 ? 's' : ''} con actividad
              </span>
            </div>
            {reporte.por_proyecto.length === 0 ? (
              <div className="empty-state">Sin proyectos con actividad en el período.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Proyecto</th>
                      <th>Cliente</th>
                      <th style={{ textAlign: 'right' }}>Ingresos</th>
                      <th style={{ textAlign: 'right' }}>Gastos</th>
                      <th style={{ textAlign: 'right' }}>Utilidad</th>
                      <th style={{ width: 120 }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reporte.por_proyecto.map(p => {
                      const maxAbs = Math.max(Math.abs(p.ingresos), Math.abs(p.gastos), 1)
                      return (
                        <tr key={p.id_proyecto}>
                          <td><code style={{ fontSize: 12 }}>{p.codigo}</code></td>
                          <td style={{ fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.titulo}
                          </td>
                          <td className="text-sm text-muted">{p.cliente}</td>
                          <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 500 }}>
                            {formatBs(p.ingresos)}
                          </td>
                          <td style={{ textAlign: 'right', color: 'var(--danger)', fontWeight: 500 }}>
                            {formatBs(p.gastos)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700,
                            color: p.utilidad >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {formatBs(p.utilidad)}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 2, alignItems: 'center', height: 14 }}>
                              <div title="Ingresos" style={{
                                height: 14, borderRadius: '3px 0 0 3px',
                                background: '#10b981',
                                width: `${(p.ingresos / maxAbs) * 50}%`,
                              }} />
                              <div title="Gastos" style={{
                                height: 14, borderRadius: '0 3px 3px 0',
                                background: '#ef4444',
                                width: `${(p.gastos / maxAbs) * 50}%`,
                              }} />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                      <td colSpan={3}>TOTAL</td>
                      <td style={{ textAlign: 'right', color: 'var(--success)' }}>{formatBs(r.total_ingresos)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--danger)' }}>{formatBs(r.total_gastos)}</td>
                      <td style={{ textAlign: 'right', color: r.utilidad >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {formatBs(r.utilidad)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
