import { useState, useEffect, useRef } from 'react'
import { proyectosApi } from '../../api/proyectos'
import { catalogosApi } from '../../api/catalogos'
import { useAuth } from '../../context/AuthContext'
import { FolderOpen, FileText, Download, Eye, Trash2, X, Upload, Paperclip } from 'lucide-react'

function formatFechaHora(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-BO')
}

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function badgeExtension(ruta) {
  if (!ruta) return null
  const ext = ruta.split('.').pop().toLowerCase()
  const mapa = {
    pdf:  { color: '#ef4444', label: 'PDF' },
    doc:  { color: '#2563eb', label: 'DOC' },
    docx: { color: '#2563eb', label: 'DOCX' },
    xls:  { color: '#16a34a', label: 'XLS' },
    xlsx: { color: '#16a34a', label: 'XLSX' },
    ppt:  { color: '#ea580c', label: 'PPT' },
    pptx: { color: '#ea580c', label: 'PPTX' },
    txt:  { color: '#6b7280', label: 'TXT' },
    png:  { color: '#8b5cf6', label: 'PNG' },
    jpg:  { color: '#8b5cf6', label: 'JPG' },
    jpeg: { color: '#8b5cf6', label: 'JPG' },
    zip:  { color: '#ca8a04', label: 'ZIP' },
    rar:  { color: '#ca8a04', label: 'RAR' },
  }
  const info = mapa[ext] || { color: '#6b7280', label: ext.toUpperCase() }
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 6px',
      borderRadius: 3, background: info.color, color: '#fff',
      letterSpacing: '0.05em', flexShrink: 0,
    }}>
      {info.label}
    </span>
  )
}

const FORM_VACIO = { nombre: '', id_tipo_documento: '', descripcion: '', archivo: null }

export default function DocumentosPage() {
  const { puede } = useAuth()
  const puedeEditar = puede('editar_proyectos')
  const [proyectos, setProyectos]       = useState([])
  const [proyectoSel, setProyectoSel]   = useState(null)
  const [documentos, setDocumentos]     = useState([])
  const [tipos, setTipos]               = useState([])
  const [cargando, setCargando]         = useState(true)
  const [cargandoDocs, setCargandoDocs] = useState(false)
  const [busqueda, setBusqueda]         = useState('')
  const [mostrarForm, setMostrarForm]   = useState(false)
  const [form, setForm]                 = useState(FORM_VACIO)
  const [guardando, setGuardando]       = useState(false)
  const [error, setError]               = useState('')
  const [abriendo, setAbriendo]         = useState(null)  // id del doc que se está abriendo
  const inputFileRef = useRef(null)

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
      setTipos(await catalogosApi.tiposDocumento())
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
      setDocumentos(await proyectosApi.listarDocumentos(proyecto.id))
    } finally {
      setCargandoDocs(false)
    }
  }

  function abrirForm() {
    setMostrarForm(true)
    setForm(FORM_VACIO)
    setError('')
  }

  function cerrarForm() {
    setMostrarForm(false)
    setForm(FORM_VACIO)
    setError('')
  }

  function seleccionarArchivo(e) {
    const archivo = e.target.files[0] || null
    setForm(f => ({
      ...f,
      archivo,
      nombre: f.nombre || (archivo ? archivo.name.replace(/\.[^.]+$/, '') : ''),
    }))
    setError('')
  }

  function quitarArchivo() {
    setForm(f => ({ ...f, archivo: null }))
    if (inputFileRef.current) inputFileRef.current.value = ''
  }

  async function handleSubir(e) {
    e.preventDefault()
    if (!proyectoSel) return
    setError('')

    if (!form.archivo)              { setError('Seleccioná un archivo para adjuntar.'); return }
    if (!form.nombre.trim())        { setError('El nombre del documento es requerido.'); return }
    if (!form.id_tipo_documento)    { setError('El tipo de documento es requerido.'); return }

    const fd = new FormData()
    fd.append('archivo', form.archivo)
    fd.append('nombre', form.nombre.trim())
    fd.append('id_tipo_documento', form.id_tipo_documento)
    fd.append('descripcion', form.descripcion.trim())

    setGuardando(true)
    try {
      const nuevo = await proyectosApi.subirDocumento(proyectoSel.id, fd)
      setDocumentos(prev => [nuevo, ...prev])
      cerrarForm()
    } catch (err) {
      setError(err?.error || err?.response?.data?.error || 'No se pudo subir el documento.')
    } finally {
      setGuardando(false)
    }
  }

  async function abrirDocumento(doc, descargar = false) {
    setAbriendo(doc.id)
    try {
      const blob = await proyectosApi.descargarDocumento(proyectoSel.id, doc.id)
      const ext = doc.ruta?.split('.').pop().toLowerCase() || ''
      const mime = {
        pdf: 'application/pdf', png: 'image/png',
        jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
      }[ext] || 'application/octet-stream'

      const url = URL.createObjectURL(new Blob([blob], { type: mime }))
      if (descargar) {
        const a = document.createElement('a')
        a.href = url
        a.download = doc.nombre + (ext ? `.${ext}` : '')
        a.click()
      } else {
        window.open(url, '_blank')
      }
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
    } catch {
      alert('No se pudo abrir el documento.')
    } finally {
      setAbriendo(null)
    }
  }

  async function eliminar(doc) {
    if (!confirm(`¿Eliminar el documento "${doc.nombre}"? Esta acción no se puede deshacer.`)) return
    try {
      await proyectosApi.eliminarDocumento(proyectoSel.id, doc.id)
      setDocumentos(prev => prev.filter(d => d.id !== doc.id))
    } catch {
      alert('No se pudo eliminar el documento.')
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
          <p className="page-subtitle">Contratos, planos, informes y otros archivos de proyectos</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── Panel izquierdo: lista de proyectos ── */}
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
                    width: '100%', textAlign: 'left', padding: '10px 16px',
                    background: proyectoSel?.id === p.id ? 'var(--primary-50, rgba(59,130,246,0.1))' : 'transparent',
                    border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer',
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

        {/* ── Panel derecho: documentos ── */}
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
              {puedeEditar && !mostrarForm && (
                <button className="btn btn-primary btn-sm" onClick={abrirForm}>
                  <Paperclip size={14} style={{ marginRight: 4 }} />
                  Adjuntar documento
                </button>
              )}
            </div>

            {/* ── Formulario de subida ── */}
            {mostrarForm && (
              <form
                onSubmit={handleSubir}
                style={{
                  marginBottom: 24, background: 'var(--bg)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 16,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Upload size={15} /> Adjuntar documento
                </div>

                {/* Zona de selección de archivo */}
                <div style={{ marginBottom: 14 }}>
                  <label className="form-label">Archivo *</label>
                  {!form.archivo ? (
                    <div
                      style={{
                        border: '2px dashed var(--border)', borderRadius: 'var(--radius-sm)',
                        padding: '24px 16px', textAlign: 'center', cursor: 'pointer',
                        transition: 'border-color 0.15s',
                      }}
                      onClick={() => inputFileRef.current?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.preventDefault()
                        const f = e.dataTransfer.files[0]
                        if (f) {
                          setForm(prev => ({ ...prev, archivo: f, nombre: prev.nombre || f.name.replace(/\.[^.]+$/, '') }))
                          setError('')
                        }
                      }}
                    >
                      <Upload size={28} style={{ opacity: 0.35, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                      <div className="text-sm" style={{ fontWeight: 500 }}>Hacé clic o arrastrá un archivo aquí</div>
                      <div className="text-muted text-sm" style={{ marginTop: 4 }}>
                        PDF, Word, Excel, PowerPoint, imágenes, ZIP — máx. 16 MB
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                      background: 'var(--bg)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                    }}>
                      <FileText size={20} style={{ opacity: 0.5, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {form.archivo.name}
                        </div>
                        <div className="text-muted text-sm">{formatBytes(form.archivo.size)}</div>
                      </div>
                      <button type="button" className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--danger)' }} onClick={quitarArchivo}>
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  <input
                    ref={inputFileRef}
                    type="file"
                    style={{ display: 'none' }}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.gif,.zip,.rar"
                    onChange={seleccionarArchivo}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Nombre del documento *</label>
                    <input
                      className="input"
                      value={form.nombre}
                      onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                      placeholder="Ej: Contrato firmado"
                      maxLength={255}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tipo de documento *</label>
                    <select
                      className="input"
                      value={form.id_tipo_documento}
                      onChange={e => setForm(f => ({ ...f, id_tipo_documento: e.target.value }))}
                    >
                      <option value="">Seleccionar tipo...</option>
                      {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Descripción <span className="text-muted">(opcional)</span></label>
                    <input
                      className="input"
                      value={form.descripcion}
                      onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                      placeholder="Observaciones sobre este documento"
                    />
                  </div>
                </div>

                {error && (
                  <div className="alert alert-danger" style={{ marginTop: 8 }}>{error}</div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <button type="button" className="btn btn-ghost" onClick={cerrarForm}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={guardando}>
                    {guardando ? 'Subiendo…' : 'Subir documento'}
                  </button>
                </div>
              </form>
            )}

            {/* ── Lista de documentos ── */}
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
                      background: 'var(--bg)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)', padding: '10px 14px',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}
                  >
                    {/* Badge extensión */}
                    {badgeExtension(d.ruta)}

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{d.nombre}</div>
                      <div className="text-muted text-sm">
                        {d.tipo_documento} · {d.usuario} · {formatFechaHora(d.fecha_subida)}
                      </div>
                      {d.descripcion && (
                        <div className="text-sm" style={{ marginTop: 2, opacity: 0.75 }}>{d.descripcion}</div>
                      )}
                    </div>

                    {/* Acciones */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        title="Ver en nueva pestaña"
                        disabled={abriendo === d.id}
                        onClick={() => abrirDocumento(d, false)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Eye size={14} />
                        {abriendo === d.id ? '…' : 'Ver'}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        title="Descargar archivo"
                        disabled={abriendo === d.id}
                        onClick={() => abrirDocumento(d, true)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Download size={14} />
                      </button>
                      {puedeEditar && (
                        <button
                          className="btn btn-ghost btn-sm"
                          title="Eliminar documento"
                          style={{ color: 'var(--danger)' }}
                          onClick={() => eliminar(d)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {documentos.length > 0 && (
              <div className="text-muted text-sm" style={{ marginTop: 10 }}>
                {documentos.length} documento{documentos.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
