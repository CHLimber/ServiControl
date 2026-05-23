import { useState, useEffect } from 'react'
import { entidadesApi } from '../../api/entidades'
import { catalogosApi } from '../../api/catalogos'
import { Pencil, Trash2, X, MapPin } from 'lucide-react'

const FORM_VACIO = {
  id_entidad: '',
  id_tipo_establecimiento: '',
  id_municipio: '',
  direccion: '',
}

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-BO')
}

export default function EstablecimientosPage() {
  const [establecimientos, setEstablecimientos] = useState([])
  const [clientes, setClientes]                 = useState([])
  const [tiposEst, setTiposEst]                 = useState([])
  const [municipios, setMunicipios]             = useState([])
  const [cargando, setCargando]                 = useState(true)
  const [error, setError]                       = useState(null)
  const [busqueda, setBusqueda]                 = useState('')
  const [modalAbierto, setModalAbierto]         = useState(false)
  const [editando, setEditando]                 = useState(null)
  const [form, setForm]                         = useState(FORM_VACIO)
  const [guardando, setGuardando]               = useState(false)
  const [errForm, setErrForm]                   = useState('')

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    try {
      setCargando(true)
      const [ests, ents, tipos, muns] = await Promise.all([
        entidadesApi.listarEstablecimientos(),
        entidadesApi.listar(),
        catalogosApi.tiposEstablecimiento(),
        catalogosApi.municipios(),
      ])
      setEstablecimientos(ests)
      setClientes(ents.filter(e => e.cliente))
      setTiposEst(tipos)
      setMunicipios(muns)
    } catch {
      setError('No se pudo cargar los establecimientos.')
    } finally {
      setCargando(false)
    }
  }

  function abrirCrear() {
    setEditando(null)
    setForm(FORM_VACIO)
    setErrForm('')
    setModalAbierto(true)
  }

  function abrirEditar(est) {
    setEditando(est)
    setForm({
      id_entidad:               est.id_entidad               ?? '',
      id_tipo_establecimiento:  est.id_tipo_establecimiento   ?? '',
      id_municipio:             est.id_municipio              ?? '',
      direccion:                est.direccion                 ?? '',
    })
    setErrForm('')
    setModalAbierto(true)
  }

  function cerrarModal() {
    setModalAbierto(false)
    setEditando(null)
    setErrForm('')
  }

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    setErrForm('')
    const payload = {
      id_entidad:              Number(form.id_entidad),
      id_tipo_establecimiento: form.id_tipo_establecimiento ? Number(form.id_tipo_establecimiento) : null,
      id_municipio:            form.id_municipio            ? Number(form.id_municipio)            : null,
      direccion:               form.direccion,
    }
    try {
      if (editando) {
        const data = await entidadesApi.actualizarEstablecimiento(editando.id, payload)
        setEstablecimientos(prev => prev.map(x => x.id === editando.id ? data : x))
      } else {
        const data = await entidadesApi.crearEstablecimiento(payload)
        setEstablecimientos(prev => [data, ...prev])
      }
      cerrarModal()
    } catch (err) {
      setErrForm(err.error || err.message || 'Error al guardar.')
    } finally {
      setGuardando(false)
    }
  }

  async function desactivar(id, nombreCliente) {
    if (!confirm(`¿Desactivar este establecimiento de "${nombreCliente}"?`)) return
    try {
      await entidadesApi.desactivarEstablecimiento(id)
      setEstablecimientos(prev => prev.filter(x => x.id !== id))
    } catch {
      alert('No se pudo desactivar el establecimiento.')
    }
  }

  const filtrados = establecimientos.filter(est => {
    const txt = [est.nombre_cliente, est.direccion, est.nombre_tipo, est.nombre_municipio]
      .join(' ').toLowerCase()
    return txt.includes(busqueda.toLowerCase())
  })

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Establecimientos</h1>
          <p className="page-subtitle">Ubicaciones físicas registradas por cliente</p>
        </div>
        <button className="btn btn-primary" onClick={abrirCrear}>+ Nuevo establecimiento</button>
      </div>

      {/* Filtro */}
      <div className="card" style={{ marginBottom: 20 }}>
        <input
          className="input"
          placeholder="Buscar por cliente, dirección, tipo o municipio..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      {/* Tabla */}
      <div className="card">
        {cargando ? (
          <div className="empty-state">Cargando establecimientos...</div>
        ) : error ? (
          <div className="empty-state" style={{ color: 'var(--danger)' }}>{error}</div>
        ) : filtrados.length === 0 ? (
          <div className="empty-state">
            <div className="icon"><MapPin size={32} /></div>
            <p>No se encontraron establecimientos.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Tipo</th>
                  <th>Dirección</th>
                  <th>Municipio</th>
                  <th>Registrado</th>
                  <th style={{ width: 100 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(est => (
                  <tr key={est.id}>
                    <td style={{ fontWeight: 500 }}>{est.nombre_cliente}</td>
                    <td>
                      {est.nombre_tipo
                        ? <span className="badge badge-blue">{est.nombre_tipo}</span>
                        : <span className="text-muted text-sm">—</span>}
                    </td>
                    <td className="text-sm">{est.direccion || '—'}</td>
                    <td className="text-sm text-muted">{est.nombre_municipio || '—'}</td>
                    <td className="text-sm text-muted">{formatFecha(est.fecha_creacion)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => abrirEditar(est)}
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => desactivar(est.id, est.nombre_cliente)}
                          title="Desactivar"
                          style={{ color: 'var(--danger)' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="text-muted text-sm" style={{ padding: '10px 0 0' }}>
          {filtrados.length} establecimiento{filtrados.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Modal crear / editar */}
      {modalAbierto && (
        <div className="modal-overlay" onClick={cerrarModal}>
          <div className="modal" onClick={ev => ev.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editando ? 'Editar establecimiento' : 'Nuevo establecimiento'}
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={cerrarModal}>
                <X size={14} />
              </button>
            </div>

            <form onSubmit={guardar}>
              <div className="modal-body">
                <div className="form-grid">

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Cliente *</label>
                    <select
                      className="input"
                      value={form.id_entidad}
                      onChange={e => setForm(f => ({ ...f, id_entidad: e.target.value }))}
                      required
                    >
                      <option value="">Seleccionar cliente...</option>
                      {clientes.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Dirección *</label>
                    <input
                      className="input"
                      value={form.direccion}
                      onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
                      placeholder="Ej: Av. Banzer km 4, Edificio Los Pinos #12"
                      maxLength={255}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Tipo de establecimiento</label>
                    <select
                      className="input"
                      value={form.id_tipo_establecimiento}
                      onChange={e => setForm(f => ({ ...f, id_tipo_establecimiento: e.target.value }))}
                    >
                      <option value="">Sin especificar</option>
                      {tiposEst.map(t => (
                        <option key={t.id} value={t.id}>{t.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Municipio</label>
                    <select
                      className="input"
                      value={form.id_municipio}
                      onChange={e => setForm(f => ({ ...f, id_municipio: e.target.value }))}
                    >
                      <option value="">Sin especificar</option>
                      {municipios.map(m => (
                        <option key={m.id} value={m.id}>{m.nombre}</option>
                      ))}
                    </select>
                  </div>

                </div>

                {errForm && (
                  <div className="alert alert-danger" style={{ marginTop: 12 }}>{errForm}</div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={cerrarModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={guardando}>
                  {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear establecimiento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
