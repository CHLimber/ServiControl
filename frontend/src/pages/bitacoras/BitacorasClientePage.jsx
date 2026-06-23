import { useState, useEffect } from 'react'
import { entidadesApi } from '../../api/entidades'
import { useAuth } from '../../context/AuthContext'
import { Users, NotebookPen } from 'lucide-react'

function formatFechaHora(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-BO')
}

export default function BitacorasClientePage() {
  const { puede } = useAuth()
  const puedeEditar = puede('editar_clientes')
  const [clientes, setClientes]             = useState([])
  const [clienteSel, setClienteSel]         = useState(null)
  const [notas, setNotas]                   = useState([])
  const [cargandoClientes, setCargandoClientes] = useState(true)
  const [cargandoNotas, setCargandoNotas]   = useState(false)
  const [nuevaNota, setNuevaNota]           = useState('')
  const [guardandoNota, setGuardandoNota]   = useState(false)
  const [busqueda, setBusqueda]             = useState('')
  const [filtroTipo, setFiltroTipo]         = useState('')

  useEffect(() => { cargarClientes() }, [])

  async function cargarClientes() {
    setCargandoClientes(true)
    try {
      const todas = await entidadesApi.listar()
      setClientes(todas.filter(e => e.cliente))
    } catch {
      // ignorar error
    } finally {
      setCargandoClientes(false)
    }
  }

  async function seleccionarCliente(cliente) {
    setClienteSel(cliente)
    setNotas([])
    setNuevaNota('')
    setCargandoNotas(true)
    try {
      const resultado = await entidadesApi.listarBitacora(cliente.id)
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
    if (!texto || !clienteSel) return
    setGuardandoNota(true)
    try {
      const nueva = await entidadesApi.crearNota(clienteSel.id, { nota: texto })
      setNotas(prev => [nueva, ...prev])
      setNuevaNota('')
    } catch {
      alert('No se pudo guardar la nota.')
    } finally {
      setGuardandoNota(false)
    }
  }

  const clientesFiltrados = clientes.filter(c => {
    const coincideBusqueda = c.nombre.toLowerCase().includes(busqueda.toLowerCase())
    const coincideTipo = filtroTipo === '' || c.tipo === filtroTipo
    return coincideBusqueda && coincideTipo
  })

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Bitácora por cliente</h1>
          <p className="page-subtitle">Historial de notas registradas sobre clientes (CU28)</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Panel izquierdo: lista de clientes */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              className="input"
              placeholder="Buscar cliente..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{ width: '100%' }}
            />
            <select className="input" style={{ width: '100%' }}
              value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
              <option value="">Todos los tipos</option>
              <option value="natural">Persona natural</option>
              <option value="juridica">Persona jurídica</option>
            </select>
          </div>
          {cargandoClientes ? (
            <div className="empty-state" style={{ padding: 20 }}>Cargando...</div>
          ) : clientesFiltrados.length === 0 ? (
            <div className="empty-state" style={{ padding: 20 }}>Sin clientes registrados.</div>
          ) : (
            <div style={{ maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
              {clientesFiltrados.map(c => (
                <button
                  key={c.id}
                  onClick={() => seleccionarCliente(c)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 16px',
                    background: clienteSel?.id === c.id ? 'var(--primary-50, rgba(59,130,246,0.1))' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{c.nombre}</div>
                  <div className="text-muted text-sm">
                    {c.tipo === 'natural' ? `CI: ${c.ci}` : c.nit ? `NIT: ${c.nit}` : '—'}
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="text-muted text-sm" style={{ padding: '8px 16px', borderTop: '1px solid var(--border)' }}>
            {clientesFiltrados.length} cliente{clientesFiltrados.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Panel derecho: notas */}
        {!clienteSel ? (
          <div className="card">
            <div className="empty-state">
              <div className="icon"><Users size={32} /></div>
              <p>Seleccioná un cliente para ver su bitácora.</p>
            </div>
          </div>
        ) : (
          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 16 }}>
              {clienteSel.nombre}
              <span className="text-muted text-sm" style={{ fontWeight: 400, marginLeft: 10 }}>
                {clienteSel.tipo === 'natural' ? `CI: ${clienteSel.ci}` : `NIT: ${clienteSel.nit || '—'}`}
              </span>
            </div>

            {/* Formulario nueva nota — solo si puede editar clientes */}
            {puedeEditar && (
              <form onSubmit={guardarNota} style={{ marginBottom: 24 }}>
                <div className="form-group">
                  <label className="form-label">Nueva nota</label>
                  <textarea
                    className="input"
                    rows={3}
                    value={nuevaNota}
                    onChange={e => setNuevaNota(e.target.value)}
                    placeholder="Escribí una observación sobre este cliente..."
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
                <p>Sin notas registradas para este cliente.</p>
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
