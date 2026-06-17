import { useState, useEffect, useMemo } from 'react'
import { proveedoresApi } from '../../api/proveedores'
import { Truck, Package, Search, Star, MapPin } from 'lucide-react'

function formatBs(n) {
  return `Bs ${Number(n || 0).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function CatalogoProveedoresPage() {
  const [proveedores, setProveedores] = useState([])
  const [cargando, setCargando]       = useState(true)
  const [error, setError]             = useState(null)

  const [seleccionado, setSeleccionado] = useState(null)
  const [productos, setProductos]        = useState([])
  const [cargandoProds, setCargandoProds] = useState(false)

  const [q, setQ]               = useState('')
  const [categoria, setCategoria] = useState('')
  const [buscaProv, setBuscaProv] = useState('')

  useEffect(() => { cargarProveedores() }, [])

  async function cargarProveedores() {
    try {
      setCargando(true)
      const data = await proveedoresApi.catalogoListar()
      setProveedores(data)
    } catch {
      setError('No se pudo cargar el catálogo de proveedores.')
    } finally {
      setCargando(false)
    }
  }

  async function seleccionar(prov) {
    setSeleccionado(prov)
    setQ('')
    setCategoria('')
    await cargarProductos(prov.id)
  }

  async function cargarProductos(idProv, params = {}) {
    try {
      setCargandoProds(true)
      const data = await proveedoresApi.catalogoProductos(idProv, params)
      setProductos(data)
    } catch {
      setProductos([])
    } finally {
      setCargandoProds(false)
    }
  }

  // Filtrado en backend al cambiar q/categoria del proveedor seleccionado
  useEffect(() => {
    if (!seleccionado) return
    const t = setTimeout(() => {
      const params = {}
      if (q) params.q = q
      if (categoria) params.categoria = categoria
      cargarProductos(seleccionado.id, params)
    }, 300)
    return () => clearTimeout(t)
  }, [q, categoria]) // eslint-disable-line react-hooks/exhaustive-deps

  const categorias = useMemo(
    () => [...new Set(productos.map(p => p.categoria).filter(Boolean))].sort(),
    [productos],
  )

  const proveedoresFiltrados = proveedores.filter(p =>
    p.nombre.toLowerCase().includes(buscaProv.toLowerCase()),
  )

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Catálogo de proveedores</h1>
          <p className="page-subtitle">Consulta de proveedores y precios de referencia (solo lectura)</p>
        </div>
      </div>

      {cargando ? (
        <div className="empty-state">Cargando catálogo...</div>
      ) : error ? (
        <div className="empty-state" style={{ color: 'var(--danger)' }}>{error}</div>
      ) : proveedores.length === 0 ? (
        <div className="empty-state">
          <Truck size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
          <div>No hay proveedores activos registrados.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>

          {/* Lista de proveedores */}
          <div className="card" style={{ padding: 12 }}>
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 11, opacity: 0.5 }} />
              <input className="input" style={{ paddingLeft: 30 }}
                placeholder="Buscar proveedor..."
                value={buscaProv} onChange={e => setBuscaProv(e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 560, overflowY: 'auto' }}>
              {proveedoresFiltrados.map(p => (
                <button key={p.id}
                  className={`btn btn-ghost${seleccionado?.id === p.id ? ' btn-primary' : ''}`}
                  style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '10px 12px', height: 'auto' }}
                  onClick={() => seleccionar(p)}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{p.nombre}</div>
                    <div className="text-sm text-muted" style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                      {p.departamento && (
                        <span><MapPin size={11} style={{ verticalAlign: -1 }} /> {p.departamento}</span>
                      )}
                      <span><Package size={11} style={{ verticalAlign: -1 }} /> {p.cant_productos} prod.</span>
                    </div>
                  </div>
                </button>
              ))}
              {proveedoresFiltrados.length === 0 && (
                <div className="text-muted text-sm" style={{ padding: 12 }}>Sin coincidencias.</div>
              )}
            </div>
          </div>

          {/* Detalle de productos */}
          <div className="card">
            {!seleccionado ? (
              <div className="empty-state">
                <Package size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
                <div>Seleccioná un proveedor para ver sus productos y precios.</div>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <h2 className="card-title">{seleccionado.nombre}</h2>
                  {seleccionado.email && <div className="text-sm text-muted">{seleccionado.email}</div>}
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                  <input className="input" style={{ flex: 1, minWidth: 200 }}
                    placeholder="Buscar producto por nombre o código..."
                    value={q} onChange={e => setQ(e.target.value)} />
                  <select className="input" style={{ minWidth: 180 }}
                    value={categoria} onChange={e => setCategoria(e.target.value)}>
                    <option value="">Todas las categorías</option>
                    {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {(q || categoria) && (
                    <button className="btn btn-ghost" onClick={() => { setQ(''); setCategoria('') }}>
                      Limpiar
                    </button>
                  )}
                </div>

                {cargandoProds ? (
                  <div className="empty-state">Cargando productos...</div>
                ) : productos.length === 0 ? (
                  <div className="empty-state">Este proveedor no tiene productos asociados.</div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Producto</th>
                          <th>Categoría</th>
                          <th>Unidad</th>
                          <th style={{ textAlign: 'right' }}>Precio referencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productos.map(p => (
                          <tr key={p.id_producto}>
                            <td className="text-sm text-muted">{p.codigo || '—'}</td>
                            <td style={{ fontWeight: 500 }}>
                              {p.nombre}
                              {p.es_principal && (
                                <Star size={12} color="#f59e0b" fill="#f59e0b"
                                  style={{ marginLeft: 6, verticalAlign: -1 }} />
                              )}
                            </td>
                            <td><span className="badge badge-gray">{p.categoria}</span></td>
                            <td className="text-sm">{p.unidad_medida || '—'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatBs(p.precio_unitario)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="text-muted text-sm" style={{ padding: '10px 0 0' }}>
                  {productos.length} producto{productos.length !== 1 ? 's' : ''}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
