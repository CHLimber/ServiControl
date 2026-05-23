import { useState, useEffect } from 'react'
import { proyectosApi } from '../../api/proyectos'
import { catalogosApi } from '../../api/catalogos'
import { FolderOpen, FileText, ExternalLink } from 'lucide-react'

function formatFechaHora(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-BO')
}

const FORM_VACIO = { nombre: '', ruta: '', id_tipo_documento: '', descripcion: '' }

export default function DocumentosPage() {
  const [proyectos, setProyectos]         = useState([])
  const [proyectoSel, setProyectoSel]     = useState(null)
  const [documentos, setDocumentos]       = useState([])
  const [tipos, setTipos]                 = useState([])
  const [cargando, setCargando]           = useState(true)
  const [cargandoDocs, setCargandoDocs]   = useState(false)
  const [busqueda, setBusqueda]           = useState('')
  const [mostrarForm, setMostrarForm]     = useState(false)
  const [form, setForm]                   = useState(FORM_VACIO)
  const [guardando, setGuardando]         = useState(false)
  const [error, setError]                 = useState('')

  useEffect(() => {
    Promise.all([cargarProyectos(), cargarTipos()])
  }, [])

  async function cargarProyectos() {
    setCargando(true)
    try {
      const data = await proyectosApi.listar()
      setProyectos(data)
    } finally {
      setCargando(false)
    }
  }

  async function cargarTipos() {
    try {
      const data = await catalogosApi.tiposDocumento()
      setTipos(data)
    } catch {
      // ignorar
    }
  }

  async function seleccionarProyecto(proyecto) {
    setProyectoSel(proyecto)
    setDocumentos([])
    setMostrarForm(false)
    setForm(FORM_VACIO)
    setError('')
    setCargandoDocs(true)
    try {
      const data = await proyectosApi.listarDocumentos(proyecto.id)
      setDocumentos(data)
    } finally {
      setCargandoDocs(false)
    }
  }

  async function handleSubir(e) {
    e.preventDefault()
    if (!proyectoSel) return
    setError('')

    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    if (!form.ruta.trim()) { setError('La URL o ruta del documento es requerida'); return }
    if (!form.id_tipo_documento) { setError('El tipo de documento es requerido'); return }

    setGuardando(true)
    try {
      const nuevo = await proyectosApi.subirDocumento(proyectoSel.id, {
        nombre: form.nombre.trim(),
        ruta: form.ruta.trim(),
        id_tipo_documento: Number(form.id_tipo_documento),
        descripcion: form.descripcion.trim() || null,
      })
      setDocumentos(prev => [nuevo, ...prev])
      setForm(FORM_VACIO)
      setMostrarForm(false)
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudo registrar el documento.')
    } finally {
      setGuardando(false)
    }
  }

  const proyectosFiltrados = proyectos.filter(p =>
    p.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.codigo.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Documentos adjuntos</h1>
          <p className="page-subtitle">Documentos adjuntos a proyectos (contratos, planos, informes)</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Panel izquierdo */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
            <input
              className="input"
              placeholder="Buscar proyecto..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          {cargando ? (
            <div className="empty-state" style={{ padding: 20 }}>Cargando...</div>
          ) : proyectosFiltrados.length === 0 ? (
            <div className="empty-state" style={{ padding: 20 }}>Sin proyectos.</div>
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
                  <div className="text-muted text-sm">{p.codigo}</div>
                </button>
              ))}
            </div>
          )}
          <div className="text-muted text-sm" style={{ padding: '8px 16px', borderTop: '1px solid var(--border)' }}>
            {proyectosFiltrados.length} proyecto{proyectosFiltrados.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Panel derecho */}
        {!proyectoSel ? (
          <div className="card">
            <div className="empty-state">
              <div className="icon"><FolderOpen size={32} /></div>
              <p>Seleccioná un proyecto para ver sus documentos.</p>
            </div>
          </div>
        ) : (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 16 }}>{proyectoSel.titulo}</span>
                <span className="text-muted text-sm" style={{ marginLeft: 10 }}>{proyectoSel.codigo}</span>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => { setMostrarForm(f => !f); setError('') }}
              >
                {mostrarForm ? 'Cancelar' : '+ Agregar documento'}
              </button>
            </div>

            {/* Formulario */}
            {mostrarForm && (
              <form onSubmit={handleSubir} style={{ marginBottom: 24, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Nombre *</label>
                    <input className="input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Contrato firmado" maxLength={255} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tipo de documento *</label>
                    <select className="input" value={form.id_tipo_documento} onChange={e => setForm(f => ({ ...f, id_tipo_documento: e.target.value }))}>
                      <option value="">Seleccionar...</option>
                      {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">URL o ruta del documento *</label>
                    <input className="input" value={form.ruta} onChange={e => setForm(f => ({ ...f, ruta: e.target.value }))} placeholder="https://... o /docs/archivo.pdf" maxLength={500} />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Descripción</label>
                    <input className="input" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Descripción opcional" />
                  </div>
                </div>
                {error && <p className="text-sm" style={{ color: 'var(--error)', marginTop: 8 }}>{error}</p>}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={guardando}>
                    {guardando ? 'Guardando...' : 'Registrar documento'}
                  </button>
                </div>
              </form>
            )}

            {/* Lista de documentos */}
            {cargandoDocs ? (
              <div className="text-muted text-sm">Cargando documentos...</div>
            ) : documentos.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <div className="icon"><FileText size={32} /></div>
                <p>Sin documentos adjuntos para este proyecto.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {documentos.map(d => (
                  <div
                    key={d.id}
                    style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 12,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{d.nombre}</div>
                      <div className="text-muted text-sm">
                        {d.tipo_documento} · {d.usuario} · {formatFechaHora(d.fecha_subida)}
                      </div>
                      {d.descripcion && <div className="text-sm" style={{ marginTop: 4 }}>{d.descripcion}</div>}
                    </div>
                    <a
                      href={d.ruta}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm"
                      style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <ExternalLink size={13} /> Ver
                    </a>
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
