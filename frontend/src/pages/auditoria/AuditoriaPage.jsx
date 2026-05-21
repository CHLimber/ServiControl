import { useState, useEffect, useCallback } from 'react'
import { getAuditoria, getAuditoriaPorId, getAcciones, getModulos } from '../../api/auditoria'
import { Search, X } from 'lucide-react'

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' })
}

const BADGE_MODULO = {
  auth: 'badge-blue',
  ordenes: 'badge-green',
  proyectos: 'badge-blue',
  cotizaciones: 'badge-gray',
  entidades: 'badge-gray',
  finanzas: 'badge-green',
  productos: 'badge-gray',
  mantenimiento: 'badge-blue',
  usuarios: 'badge-red',
}

function badgeModulo(modulo) {
  return BADGE_MODULO[modulo] || 'badge-gray'
}

export default function AuditoriaPage() {
  const [datos, setDatos]           = useState({ items: [], total: 0, page: 1, pages: 1 })
  const [cargando, setCargando]     = useState(true)
  const [acciones, setAcciones]     = useState([])
  const [modulos, setModulos]       = useState([])

  const [filtros, setFiltros] = useState({
    q: '', usuario: '', accion: '', modulo: '',
    fecha_desde: '', fecha_hasta: '',
    page: 1, per_page: 50,
  })

  const [detalle, setDetalle]       = useState(null)
  const [cargandoDet, setCargandoDet] = useState(false)

  useEffect(() => {
    Promise.all([getAcciones(), getModulos()]).then(([ac, mo]) => {
      setAcciones(ac)
      setModulos(mo)
    }).catch(() => {})
  }, [])

  const cargar = useCallback(async (params) => {
    setCargando(true)
    try {
      const res = await getAuditoria(params)
      setDatos(res)
    } catch {
      // silencioso
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar(filtros)
  }, [filtros, cargar])

  function cambiarFiltro(campo, valor) {
    setFiltros(f => ({ ...f, [campo]: valor, page: 1 }))
  }

  function cambiarPagina(nueva) {
    setFiltros(f => ({ ...f, page: nueva }))
  }

  async function verDetalle(id) {
    setCargandoDet(true)
    setDetalle(null)
    try {
      const res = await getAuditoriaPorId(id)
      setDetalle(res)
    } catch {
      // silencioso
    } finally {
      setCargandoDet(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Auditoría del sistema</h1>
          <p className="page-subtitle">Registro de movimientos y acciones realizadas</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input className="input" style={{ flex: 2, minWidth: 200 }}
            placeholder="Buscar en descripción..."
            value={filtros.q}
            onChange={e => cambiarFiltro('q', e.target.value)} />

          <input className="input" style={{ flex: 1, minWidth: 140 }}
            placeholder="Usuario"
            value={filtros.usuario}
            onChange={e => cambiarFiltro('usuario', e.target.value)} />

          <select className="input" style={{ minWidth: 160 }}
            value={filtros.modulo}
            onChange={e => cambiarFiltro('modulo', e.target.value)}>
            <option value="">Todos los módulos</option>
            {modulos.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <select className="input" style={{ minWidth: 200 }}
            value={filtros.accion}
            onChange={e => cambiarFiltro('accion', e.target.value)}>
            <option value="">Todas las acciones</option>
            {acciones.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          <input type="date" className="input" style={{ minWidth: 140 }}
            title="Desde"
            value={filtros.fecha_desde}
            onChange={e => cambiarFiltro('fecha_desde', e.target.value)} />

          <input type="date" className="input" style={{ minWidth: 140 }}
            title="Hasta"
            value={filtros.fecha_hasta}
            onChange={e => cambiarFiltro('fecha_hasta', e.target.value)} />

          <button className="btn btn-ghost" onClick={() => setFiltros({
            q: '', usuario: '', accion: '', modulo: '',
            fecha_desde: '', fecha_hasta: '', page: 1, per_page: 50,
          })}>
            Limpiar
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="card">
        {cargando ? (
          <div className="empty-state">Cargando registros...</div>
        ) : datos.items.length === 0 ? (
          <div className="empty-state">No se encontraron registros.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Fecha</th>
                  <th style={{ width: 110 }}>Usuario</th>
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
                    <td className="text-sm">{item.usuario || <span className="text-muted">sistema</span>}</td>
                    <td>
                      {item.modulo
                        ? <span className={`badge ${badgeModulo(item.modulo)}`}>{item.modulo}</span>
                        : <span className="text-muted text-sm">—</span>}
                    </td>
                    <td>
                      <code style={{ fontSize: 12 }}>{item.accion}</code>
                    </td>
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

        {/* Paginación */}
        {datos.pages > 1 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '12px 0 0' }}>
            <button className="btn btn-ghost btn-sm"
              disabled={datos.page <= 1}
              onClick={() => cambiarPagina(datos.page - 1)}>
              ← Anterior
            </button>
            <span className="text-sm text-muted">
              Página {datos.page} de {datos.pages}
            </span>
            <button className="btn btn-ghost btn-sm"
              disabled={datos.page >= datos.pages}
              onClick={() => cambiarPagina(datos.page + 1)}>
              Siguiente →
            </button>
          </div>
        )}

        <div className="text-muted text-sm" style={{ padding: '8px 0 0' }}>
          {datos.total} registro{datos.total !== 1 ? 's' : ''} encontrado{datos.total !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Modal detalle */}
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
                    <div>
                      <div className="text-sm text-muted">Fecha</div>
                      <div>{formatFecha(detalle.fecha)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted">Usuario</div>
                      <div>{detalle.usuario || 'sistema'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted">Módulo</div>
                      <div>{detalle.modulo || '—'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted">IP</div>
                      <div>{detalle.ip || '—'}</div>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div className="text-sm text-muted">Acción</div>
                      <code style={{ fontSize: 13 }}>{detalle.accion}</code>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div className="text-sm text-muted">Descripción</div>
                      <div>{detalle.descripcion}</div>
                    </div>
                  </div>

                  {detalle.detalles && detalle.detalles.length > 0 && (
                    <>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>Campos modificados</div>
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Campo</th>
                              <th>Valor anterior</th>
                              <th>Valor nuevo</th>
                            </tr>
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

                  {detalle.detalles && detalle.detalles.length === 0 && (
                    <div className="text-muted text-sm">Sin campos modificados registrados.</div>
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
