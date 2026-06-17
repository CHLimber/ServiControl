import { useState, useEffect, useCallback } from 'react'
import { getAuditoria, getAuditoriaPorId, getUsuariosConActividad } from '../../api/auditoria'
import { Search, X, User } from 'lucide-react'

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })
}

export default function AuditoriaUsuarioPage() {
  const [usuarios, setUsuarios]   = useState([])
  const [idUsuario, setIdUsuario] = useState('')
  const [datos, setDatos]         = useState({ items: [], total: 0, page: 1, pages: 1 })
  const [cargando, setCargando]   = useState(false)
  const [page, setPage]           = useState(1)

  const [detalle, setDetalle]         = useState(null)
  const [cargandoDet, setCargandoDet] = useState(false)

  useEffect(() => {
    getUsuariosConActividad().then(setUsuarios).catch(() => {})
  }, [])

  const cargar = useCallback(async (id, pagina) => {
    if (!id) { setDatos({ items: [], total: 0, page: 1, pages: 1 }); return }
    setCargando(true)
    try {
      const res = await getAuditoria({ id_usuario: id, page: pagina, per_page: 50 })
      setDatos(res)
    } catch {
      // silencioso
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar(idUsuario, page) }, [idUsuario, page, cargar])

  function elegirUsuario(id) {
    setIdUsuario(id)
    setPage(1)
  }

  async function verDetalle(id) {
    setCargandoDet(true)
    setDetalle(null)
    try {
      setDetalle(await getAuditoriaPorId(id))
    } catch {
      // silencioso
    } finally {
      setCargandoDet(false)
    }
  }

  const usuarioSel = usuarios.find(u => String(u.id) === String(idUsuario))

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Auditoría por usuario</h1>
          <p className="page-subtitle">Historial de acciones de un usuario específico</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <User size={18} style={{ opacity: 0.6 }} />
          <select className="input" style={{ minWidth: 260 }}
            value={idUsuario} onChange={e => elegirUsuario(e.target.value)}>
            <option value="">Seleccioná un usuario...</option>
            {usuarios.map(u => (
              <option key={u.id} value={u.id}>{u.username} ({u.acciones} acciones)</option>
            ))}
          </select>
          {usuarioSel && (
            <span className="text-sm text-muted">
              {datos.total} registro{datos.total !== 1 ? 's' : ''} de <strong>{usuarioSel.username}</strong>
            </span>
          )}
        </div>
      </div>

      <div className="card">
        {!idUsuario ? (
          <div className="empty-state">
            <User size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
            <div>Seleccioná un usuario para ver su historial de acciones.</div>
          </div>
        ) : cargando ? (
          <div className="empty-state">Cargando registros...</div>
        ) : datos.items.length === 0 ? (
          <div className="empty-state">Este usuario no tiene acciones registradas.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Fecha</th>
                  <th style={{ width: 110 }}>Módulo</th>
                  <th style={{ width: 200 }}>Acción</th>
                  <th>Descripción</th>
                  <th style={{ width: 110 }}>IP</th>
                  <th style={{ width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {datos.items.map(item => (
                  <tr key={item.id}>
                    <td className="text-sm text-muted">{formatFecha(item.fecha)}</td>
                    <td>
                      {item.modulo
                        ? <span className="badge badge-gray">{item.modulo}</span>
                        : <span className="text-muted text-sm">—</span>}
                    </td>
                    <td><code style={{ fontSize: 12 }}>{item.accion}</code></td>
                    <td className="text-sm">{item.descripcion}</td>
                    <td className="text-sm text-muted">{item.ip || '—'}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" title="Ver detalle"
                        onClick={() => verDetalle(item.id)}>
                        <Search size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {datos.pages > 1 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '12px 0 0' }}>
            <button className="btn btn-ghost btn-sm" disabled={datos.page <= 1}
              onClick={() => setPage(p => p - 1)}>← Anterior</button>
            <span className="text-sm text-muted">Página {datos.page} de {datos.pages}</span>
            <button className="btn btn-ghost btn-sm" disabled={datos.page >= datos.pages}
              onClick={() => setPage(p => p + 1)}>Siguiente →</button>
          </div>
        )}
      </div>

      {(detalle || cargandoDet) && (
        <div className="modal-overlay" onClick={() => setDetalle(null)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Detalle del registro</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setDetalle(null)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              {cargandoDet && <div className="empty-state">Cargando...</div>}
              {detalle && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                    <div><div className="text-sm text-muted">Fecha</div><div>{formatFecha(detalle.fecha)}</div></div>
                    <div><div className="text-sm text-muted">Usuario</div><div>{detalle.usuario || 'sistema'}</div></div>
                    <div><div className="text-sm text-muted">Módulo</div><div>{detalle.modulo || '—'}</div></div>
                    <div><div className="text-sm text-muted">IP</div><div>{detalle.ip || '—'}</div></div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div className="text-sm text-muted">Acción</div>
                      <code style={{ fontSize: 13 }}>{detalle.accion}</code>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div className="text-sm text-muted">Descripción</div>
                      <div>{detalle.descripcion}</div>
                    </div>
                  </div>
                  {detalle.detalles?.length > 0 && (
                    <>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>Campos modificados</div>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr><th>Campo</th><th>Anterior</th><th>Nuevo</th></tr>
                          </thead>
                          <tbody>
                            {detalle.detalles.map((d, i) => (
                              <tr key={i}>
                                <td><code style={{ fontSize: 12 }}>{d.campo}</code></td>
                                <td className="text-sm text-muted">{d.valor_anterior ?? '—'}</td>
                                <td className="text-sm">{d.valor_nuevo ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDetalle(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
