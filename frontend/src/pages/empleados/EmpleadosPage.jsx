import { useState, useEffect } from 'react'
import { empleadosApi } from '../../api/empleados'
import { catalogosApi } from '../../api/catalogos'
import { Pencil, Trash2, X, Phone, Plus, GraduationCap, Check } from 'lucide-react'

const SEXOS = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
]

const FORM_VACIO = {
  nombre: '',
  ci: '',
  sexo: '',
  fecha_nacimiento: '',
  email: '',
  id_cargo: '',
  especialidades: [],
  telefonos: [''],
  estado: true,
}

export default function EmpleadosPage() {
  const [empleados, setEmpleados]   = useState([])
  const [cargos, setCargos]         = useState([])
  const [especialidades, setEsps]   = useState([])
  const [cargando, setCargando]     = useState(true)
  const [error, setError]           = useState(null)
  const [busqueda, setBusqueda]     = useState('')
  const [verInactivos, setVerInactivos] = useState(false)

  const [modalAbierto, setModalAbierto] = useState(false)
  const [editando, setEditando]         = useState(null)
  const [form, setForm]                 = useState(FORM_VACIO)
  const [guardando, setGuardando]       = useState(false)
  const [errForm, setErrForm]           = useState('')

  // CU10 — Cargo inline
  const [cargoEdit, setCargoEdit]           = useState(null)  // { id_emp, id_cargo }
  const [guardandoCargo, setGuardandoCargo] = useState(false)

  // CU11 — Modal especialidades
  const [modalEsps, setModalEsps]       = useState(null)  // empleado seleccionado
  const [espsEmpleado, setEspsEmpleado] = useState([])
  const [cargandoEsps, setCargandoEsps] = useState(false)
  const [espSel, setEspSel]             = useState('')
  const [guardandoEsp, setGuardandoEsp] = useState(false)
  const [errEsp, setErrEsp]             = useState('')

  useEffect(() => { cargarDatos() }, [verInactivos])

  async function cargarDatos() {
    try {
      setCargando(true)
      setError(null)
      const [emps, listaCargos, listaEsps] = await Promise.all([
        empleadosApi.listar(verInactivos),
        catalogosApi.cargos(),
        catalogosApi.especialidades(),
      ])
      setEmpleados(emps)
      setCargos(listaCargos)
      setEsps(listaEsps)
    } catch {
      setError('No se pudo cargar los empleados.')
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

  function abrirEditar(emp) {
    setEditando(emp)
    setForm({
      nombre:           emp.nombre,
      ci:               emp.ci || '',
      sexo:             emp.sexo || '',
      fecha_nacimiento: emp.fecha_nacimiento || '',
      email:            emp.email || '',
      id_cargo:         emp.id_cargo ? String(emp.id_cargo) : '',
      especialidades:   emp.especialidades.map(e => e.id),
      telefonos:        emp.telefonos?.length ? emp.telefonos.map(t => t.numero) : [''],
      estado:           emp.estado,
    })
    setErrForm('')
    setModalAbierto(true)
  }

  function cerrarModal() {
    setModalAbierto(false)
    setEditando(null)
    setErrForm('')
  }

  function toggleEspecialidad(id) {
    setForm(f => ({
      ...f,
      especialidades: f.especialidades.includes(id)
        ? f.especialidades.filter(x => x !== id)
        : [...f.especialidades, id],
    }))
  }

  function agregarTelefono() {
    setForm(f => ({ ...f, telefonos: [...f.telefonos, ''] }))
  }

  function quitarTelefono(idx) {
    setForm(f => ({ ...f, telefonos: f.telefonos.filter((_, i) => i !== idx) }))
  }

  function cambiarTelefono(idx, valor) {
    setForm(f => {
      const t = [...f.telefonos]
      t[idx] = valor
      return { ...f, telefonos: t }
    })
  }

  async function guardar(e) {
    e.preventDefault()
    if (!form.nombre.trim()) { setErrForm('El nombre es obligatorio.'); return }
    if (!form.ci.trim())     { setErrForm('El CI es obligatorio.'); return }
    setGuardando(true); setErrForm('')

    const payload = {
      nombre:           form.nombre.trim(),
      ci:               form.ci.trim(),
      sexo:             form.sexo || null,
      fecha_nacimiento: form.fecha_nacimiento || null,
      email:            form.email.trim() || null,
      id_cargo:         form.id_cargo ? Number(form.id_cargo) : null,
      especialidades:   form.especialidades,
      telefonos:        form.telefonos.map(t => t.trim()).filter(Boolean),
      estado:           form.estado,
    }

    try {
      if (editando) {
        const data = await empleadosApi.actualizar(editando.id, payload)
        setEmpleados(prev => prev.map(e => e.id === editando.id ? data : e))
      } else {
        const data = await empleadosApi.crear(payload)
        setEmpleados(prev => [...prev, data])
      }
      cerrarModal()
    } catch (err) {
      setErrForm(err.response?.data?.error || err?.error || 'Error al guardar.')
    } finally {
      setGuardando(false)
    }
  }

  // CU10 — Cargo inline
  async function guardarCargo(id_emp) {
    if (guardandoCargo) return
    setGuardandoCargo(true)
    try {
      const data = await empleadosApi.asignarCargo(id_emp, {
        id_cargo: cargoEdit.id_cargo ? Number(cargoEdit.id_cargo) : null,
      })
      setEmpleados(prev => prev.map(e => e.id === id_emp ? data : e))
      setCargoEdit(null)
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo actualizar el cargo.')
    } finally {
      setGuardandoCargo(false)
    }
  }

  // CU11 — Especialidades modal
  async function abrirModalEsps(emp) {
    setModalEsps(emp)
    setEspSel('')
    setErrEsp('')
    setCargandoEsps(true)
    try {
      const data = await empleadosApi.listarEspecialidades(emp.id)
      setEspsEmpleado(data)
    } catch {
      setEspsEmpleado([])
    } finally {
      setCargandoEsps(false)
    }
  }

  function cerrarModalEsps() {
    setModalEsps(null)
    setEspsEmpleado([])
    setEspSel('')
    setErrEsp('')
  }

  async function agregarEspecialidad(e) {
    e.preventDefault()
    if (!espSel) { setErrEsp('Seleccioná una especialidad.'); return }
    setGuardandoEsp(true); setErrEsp('')
    try {
      const nueva = await empleadosApi.agregarEspecialidad(modalEsps.id, { id_especialidad: Number(espSel) })
      setEspsEmpleado(prev => [...prev, nueva])
      setEmpleados(prev => prev.map(emp =>
        emp.id === modalEsps.id ? { ...emp, especialidades: [...emp.especialidades, nueva] } : emp
      ))
      setEspSel('')
    } catch (err) {
      setErrEsp(err.response?.data?.error || 'Error al agregar.')
    } finally {
      setGuardandoEsp(false)
    }
  }

  async function quitarEspecialidad(idEsp, nombre) {
    if (!confirm(`¿Quitar la especialidad "${nombre}" de ${modalEsps.nombre}?`)) return
    try {
      await empleadosApi.quitarEspecialidad(modalEsps.id, idEsp)
      setEspsEmpleado(prev => prev.filter(e => e.id !== idEsp))
      setEmpleados(prev => prev.map(emp =>
        emp.id === modalEsps.id
          ? { ...emp, especialidades: emp.especialidades.filter(e => e.id !== idEsp) }
          : emp
      ))
    } catch {
      alert('No se pudo quitar la especialidad.')
    }
  }

  async function desactivar(emp) {
    if (!confirm(`¿Desactivar al empleado "${emp.nombre}"?`)) return
    try {
      await empleadosApi.desactivar(emp.id)
      setEmpleados(prev => verInactivos
        ? prev.map(e => e.id === emp.id ? { ...e, estado: false } : e)
        : prev.filter(e => e.id !== emp.id)
      )
    } catch (err) {
      alert(err.response?.data?.error || err?.error || 'No se pudo desactivar el empleado.')
    }
  }

  const filtrados = empleados.filter(e => {
    const txt = (e.nombre + (e.ci || '') + (e.cargo || '')).toLowerCase()
    return txt.includes(busqueda.toLowerCase())
  })

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Empleados</h1>
          <p className="page-subtitle">Personal activo de la empresa</p>
        </div>
        <button className="btn btn-primary" onClick={abrirCrear}>+ Nuevo empleado</button>
      </div>

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 200 }}
            placeholder="Buscar por nombre, CI o cargo..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
            <input
              type="checkbox"
              checked={verInactivos}
              onChange={e => setVerInactivos(e.target.checked)}
            />
            Ver inactivos
          </label>
        </div>
      </div>

      {/* Tabla */}
      <div className="card">
        {cargando ? (
          <div className="empty-state">Cargando empleados...</div>
        ) : error ? (
          <div className="empty-state" style={{ color: 'var(--danger)' }}>{error}</div>
        ) : filtrados.length === 0 ? (
          <div className="empty-state">No se encontraron empleados.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>CI</th>
                  <th>Cargo</th>
                  <th>Especialidades</th>
                  <th>Teléfono</th>
                  <th>Email</th>
                  <th>Estado</th>
                  <th style={{ width: 120 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(emp => (
                  <tr key={emp.id} style={!emp.estado ? { opacity: 0.55 } : {}}>
                    <td style={{ fontWeight: 500 }}>{emp.nombre}</td>
                    <td className="text-sm">{emp.ci || '—'}</td>

                    {/* CU10 — Cargo inline */}
                    <td style={{ minWidth: 140 }}>
                      {cargoEdit?.id_emp === emp.id ? (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <select
                            className="input"
                            style={{ fontSize: 12, padding: '2px 6px', height: 28, flex: 1 }}
                            value={cargoEdit.id_cargo}
                            onChange={e => setCargoEdit(c => ({ ...c, id_cargo: e.target.value }))}
                          >
                            <option value="">Sin cargo</option>
                            {cargos.map(c => (
                              <option key={c.id} value={c.id}>{c.nombre}</option>
                            ))}
                          </select>
                          <button
                            className="btn btn-primary btn-sm"
                            disabled={guardandoCargo}
                            onClick={() => guardarCargo(emp.id)}
                            title="Confirmar"
                          >
                            {guardandoCargo ? '…' : <Check size={12} />}
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setCargoEdit(null)}
                            title="Cancelar"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn btn-ghost"
                          style={{ padding: 0 }}
                          title="Cambiar cargo"
                          onClick={() => setCargoEdit({ id_emp: emp.id, id_cargo: emp.id_cargo ? String(emp.id_cargo) : '' })}
                        >
                          {emp.cargo
                            ? <span className="badge badge-blue" style={{ cursor: 'pointer' }}>{emp.cargo}</span>
                            : <span className="text-muted text-sm" style={{ cursor: 'pointer' }}>— Asignar</span>}
                        </button>
                      )}
                    </td>

                    {/* CU11 — Especialidades */}
                    <td className="text-sm text-muted" style={{ maxWidth: 160 }}>
                      {emp.especialidades.length > 0
                        ? emp.especialidades.map(e => e.nombre).join(', ')
                        : '—'}
                    </td>
                    <td className="text-sm text-muted">
                      {emp.telefonos?.length > 0
                        ? emp.telefonos.map(t => t.numero).join(', ')
                        : '—'}
                    </td>
                    <td className="text-sm text-muted">{emp.email || '—'}</td>
                    <td>
                      {emp.estado
                        ? <span className="badge badge-green">Activo</span>
                        : <span className="badge badge-red">Inactivo</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          title="Gestionar especialidades"
                          onClick={() => abrirModalEsps(emp)}
                        >
                          <GraduationCap size={14} />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          title="Editar"
                          onClick={() => abrirEditar(emp)}
                        >
                          <Pencil size={14} />
                        </button>
                        {emp.estado && (
                          <button
                            className="btn btn-ghost btn-sm"
                            title="Desactivar"
                            style={{ color: 'var(--danger)' }}
                            onClick={() => desactivar(emp)}
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
          {filtrados.length} empleado{filtrados.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── CU11: Modal gestionar especialidades ── */}
      {modalEsps && (
        <div className="modal-overlay" onClick={cerrarModalEsps}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Especialidades</h2>
                <div className="text-sm text-muted">{modalEsps.nombre}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={cerrarModalEsps}>
                <X size={14} />
              </button>
            </div>

            <div className="modal-body">
              {/* Lista de especialidades actuales */}
              {cargandoEsps ? (
                <div className="empty-state" style={{ padding: '20px 0' }}>Cargando...</div>
              ) : espsEmpleado.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 0' }}>
                  <GraduationCap size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
                  <p>Sin especialidades acreditadas. Agregá una abajo.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                  {espsEmpleado.map(esp => (
                    <span
                      key={esp.id}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: 'var(--bg)', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)', padding: '4px 10px', fontSize: 13,
                      }}
                    >
                      {esp.nombre}
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ padding: 0, color: 'var(--danger)', lineHeight: 1 }}
                        title="Quitar"
                        onClick={() => quitarEspecialidad(esp.id, esp.nombre)}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Formulario agregar */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 10 }}>Acreditar especialidad</div>
                <form onSubmit={agregarEspecialidad}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <label className="form-label">Especialidad *</label>
                      <select
                        className="input"
                        value={espSel}
                        onChange={e => { setEspSel(e.target.value); setErrEsp('') }}
                      >
                        <option value="">Seleccioná una especialidad...</option>
                        {especialidades
                          .filter(e => !espsEmpleado.some(x => x.id === e.id))
                          .map(e => (
                            <option key={e.id} value={e.id}>{e.nombre}</option>
                          ))
                        }
                      </select>
                    </div>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={guardandoEsp}
                      style={{ marginBottom: 2 }}
                    >
                      <Plus size={14} />{guardandoEsp ? ' Agregando...' : ' Acreditar'}
                    </button>
                  </div>
                  {errEsp && (
                    <div className="alert alert-danger" style={{ marginTop: 8 }}>{errEsp}</div>
                  )}
                </form>
              </div>
            </div>

            <div className="modal-footer">
              <span className="text-muted text-sm">
                {espsEmpleado.length} especialidad{espsEmpleado.length !== 1 ? 'es' : ''} acreditada{espsEmpleado.length !== 1 ? 's' : ''}
              </span>
              <button className="btn btn-ghost" onClick={cerrarModalEsps}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear / editar */}
      {modalAbierto && (
        <div className="modal-overlay" onClick={cerrarModal}>
          <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editando ? 'Editar empleado' : 'Nuevo empleado'}
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={cerrarModal}>
                <X size={14} />
              </button>
            </div>

            <form onSubmit={guardar}>
              <div className="modal-body">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Nombre */}
                  <div>
                    <label className="form-label">Nombre completo *</label>
                    <input className="input" value={form.nombre}
                      onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                      placeholder="Ej: Juan Carlos Pérez López" maxLength={150} />
                  </div>

                  {/* CI | Cargo */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label className="form-label">CI *</label>
                      <input className="input" value={form.ci}
                        onChange={e => setForm(f => ({ ...f, ci: e.target.value }))}
                        placeholder="Ej: 7654321" maxLength={20} />
                    </div>
                    <div>
                      <label className="form-label">Cargo</label>
                      <select className="input" value={form.id_cargo}
                        onChange={e => setForm(f => ({ ...f, id_cargo: e.target.value }))}>
                        <option value="">Sin asignar</option>
                        {cargos.map(c => (
                          <option key={c.id} value={c.id}>{c.nombre}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Sexo | Fecha nacimiento */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <label className="form-label">Sexo</label>
                      <select className="input" value={form.sexo}
                        onChange={e => setForm(f => ({ ...f, sexo: e.target.value }))}>
                        <option value="">Sin especificar</option>
                        {SEXOS.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Fecha de nacimiento</label>
                      <input type="date" className="input" value={form.fecha_nacimiento}
                        onChange={e => setForm(f => ({ ...f, fecha_nacimiento: e.target.value }))} />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="form-label">Email</label>
                    <input type="email" className="input" value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="empleado@empresa.com" maxLength={100} />
                  </div>

                  {/* Teléfonos */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <label className="form-label" style={{ margin: 0 }}>
                        <Phone size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                        Teléfonos
                      </label>
                      <button type="button" className="btn btn-ghost btn-sm"
                        onClick={agregarTelefono}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                        <Plus size={12} /> Agregar
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {form.telefonos.map((tel, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input className="input" style={{ flex: 1 }} value={tel}
                            onChange={e => cambiarTelefono(idx, e.target.value)}
                            placeholder="Ej: 78110011" maxLength={20} />
                          {form.telefonos.length > 1 && (
                            <button type="button" className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--danger)', flexShrink: 0 }}
                              onClick={() => quitarTelefono(idx)}>
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Especialidades */}
                  <div>
                    <label className="form-label">Especialidades</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px' }}>
                      {especialidades.map(esp => (
                        <label key={esp.id}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                          <input type="checkbox"
                            checked={form.especialidades.includes(esp.id)}
                            onChange={() => toggleEspecialidad(esp.id)} />
                          {esp.nombre}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Estado (solo al editar) */}
                  {editando && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.estado}
                        onChange={e => setForm(f => ({ ...f, estado: e.target.checked }))} />
                      <span className="form-label" style={{ margin: 0 }}>Empleado activo</span>
                    </label>
                  )}

                  {errForm && <div className="alert alert-danger">{errForm}</div>}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={cerrarModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={guardando}>
                  {guardando
                    ? 'Guardando...'
                    : editando ? 'Guardar cambios' : 'Crear empleado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
