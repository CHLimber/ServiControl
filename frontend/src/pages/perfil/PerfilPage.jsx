import { useState, useEffect } from 'react'
import { authApi } from '../../api/auth'

export default function PerfilPage() {
  const [perfil, setPerfil] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  useEffect(() => {
    authApi.getPerfil()
      .then(data => {
        setPerfil(data)
        setEmail(data.email || '')
      })
      .catch(() => setError('No se pudo cargar el perfil'))
      .finally(() => setCargando(false))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setExito('')

    if (password && password !== confirmar) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (password && password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }

    const datos = { email }
    if (password) datos.password = password

    setGuardando(true)
    try {
      const res = await authApi.updatePerfil(datos)
      if (res?.mensaje === 'Sin cambios') {
        setExito('No hay cambios que guardar')
      } else {
        setExito('Perfil actualizado correctamente')
        setPassword('')
        setConfirmar('')
        // Refrescar datos del perfil desde el servidor
        const perfil_actualizado = await authApi.getPerfil()
        setPerfil(perfil_actualizado)
        setEmail(perfil_actualizado.email || '')
      }
    } catch (err) {
      setError(err?.error || err?.message || 'Error al guardar los cambios')
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return <p className="text-muted">Cargando perfil…</p>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mi perfil</h1>
          <p className="page-subtitle">Administra tu información de acceso</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', maxWidth: '900px' }}>

        {/* Tarjeta de resumen */}
        <div className="card" style={{ textAlign: 'center', alignSelf: 'start' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'var(--accent)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.8rem', fontWeight: 700,
            margin: '0 auto 16px'
          }}>
            {perfil?.username?.slice(0, 2).toUpperCase() || '?'}
          </div>
          <strong style={{ display: 'block', fontSize: '1rem', color: 'var(--text)' }}>
            {perfil?.username}
          </strong>
          <span className="badge badge-blue" style={{ marginTop: 8 }}>
            {perfil?.rol}
          </span>
          {perfil?.nombre && (
            <p className="text-muted text-sm" style={{ marginTop: 12 }}>
              {perfil.nombre}
            </p>
          )}
          {perfil?.ultimo_acceso && (
            <p className="text-muted text-sm" style={{ marginTop: 8 }}>
              Último acceso:<br />
              {new Date(perfil.ultimo_acceso).toLocaleString('es-BO')}
            </p>
          )}
          {perfil?.fecha_creacion && (
            <p className="text-muted text-sm" style={{ marginTop: 4 }}>
              Cuenta creada:<br />
              {new Date(perfil.fecha_creacion).toLocaleDateString('es-BO')}
            </p>
          )}
        </div>

        {/* Formulario de edición */}
        <div className="card">
          <h2 className="card-title" style={{ marginBottom: 20 }}>Editar información</h2>

          {error  && <div className="alert alert-danger"  style={{ marginBottom: 16 }}>{error}</div>}
          {exito  && <div className="alert alert-success" style={{ marginBottom: 16 }}>{exito}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Usuario</label>
              <input
                className="form-input"
                value={perfil?.username || ''}
                disabled
                style={{ opacity: 0.6, cursor: 'not-allowed' }}
              />
              <small className="text-muted text-sm">El nombre de usuario no se puede modificar.</small>
            </div>

            <div className="form-group">
              <label className="form-label">Correo electrónico</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                maxLength={100}
              />
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '20px 0' }} />
            <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
              Deja en blanco si no deseas cambiar la contraseña.
            </p>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Nueva contraseña</label>
                <input
                  type="password"
                  className="form-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  maxLength={255}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Confirmar contraseña</label>
                <input
                  type="password"
                  className="form-input"
                  value={confirmar}
                  onChange={e => setConfirmar(e.target.value)}
                  placeholder="Repite la contraseña"
                  autoComplete="new-password"
                  maxLength={255}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={guardando}
              >
                {guardando ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
