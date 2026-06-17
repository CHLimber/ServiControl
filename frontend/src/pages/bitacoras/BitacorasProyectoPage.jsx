import { useState, useEffect } from 'react'
import { proyectosApi } from '../../api/proyectos'
import { useAuth } from '../../context/AuthContext'
import { ClipboardList, NotebookPen } from 'lucide-react'

function formatFechaHora(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-BO')
}

export default function BitacorasProyectoPage() {
  const { puede } = useAuth()
  const puedeEditar = puede('editar_proyectos')
  const [proyectos, setProyectos]           = useState([])
  const [proyectoSel, setProyectoSel]       = useState(null)
  const [notas, setNotas]                   = useState([])
  const [cargandoProyectos, setCargandoProyectos] = useState(true)
  const [cargandoNotas, setCargandoNotas]   = useState(false)
  const [nuevaNota, setNuevaNota]           = useState('')
  const [guardandoNota, setGuardandoNota]   = useState(false)
  const [busqueda, setBusqueda]             = useState('')
  const [filtroEstado, setFiltroEstado]     = useState('')

  useEffect(() => { cargarProyectos() }, [])

  async function cargarProyectos() {
    setCargandoProyectos(true)
    try {
      const data = await proyectosApi.listar()
      setProyectos(data)
    } catch {
      // ignorar
    } finally {
      setCargandoProyectos(false)
    }
  }

  async function seleccionarProyecto(proyecto) {
    setProyectoSel(proyecto)
    setNotas([])
    setNuevaNota('')
    setCargandoNotas(true)
    try {
      const resultado = await proyectosApi.listarBitacora(proyecto.id)
      setNotas(resultado)
    } catch {
      // sin notas
    } finally {
      setCargandoNotas(false)
    }
  }

  async function guardarNota(e) {
    e.preventDefault()
    const texto = nuevaNota.trim()
    if (!texto || !proyectoSel) return
    setGuardandoNota(true)
    try {
      const nueva = await proyectosApi.crearNota(proyectoSel.id, { nota: texto })
      setNotas(prev => [nueva, ...prev])
      setNuevaNota('')
    } catch {
      alert('No se pudo guardar la nota.')
    } finally {
      setGuardandoNota(false)
    }
  }

  const proyectosFiltrados = proyectos.filter(p => {
    const coincideBusqueda =
      p.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.codigo.toLowerCase().includes(busqueda.toLowerCase())
    const coincideEstado = filtroEstado === '' || p.estado_nombre === filtroEstado
    return coincideBusqueda && coincideEstado
  })

  const estadosPresentes = [...new Set(proyectos.map(p => p.estado_nombre).filter(Boolean))]

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Bitácora por proyecto</h1>
          <p className="page-subtitle">Historial de notas registradas sobre proyectos</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Panel izquierdo: lista de proyectos */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              className="input"
              placeholder="Buscar proyecto..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{ width: '100%' }}
            />
            <select className="input" style={{ width: '100%' }}
              value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              {estadosPresentes.map(es => <option key={es} value={es}>{es}</option>)}
            </select>
          </div>
          {cargandoProyectos ? (
            <div className="empty-state" style={{ padding: 20 }}>Cargando...</div>
          ) : proyectosFiltrados.length === 0 ? (
            <div className="empty-state" style={{ padding: 20 }}>Sin proyectos registrados.</div>
          ) : (
            <div style={{ maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
              {proyectosFiltrados.map(p => (
                <button
                  key={p.id}
                  onClick={() => seleccionarProyecto(p)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 16px',
                    background: proyectoSel?.id === p.id ? 'var(--primary-50, rgba(59,130,246,0.1))' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{p.titulo}</div>
                  <div className="text-muted text-sm">{p.codigo} · {p.estado_nombre || '—'}</div>
                </button>
              ))}
            </div>
          )}
          <div className="text-muted text-sm" style={{ padding: '8px 16px', borderTop: '1px solid var(--border)' }}>
            {proyectosFiltrados.length} proyecto{proyectosFiltrados.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Panel derecho: notas */}
        {!proyectoSel ? (
          <div className="card">
            <div className="empty-state">
              <div className="icon"><ClipboardList size={32} /></div>
              <p>Seleccioná un proyecto para ver su bitácora.</p>
            </div>
          </div>
        ) : (
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 16 }}>
              {proyectoSel.titulo}
              <span className="text-muted text-sm" style={{ fontWeight: 400, marginLeft: 10 }}>
                {proyectoSel.codigo}
              </span>
            </div>

            {/* Formulario nueva nota — solo si puede editar proyectos */}
            {puedeEditar && (
              <form onSubmit={guardarNota} style={{ marginBottom: 24 }}>
                <div className="form-group">
                  <label className="form-label">Nueva nota</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={nuevaNota}
                    onChange={e => setNuevaNota(e.target.value)}
                    placeholder="Escribí una observación sobre este proyecto..."
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={guardandoNota || !nuevaNota.trim()}
                  >
                    {guardandoNota ? 'Guardando...' : '+ Agregar nota'}
                  </button>
                </div>
              </form>
            )}

            {/* Listado de notas */}
            <div style={{ fontWeight: 600, marginBottom: 12 }}>
              Historial de notas{notas.length > 0 && ` (${notas.length})`}
            </div>
            {cargandoNotas ? (
              <div className="text-muted text-sm">Cargando notas...</div>
            ) : notas.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <div className="icon"><NotebookPen size={32} /></div>
                <p>Sin notas registradas para este proyecto.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {notas.map(n => (
                  <div
                    key={n.id}
                    style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 14px',
                    }}
                  >
                    <p className="text-sm" style={{ marginBottom: 6, whiteSpace: 'pre-wrap' }}>{n.nota}</p>
                    <div className="text-muted text-sm">
                      {n.usuario} · {formatFechaHora(n.fecha_creacion)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
