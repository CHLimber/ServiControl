import { useState, useEffect, useRef } from 'react'
import { finanzasApi } from '../../api/finanzas'
import { proyectosApi } from '../../api/proyectos'
import { entidadesApi } from '../../api/entidades'
import {
  TrendingUp, TrendingDown, Activity, Printer, Search,
  FileText, FileSpreadsheet, Database, Sparkles, Mic, MicOff,
} from 'lucide-react'

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

const TIPOS_PAGO   = ['anticipo', 'pago_parcial', 'pago_final', 'otro']
const METODOS_PAGO = ['efectivo', 'transferencia', 'QR', 'stripe', 'otro']
const CONCEPTOS    = ['materiales', 'viaticos', 'transporte', 'otro']

const HOY = new Date().toISOString().slice(0, 10)
const INICIO_AÑO = `${new Date().getFullYear()}-01-01`

const PERIODOS = [
  { label: 'Este año',        fi: INICIO_AÑO,                                    ff: HOY },
  { label: 'Últimos 6 meses', fi: new Date(Date.now() - 180*86400000).toISOString().slice(0,10), ff: HOY },
  { label: 'Este mes',        fi: HOY.slice(0,7)+'-01',                           ff: HOY },
  { label: 'Año anterior',    fi: `${new Date().getFullYear()-1}-01-01`,           ff: `${new Date().getFullYear()-1}-12-31` },
  { label: 'Personalizado',   fi: '',                                             ff: '' },
]

function descargarBlob(blob, nombre) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a); a.click(); a.remove()
  window.URL.revokeObjectURL(url)
}

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

// ── Pestaña: Reportes prediseñados (SQL estático) ─────────────────

function ReportesEstaticos() {
  const [catalogo, setCatalogo]   = useState([])
  const [clave, setClave]         = useState('')
  const [resultado, setResultado] = useState(null)
  const [cargando, setCargando]   = useState(false)
  const [exportando, setExportando] = useState('')
  const [error, setError]         = useState('')

  useEffect(() => {
    finanzasApi.listarReportesEstaticos()
      .then(lista => { setCatalogo(lista); if (lista.length) setClave(lista[0].clave) })
      .catch(() => setError('No se pudo cargar el catálogo de reportes.'))
  }, [])

  async function generar() {
    if (!clave) return
    setError(''); setCargando(true)
    try {
      setResultado(await finanzasApi.reporteEstatico(clave))
    } catch {
      setError('No se pudo generar el reporte.')
      setResultado(null)
    } finally {
      setCargando(false)
    }
  }

  async function exportar(formato) {
    setExportando(formato); setError('')
    try {
      const blob = await finanzasApi.exportarReporteEstatico(clave, formato)
      descargarBlob(blob, `reporte_${clave}.${formato}`)
    } catch {
      setError('No se pudo exportar (¿el reporte tiene datos?).')
    } finally {
      setExportando('')
    }
  }

  const seleccionado = catalogo.find(c => c.clave === clave)
  const esMonto = col => col.includes('Bs')

  return (
    <>
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 260 }}>
            <label className="form-label">Reporte prediseñado</label>
            <select className="input" value={clave} onChange={e => { setClave(e.target.value); setResultado(null) }}>
              {catalogo.map(c => <option key={c.clave} value={c.clave}>{c.titulo}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={generar} disabled={cargando || !clave}>
            <Database size={15} style={{ marginRight: 6 }} />
            {cargando ? 'Generando...' : 'Generar reporte'}
          </button>
          {resultado && (
            <>
              <button className="btn btn-ghost" onClick={() => exportar('pdf')} disabled={!!exportando}>
                <FileText size={15} style={{ marginRight: 6 }} />
                {exportando === 'pdf' ? 'Generando...' : 'PDF'}
              </button>
              <button className="btn btn-ghost" onClick={() => exportar('xlsx')} disabled={!!exportando}>
                <FileSpreadsheet size={15} style={{ marginRight: 6 }} />
                {exportando === 'xlsx' ? 'Generando...' : 'Excel'}
              </button>
            </>
          )}
        </div>
        {seleccionado && (
          <p className="text-muted text-sm" style={{ marginTop: 10, marginBottom: 0 }}>
            {seleccionado.descripcion} La consulta es fija: se ejecuta tal cual está definida en el sistema.
          </p>
        )}
        {error && <div className="alert alert-danger" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      {resultado && (
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 16 }}>
            {resultado.titulo}
            <span className="text-muted text-sm" style={{ fontWeight: 400, marginLeft: 8 }}>
              {resultado.filas.length} fila{resultado.filas.length !== 1 ? 's' : ''}
            </span>
          </div>
          {resultado.filas.length === 0 ? (
            <div className="empty-state">El reporte no tiene datos.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {resultado.columnas.map(c => (
                      <th key={c} style={esMonto(c) || typeof resultado.filas[0]?.[resultado.columnas.indexOf(c)] === 'number'
                        ? { textAlign: 'right' } : undefined}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultado.filas.map((fila, i) => (
                    <tr key={i}>
                      {fila.map((v, j) => (
                        <td key={j} style={typeof v === 'number' ? { textAlign: 'right', fontWeight: 500 } : undefined}>
                          {esMonto(resultado.columnas[j]) ? formatBs(v) : v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  )
}

// ── Pestaña: Reporte por IA (Claude + dictado de voz) ─────────────

const EJEMPLOS_IA = [
  'Resumen ejecutivo del año: ingresos, gastos, utilidad y 3 recomendaciones.',
  '¿Cómo evolucionó la utilidad mes a mes? Identificá los meses críticos.',
  '¿Qué proyectos tuvieron la mayor y menor utilidad? ¿Cuáles revisar?',
  '¿Cuál es la distribución de ingresos por tipo y método de pago?',
  '¿Qué cliente generó más ingresos y cómo está su historial de pagos?',
  'Analizá los gastos por concepto e identificá dónde se puede reducir.',
]

function SeccionTablaIA({ sec }) {
  const esMonto = col => /bs|monto|ingreso|gasto|utilidad|saldo|total|cobrado|pagado/i.test(col)
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 14 }}>{sec.titulo}</div>
      {!sec.filas?.length ? (
        <div className="empty-state">Sin datos para esta sección.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {sec.columnas.map(c => (
                  <th key={c} style={esMonto(c) ? { textAlign: 'right' } : undefined}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sec.filas.map((fila, j) => (
                <tr key={j}>
                  {fila.map((v, k) => {
                    const esNum = typeof v === 'number'
                    const esMon = esMonto(sec.columnas[k])
                    return (
                      <td key={k} style={(esNum || esMon) ? { textAlign: 'right', fontWeight: esNum ? 500 : undefined } : undefined}>
                        {esMon && esNum ? formatBs(v) : v}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ReporteIA() {
  const [consulta, setConsulta]     = useState('')
  const [resultado, setResultado]   = useState(null)
  const [resumen, setResumen]       = useState(null)
  const [periodo, setPeriodo]       = useState(null)
  const [cargando, setCargando]     = useState(false)
  const [exportando, setExportando] = useState('')
  const [error, setError]           = useState('')
  const [escuchando, setEscuchando] = useState(false)
  const recognitionRef = useRef(null)

  const vozSoportada = typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)

  useEffect(() => () => { recognitionRef.current?.stop() }, [])

  function toggleDictado() {
    if (escuchando) { recognitionRef.current?.stop(); return }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return
    const rec = new SpeechRecognition()
    rec.lang = 'es-BO'
    rec.interimResults = false
    rec.continuous = false
    rec.onresult = e => {
      const texto = Array.from(e.results).map(r => r[0].transcript).join(' ').trim()
      setConsulta(prev => (prev ? prev.trim() + ' ' : '') + texto)
    }
    rec.onerror = () => setEscuchando(false)
    rec.onend   = () => setEscuchando(false)
    recognitionRef.current = rec
    setEscuchando(true)
    rec.start()
  }

  async function generar(textoConsulta) {
    const q = (textoConsulta ?? consulta).trim()
    if (!q) { setError('Escribí o dictá una consulta.'); return }
    setError(''); setCargando(true); setResultado(null)
    try {
      const data = await finanzasApi.reporteIA({ consulta: q })
      setResultado(data.reporte)
      setResumen(data.resumen)
      setPeriodo(data.periodo)
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo generar el análisis por IA.')
    } finally {
      setCargando(false)
    }
  }

  async function exportar(formato) {
    setExportando(formato); setError('')
    try {
      const blob = await finanzasApi.exportarReporteIA({ reporte: resultado, resumen, periodo, formato })
      descargarBlob(blob, `reporte_ia_${new Date().toISOString().slice(0,10)}.${formato}`)
    } catch {
      setError('No se pudo exportar el reporte.')
    } finally {
      setExportando('')
    }
  }

  return (
    <>
      {/* Panel de consulta */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
          <Sparkles size={18} style={{ color: 'var(--accent)', marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 600 }}>Asistente financiero con IA</div>
            <p className="text-muted text-sm" style={{ margin: 0 }}>
              Hacé una pregunta sobre las finanzas del año en curso y Claude generará
              un reporte estructurado con tablas y conclusiones exportable a PDF o Excel.
            </p>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <textarea
            className="input"
            rows={3}
            style={{ resize: 'vertical', paddingRight: 48 }}
            placeholder="Ej: Resumen ejecutivo del año con ingresos, gastos y recomendaciones."
            value={consulta}
            onChange={e => setConsulta(e.target.value)}
          />
          {vozSoportada && (
            <button type="button" className="btn btn-ghost btn-sm"
              title={escuchando ? 'Detener dictado' : 'Dictar por voz'}
              onClick={toggleDictado}
              style={{ position: 'absolute', top: 8, right: 8,
                color: escuchando ? 'var(--danger)' : 'var(--text-muted)' }}>
              {escuchando ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}
        </div>

        {escuchando && (
          <div className="text-sm" style={{ color: 'var(--danger)', marginTop: 6 }}>
            Escuchando… hablá ahora.
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button className="btn btn-primary" onClick={() => generar()} disabled={cargando}>
            <Sparkles size={15} style={{ marginRight: 6 }} />
            {cargando ? 'Generando reporte…' : 'Generar reporte'}
          </button>
          {resultado && !cargando && (
            <>
              <button className="btn btn-ghost" onClick={() => exportar('pdf')} disabled={!!exportando}>
                <FileText size={15} style={{ marginRight: 6 }} />
                {exportando === 'pdf' ? 'Exportando…' : 'PDF'}
              </button>
              <button className="btn btn-ghost" onClick={() => exportar('xlsx')} disabled={!!exportando}>
                <FileSpreadsheet size={15} style={{ marginRight: 6 }} />
                {exportando === 'xlsx' ? 'Exportando…' : 'Excel'}
              </button>
              <button className="btn btn-ghost" onClick={() => window.print()}>
                <Printer size={14} style={{ marginRight: 6 }} />Imprimir
              </button>
            </>
          )}
        </div>

        <div style={{ marginTop: 14 }}>
          <div className="text-muted text-sm" style={{ marginBottom: 6 }}>Ejemplos:</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {EJEMPLOS_IA.map(ej => (
              <button key={ej} className="btn btn-ghost btn-sm"
                style={{ fontSize: 12, whiteSpace: 'normal', textAlign: 'left', maxWidth: 320 }}
                onClick={() => { setConsulta(ej); generar(ej) }} disabled={cargando}>
                {ej}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="alert alert-danger" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      {/* Cargando */}
      {cargando && (
        <div className="card">
          <div className="empty-state" style={{ padding: '40px 0' }}>
            <Sparkles size={32} style={{ color: 'var(--accent)', marginBottom: 12 }} />
            <p>Claude está generando el reporte…</p>
          </div>
        </div>
      )}

      {/* Resultado estructurado */}
      {resultado && !cargando && (
        <>
          {/* KPIs */}
          {resumen && (
            <div className="stats-grid" style={{ marginBottom: 20 }}>
              <div className="stat-card">
                <div className="stat-icon green"><TrendingUp size={20} /></div>
                <div className="stat-info">
                  <div className="stat-value">{formatBs(resumen.total_ingresos)}</div>
                  <div className="stat-label">Ingresos · {resumen.cantidad_pagos} pagos</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon red"><TrendingDown size={20} /></div>
                <div className="stat-info">
                  <div className="stat-value">{formatBs(resumen.total_gastos)}</div>
                  <div className="stat-label">Gastos · {resumen.cantidad_gastos} registros</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon blue"><Activity size={20} /></div>
                <div className="stat-info">
                  <div className="stat-value"
                    style={{ color: resumen.utilidad >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {formatBs(resumen.utilidad)}
                  </div>
                  <div className="stat-label">Utilidad neta</div>
                </div>
              </div>
            </div>
          )}

          {/* Encabezado del reporte */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={16} style={{ color: 'var(--accent)' }} />
              <span style={{ fontWeight: 600, fontSize: '1rem' }}>{resultado.titulo}</span>
            </div>
            {resultado.introduccion && (
              <p className="text-muted text-sm" style={{ margin: '8px 0 0' }}>
                {resultado.introduccion}
              </p>
            )}
          </div>

          {/* Secciones con tablas */}
          {resultado.secciones?.map((sec, i) => (
            <SeccionTablaIA key={i} sec={sec} />
          ))}

          {/* Conclusiones */}
          {resultado.conclusiones?.length > 0 && (
            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: 12 }}>Conclusiones y recomendaciones</div>
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                {resultado.conclusiones.map((c, i) => (
                  <li key={i} style={{ fontSize: 14, marginBottom: 2 }}>{c}</li>
                ))}
              </ul>
              <p className="text-muted text-sm" style={{ marginTop: 14, marginBottom: 0, fontStyle: 'italic' }}>
                Generado por Claude a partir de los datos reales del período. Verificá las cifras antes de tomar decisiones.
              </p>
            </div>
          )}
        </>
      )}
    </>
  )
}

// ── Pestaña: Reporte personalizado (filtros desde la interfaz) ────

export default function ReporteFinancieroPage() {
  const [pestania, setPestania]       = useState('personalizado')
  const [periodoIdx, setPeriodoIdx]   = useState(0)
  const [fechaInicio, setFechaInicio] = useState(INICIO_AÑO)
  const [fechaFin, setFechaFin]       = useState(HOY)
  const [tipoPago, setTipoPago]       = useState('')
  const [metodo, setMetodo]           = useState('')
  const [concepto, setConcepto]       = useState('')
  const [idProyecto, setIdProyecto]   = useState('')
  const [idEntidad, setIdEntidad]     = useState('')
  const [proyectos, setProyectos]     = useState([])
  const [clientes, setClientes]       = useState([])
  const [reporte, setReporte]         = useState(null)
  const [cargando, setCargando]       = useState(false)
  const [exportando, setExportando]   = useState('')
  const [error, setError]             = useState('')

  useEffect(() => {
    proyectosApi.listar()
      .then(data => setProyectos(Array.isArray(data) ? data : data?.items || []))
      .catch(() => {})
    entidadesApi.listar()
      .then(data => setClientes((Array.isArray(data) ? data : data?.items || []).filter(e => e.cliente)))
      .catch(() => {})
  }, [])

  function onCambiarPeriodo(idx) {
    setPeriodoIdx(idx)
    const p = PERIODOS[idx]
    if (p.fi) setFechaInicio(p.fi)
    if (p.ff) setFechaFin(p.ff)
  }

  function filtrosActuales() {
    return {
      fecha_inicio: fechaInicio,
      fecha_fin:    fechaFin,
      tipo_pago:    tipoPago,
      metodo,
      concepto,
      id_proyecto:  idProyecto,
      id_entidad:   idEntidad,
    }
  }

  async function generar() {
    if (!fechaInicio || !fechaFin) { setError('Ambas fechas son requeridas.'); return }
    if (fechaInicio > fechaFin) { setError('La fecha de inicio no puede ser posterior a la de fin.'); return }
    setError('')
    setCargando(true)
    try {
      const data = await finanzasApi.reporte(filtrosActuales())
      setReporte(data)
    } catch {
      setError('No se pudo generar el reporte. Intenta nuevamente.')
    } finally {
      setCargando(false)
    }
  }

  async function exportar(formato) {
    setExportando(formato); setError('')
    try {
      const params = Object.fromEntries(
        Object.entries({ ...filtrosActuales(), formato }).filter(([, v]) => v)
      )
      const blob = await finanzasApi.exportarReporte(params)
      descargarBlob(blob, `reporte_financiero_${fechaInicio}_${fechaFin}.${formato}`)
    } catch {
      setError('No se pudo exportar el reporte.')
    } finally {
      setExportando('')
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
        {pestania === 'personalizado' && reporte && (
          <button className="btn btn-ghost" onClick={() => window.print()}>
            <Printer size={15} style={{ marginRight: 6 }} />Imprimir
          </button>
        )}
      </div>

      {/* Pestañas */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={`btn ${pestania === 'personalizado' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setPestania('personalizado')}>
          <Search size={14} style={{ marginRight: 6 }} />Reporte personalizado
        </button>
        <button className={`btn ${pestania === 'estaticos' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setPestania('estaticos')}>
          <Database size={14} style={{ marginRight: 6 }} />Reportes prediseñados
        </button>
        <button className={`btn ${pestania === 'ia' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setPestania('ia')}>
          <Sparkles size={14} style={{ marginRight: 6 }} />Reporte por IA
        </button>
      </div>

      {pestania === 'ia' ? <ReporteIA /> : pestania === 'estaticos' ? <ReportesEstaticos /> : (
        <>
          {/* Filtros */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
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
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ margin: 0, minWidth: 150 }}>
                <label className="form-label">Tipo de pago</label>
                <select className="input" value={tipoPago} onChange={e => setTipoPago(e.target.value)}>
                  <option value="">Todos</option>
                  {TIPOS_PAGO.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0, minWidth: 150 }}>
                <label className="form-label">Método de pago</label>
                <select className="input" value={metodo} onChange={e => setMetodo(e.target.value)}>
                  <option value="">Todos</option>
                  {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0, minWidth: 150 }}>
                <label className="form-label">Concepto de gasto</label>
                <select className="input" value={concepto} onChange={e => setConcepto(e.target.value)}>
                  <option value="">Todos</option>
                  {CONCEPTOS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0, minWidth: 200 }}>
                <label className="form-label">Cliente</label>
                <select className="input" value={idEntidad} onChange={e => setIdEntidad(e.target.value)}>
                  <option value="">Todos los clientes</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0, minWidth: 220 }}>
                <label className="form-label">Proyecto</label>
                <select className="input" value={idProyecto} onChange={e => setIdProyecto(e.target.value)}>
                  <option value="">Todos los proyectos</option>
                  {proyectos.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.titulo}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" onClick={generar} disabled={cargando}>
                <Search size={14} style={{ marginRight: 6 }} />
                {cargando ? 'Generando...' : 'Generar reporte'}
              </button>
              {reporte && (
                <>
                  <button className="btn btn-ghost" onClick={() => exportar('pdf')} disabled={!!exportando}>
                    <FileText size={15} style={{ marginRight: 6 }} />
                    {exportando === 'pdf' ? 'Generando...' : 'PDF'}
                  </button>
                  <button className="btn btn-ghost" onClick={() => exportar('xlsx')} disabled={!!exportando}>
                    <FileSpreadsheet size={15} style={{ marginRight: 6 }} />
                    {exportando === 'xlsx' ? 'Generando...' : 'Excel'}
                  </button>
                </>
              )}
            </div>
            {error && <div className="alert alert-danger" style={{ marginTop: 12 }}>{error}</div>}
          </div>

          {!reporte && !cargando && (
            <div className="card">
              <div className="empty-state" style={{ padding: '40px 0' }}>
                <Activity size={36} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
                <p>Seleccioná los filtros y hacé clic en <strong>Generar reporte</strong>.</p>
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
      )}
    </>
  )
}
