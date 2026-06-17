import { useState, useEffect } from 'react'
import { getAuditoria, getAcciones, getModulos, exportarAuditoria } from '../../api/auditoria'
import { Download, FileText, FileSpreadsheet, Search } from 'lucide-react'

const FILTROS_VACIO = {
  q: '', usuario: '', accion: '', modulo: '', fecha_desde: '', fecha_hasta: '',
}

function hace(dias) {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return d.toISOString().slice(0, 10)
}

const PRESETS = [
  { label: 'Hoy',     desde: () => hace(0) },
  { label: '7 días',  desde: () => hace(7) },
  { label: '30 días', desde: () => hace(30) },
]

function formatFecha(iso) {
  if (!iso) return '—'
  return iso.slice(0, 16).replace('T', ' ')
}

export default function ExportarLogPage() {
  const [acciones, setAcciones] = useState([])
  const [modulos, setModulos]   = useState([])
  const [filtros, setFiltros]   = useState(FILTROS_VACIO)
  const [vista, setVista]       = useState(null)   // { items, total }
  const [cargando, setCargando] = useState(false)
  const [generando, setGenerando] = useState('')
  const [error, setError]       = useState('')
  const [exito, setExito]       = useState('')

  useEffect(() => {
    Promise.all([getAcciones(), getModulos()])
      .then(([ac, mo]) => { setAcciones(ac); setModulos(mo) })
      .catch(() => {})
  }, [])

  function cambiar(campo, valor) {
    setFiltros(f => ({ ...f, [campo]: valor }))
    setError(''); setExito('')
  }

  function paramsLimpios() {
    const params = { ...filtros }
    Object.keys(params).forEach(k => { if (!params[k]) delete params[k] })
    return params
  }

  async function previsualizar() {
    setError(''); setExito('')
    setCargando(true)
    try {
      const data = await getAuditoria({ ...paramsLimpios(), page: 1, per_page: 20 })
      setVista(data)
      if (!data.total) setError('No hay registros para los filtros aplicados.')
    } catch {
      setError('No se pudo consultar el log.')
      setVista(null)
    } finally {
      setCargando(false)
    }
  }

  async function exportar(formato) {
    setGenerando(formato)
    setError(''); setExito('')
    try {
      const blob = await exportarAuditoria({ ...paramsLimpios(), formato })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const marca = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')
      a.download = `auditoria_${marca}.${formato}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      setExito(`Archivo ${formato.toUpperCase()} generado correctamente.`)
    } catch {
      setError('No hay registros para los filtros aplicados, o ocurrió un error al generar el archivo.')
    } finally {
      setGenerando('')
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Exportar log de auditoría</h1>
          <p className="page-subtitle">Filtrá, previsualizá y descargá el historial en Excel, CSV o PDF</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 className="card-title" style={{ marginBottom: 16 }}>Filtros (opcionales)</h2>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <input className="input" style={{ flex: 2, minWidth: 200 }}
            placeholder="Buscar en descripción..."
            value={filtros.q} onChange={e => cambiar('q', e.target.value)} />
          <input className="input" style={{ flex: 1, minWidth: 140 }}
            placeholder="Usuario"
            value={filtros.usuario} onChange={e => cambiar('usuario', e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <select className="input" style={{ minWidth: 160, flex: 1 }}
            value={filtros.modulo} onChange={e => cambiar('modulo', e.target.value)}>
            <option value="">Todos los módulos</option>
            {modulos.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className="input" style={{ minWidth: 200, flex: 1 }}
            value={filtros.accion} onChange={e => cambiar('accion', e.target.value)}>
            <option value="">Todas las acciones</option>
            {acciones.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 20 }}>
          <div className="form-group" style={{ flex: 1, minWidth: 140, margin: 0 }}>
            <label className="form-label">Desde</label>
            <input type="date" className="input"
              value={filtros.fecha_desde} onChange={e => cambiar('fecha_desde', e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 140, margin: 0 }}>
            <label className="form-label">Hasta</label>
            <input type="date" className="input"
              value={filtros.fecha_hasta} onChange={e => cambiar('fecha_hasta', e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {PRESETS.map(p => (
              <button key={p.label} className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: '0.82rem' }}
                onClick={() => setFiltros(f => ({ ...f, fecha_desde: p.desde(), fecha_hasta: hace(0) }))}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}
        {exito && <div className="alert alert-success" style={{ marginBottom: 16 }}>{exito}</div>}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" disabled={cargando || !!generando}
            onClick={previsualizar}>
            <Search size={16} style={{ marginRight: 6 }} />
            {cargando ? 'Consultando...' : 'Generar vista previa'}
          </button>
          <button className="btn btn-ghost" disabled={!!generando}
            onClick={() => exportar('xlsx')}>
            <FileSpreadsheet size={16} style={{ marginRight: 6 }} />
            {generando === 'xlsx' ? 'Generando...' : 'Exportar Excel'}
          </button>
          <button className="btn btn-ghost" disabled={!!generando}
            onClick={() => exportar('csv')}>
            <FileSpreadsheet size={16} style={{ marginRight: 6 }} />
            {generando === 'csv' ? 'Generando...' : 'Exportar CSV'}
          </button>
          <button className="btn btn-ghost" disabled={!!generando}
            onClick={() => exportar('pdf')}>
            <FileText size={16} style={{ marginRight: 6 }} />
            {generando === 'pdf' ? 'Generando...' : 'Exportar PDF'}
          </button>
          <button className="btn btn-ghost" disabled={!!generando}
            onClick={() => { setFiltros(FILTROS_VACIO); setVista(null); setError(''); setExito('') }}>
            Limpiar filtros
          </button>
        </div>

        <p className="text-muted text-sm" style={{ marginTop: 16, marginBottom: 0 }}>
          <Download size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
          Se exportan hasta 10.000 registros que coincidan con los filtros.
        </p>
      </div>

      {vista && vista.total > 0 && (
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 14 }}>
            Vista previa
            <span className="text-muted text-sm" style={{ fontWeight: 400, marginLeft: 8 }}>
              mostrando {vista.items.length} de {vista.total} registro{vista.total !== 1 ? 's' : ''} que se exportarán
            </span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Módulo</th>
                  <th>Acción</th>
                  <th>Descripción</th>
                </tr>
              </thead>
              <tbody>
                {vista.items.map(item => (
                  <tr key={item.id}>
                    <td className="text-sm" style={{ whiteSpace: 'nowrap' }}>{formatFecha(item.fecha)}</td>
                    <td className="text-sm">{item.usuario || 'sistema'}</td>
                    <td className="text-sm">{item.modulo || '—'}</td>
                    <td className="text-sm"><code style={{ fontSize: 11 }}>{item.accion}</code></td>
                    <td className="text-sm" style={{ maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.descripcion}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
