import { useState, useEffect, useMemo } from 'react'
import { entidadesApi } from '../../api/entidades'
import { catalogosApi } from '../../api/catalogos'
import { useAuth } from '../../context/AuthContext'
import { Pencil, Trash2, X, Settings, CheckCircle2, Circle } from 'lucide-react'

const FORM_VACIO = {
  id_entidad:         '',
  id_establecimiento: '',
  id_tipo_sistema:    '',
  nombre:             '',
  tiene_mantenimiento: false,
  periodicidad_dias:  '',
}

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-BO')
}

export default function SistemasPage() {
  const { puede } = useAuth()
  const puedeCrear  = puede('crear_clientes')
  const puedeEditar = puede('editar_clientes')
  const [sistemas, setSistemas]             = useState([])
  const [clientes, setClientes]             = useState([])
  const [establecimientos, setEstablecimientos] = useState([])
  const [tiposSistema, setTiposSistema]     = useState([])
  const [cargando, setCargando]             = useState(true)
  const [error, setError]                   = useState(null)
  const [busqueda, setBusqueda]             = useState('')
  const [modalAbierto, setModalAbierto]     = useState(false)
  const [editando, setEditando]             = useState(null)
  const [form, setForm]                     = useState(FORM_VACIO)
  const [guardando, setGuardando]           = useState(false)
  const [errForm, setErrForm]               = useState('')

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    try {
      setCargando(true)
      const [sis, ents, ests, tipos] = await Promise.all([
        entidadesApi.listarSistemas(),
        entidadesApi.listar(),
        entidadesApi.listarEstablecimientos(),
        catalogosApi.tiposSistema(),
      ])
      setSistemas(sis)
      setClientes(ents.filter(e => e.cliente))
      setEstablecimientos(ests)
      setTiposSistema(tipos)
    } catch {
      setError('No se pudo cargar los sistemas instalados.')
    } finally {
      setCargando(false)
    }
  }

  // Establecimientos del cliente seleccionado en el modal
  const estsPorCliente = useMemo(() =>
    establecimientos.filter(e => String(e.id_entidad) === String(form.id_entidad)),
    [establecimientos, form.id_entidad]
  )

  function abrirCrear() {
    setEditando(null)
    setForm(FORM_VACIO)
    setErrForm('')
    setModalAbierto(true)
  }

  function abrirEditar(sis) {
    setEditando(sis)
    setForm({
      id_entidad:          sis.id_entidad          ?? '',
      id_establecimiento:  sis.id_establecimiento   ?? '',
      id_tipo_sistema:     sis.id_tipo_sistema      ?? '',
      nombre:              sis.nombre               ?? '',
      tiene_mantenimiento: sis.tiene_mantenimiento  ?? false,
      periodicidad_dias:   sis.periodicidad_dias     ?? '',
    })
    setErrForm('')
    setModalAbierto(true)
  }

  function cerrarModal() {
    setModalAbierto(false)
    setEditando(null)
    setErrForm('')
  }

  function cambiarCliente(val) {
    setForm(f => ({ ...f, id_entidad: val, id_establecimiento: '' }))
  }

  function cambiarMantenimiento(checked) {
    setForm(f => ({ ...f, tiene_mantenimiento: checked, periodicidad_dias: checked ? f.periodicidad_dias : '' }))
  }

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    setErrForm('')
    const payload = {
      id_establecimiento:  Number(form.id_establecimiento),
      id_tipo_sistema:     Number(form.id_tipo_sistema),
      nombre:              form.nombre,
      tiene_mantenimiento: form.tiene_mantenimiento,
      periodicidad_dias:   form.tiene_mantenimiento && form.periodicidad_dias
                             ? Number(form.periodicidad_dias) : null,
    }
    try {
      if (editando) {
        const data = await entidadesApi.actualizarSistema(editando.id, payload)
        setSistemas(prev => prev.map(x => x.id === editando.id ? data : x))
      } else {
        const data = await entidadesApi.crearSistema(payload)
        setSistemas(prev => [data, ...prev])
      }
      cerrarModal()
    } catch (err) {
      setErrForm(err.error || err.message || 'Error al guardar.')
    } finally {
      setGuardando(false)
    }
  }

  async function desactivar(id, nombre) {
    if (!confirm(`¿Desactivar el sistema "${nombre}"?`)) return
    try {
      await entidadesApi.desactivarSistema(id)
      setSistemas(prev => prev.filter(x => x.id !== id))
    } catch {
      alert('No se pudo desactivar el sistema.')
    }
  }

  const filtrados = sistemas.filter(s => {
    const txt = [s.nombre, s.nombre_cliente, s.direccion_establecimiento, s.nombre_tipo_sistema]
      .join(' ').toLowerCase()
    return txt.includes(busqueda.toLowerCase())
  })

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Sistemas instalados</h1>
          <p className="page-subtitle">Sistemas de seguridad registrados por establecimiento</p>
        </div>
        {puedeCrear && (
          <button className="btn btn-primary" onClick={abrirCrear}>+ Nuevo sistema</button>
        )}
      </div>

      {/* Filtro */}
      <div className="card" style={{ marginBottom: 20 }}>
        <input
          className="input"
          placeholder="Buscar por nombre, cliente, dirección o tipo de sistema..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      {/* Tabla */}
      <div className="card">
        {cargando ? (
          <div className="empty-state">Cargando sistemas...</div>
        ) : error ? (
          <div className="empty-state" style={{ color: 'var(--danger)' }}>{error}</div>
        ) : filtrados.length === 0 ? (
          <div className="empty-state">
            <div className="icon"><Settings size={32} /></div>
            <p>No se encontraron sistemas instalados.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre del sistema</th>
                  <th>Tipo</th>
                  <th>Cliente</th>
                  <th>Establecimiento</th>
                  <th>Mantenimiento</th>
                  <th>Registrado</th>
                  <th style={{ width: 100 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 500 }}>{s.nombre}</td>
                    <td>
                      {s.nombre_tipo_sistema
                        ? <span className="badge badge-purple">{s.nombre_tipo_sistema}</span>
                        : <span className="text-muted text-sm">—</span>}
                    </td>
                    <td className="text-sm">{s.nombre_cliente}</td>
                    <td className="text-sm text-muted">{s.direccion_establecimiento || '—'}</td>
                    <td>
                      {s.tiene_mantenimiento ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                          <span className="text-sm">
                            {s.periodicidad_dias ? `c/${s.periodicidad_dias}d` : 'Sí'}
                          </span>
                        </div>
                      ) : (
                        <Circle size={14} style={{ color: 'var(--muted)' }} />
                      )}
                    </td>
                    <td className="text-sm text-muted">{formatFecha(s.fecha_creacion)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {puedeEditar && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => abrirEditar(s)}
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {puedeEditar && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => desactivar(s.id, s.nombre)}
                            title="Desactivar"
                            style={{ color: 'var(--danger)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="text-muted text-sm" style={{ padding: '10px 0 0' }}>
          {filtrados.length} sistema{filtrados.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Modal crear / editar */}
      {modalAbierto && (
        <div className="modal-overlay" onClick={cerrarModal}>
          <div className="modal" onClick={ev => ev.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editando ? 'Editar sistema' : 'Nuevo sistema'}
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={cerrarModal}>
                <X size={14} />
              </button>
            </div>

            <form onSubmit={guardar}>
              <div className="modal-body">
                <div className="form-grid">

                  {/* Cliente → filtra establecimientos */}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Cliente *</label>
                    <select
                      className="input"
                      value={form.id_entidad}
                      onChange={e => cambiarCliente(e.target.value)}
                      required
                    >
                      <option value="">Seleccionar cliente...</option>
                      {clientes.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>

                  {/* Establecimiento (dependiente del cliente) */}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Establecimiento *</label>
                    <select
                      className="input"
                      value={form.id_establecimiento}
                      onChange={e => setForm(f => ({ ...f, id_establecimiento: e.target.value }))}
                      required
                      disabled={!form.id_entidad}
                    >
                      <option value="">
                        {form.id_entidad
                          ? estsPorCliente.length === 0
                            ? 'Este cliente no tiene establecimientos'
                            : 'Seleccionar establecimiento...'
                          : 'Primero selecciona un cliente'}
                      </option>
                      {estsPorCliente.map(est => (
                        <option key={est.id} value={est.id}>
                          {est.direccion}{est.nombre_municipio ? ` — ${est.nombre_municipio}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Nombre del sistema */}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Nombre del sistema *</label>
                    <input
                      className="input"
                      value={form.nombre}
                      onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                      placeholder="Ej: CCTV Planta Baja, Alarma Perimetral"
                      maxLength={150}
                      required
                    />
                  </div>

                  {/* Tipo de sistema */}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Tipo de sistema *</label>
                    <select
                      className="input"
                      value={form.id_tipo_sistema}
                      onChange={e => setForm(f => ({ ...f, id_tipo_sistema: e.target.value }))}
                      required
                    >
                      <option value="">Seleccionar tipo...</option>
                      {tiposSistema.map(t => (
                        <option key={t.id} value={t.id}>{t.nombre}</option>
                      ))}
                    </select>
                  </div>

                  {/* Mantenimiento */}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.tiene_mantenimiento}
                        onChange={e => cambiarMantenimiento(e.target.checked)}
                      />
                      <span className="form-label" style={{ margin: 0 }}>Requiere mantenimiento periódico</span>
                    </label>
                  </div>

                  {form.tiene_mantenimiento && (
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Periodicidad (días)</label>
                      <input
                        type="number"
                        className="input"
                        value={form.periodicidad_dias}
                        onChange={e => setForm(f => ({ ...f, periodicidad_dias: e.target.value }))}
                        placeholder="Ej: 90 (cada 3 meses)"
                        min={1}
                        max={3650}
                      />
                    </div>
                  )}

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
                  {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear sistema'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
