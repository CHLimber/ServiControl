import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { AlertTriangle, Shield, CheckCircle2 } from 'lucide-react'

const FEATURES = [
  'Gestión de proyectos y órdenes de trabajo',
  'Control de mantenimientos preventivos',
  'Finanzas y facturación integrada',
]

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    try {
      await login(form.username, form.password)
      navigate('/')
    } catch (err) {
      setError(err?.error || 'Error al iniciar sesión')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="login-page">
      {/* Panel izquierdo: branding */}
      <div className="login-panel-brand">
        <div className="login-panel-content">
          <div className="login-brand-logo">
            <Shield size={34} />
          </div>
          <h1 className="login-brand-title">
            Servi<span>Control</span>
          </h1>
          <p className="login-brand-sub">
            Sistema integral de gestión para empresas de seguridad electrónica
          </p>
          <ul className="login-features">
            {FEATURES.map((f, i) => (
              <li key={i}>
                <CheckCircle2 size={16} className="login-feature-icon" />
                {f}
              </li>
            ))}
          </ul>
          <p className="login-brand-version">ServiControl v1.0 · UAGRM FICCT</p>
        </div>
      </div>

      {/* Panel derecho: formulario */}
      <div className="login-panel-form">
        <div className="login-card">
          <div className="login-brand">
            <h1>Bienvenido</h1>
            <p>Ingresa tus credenciales para continuar</p>
          </div>

          {error && (
            <div className="login-error">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Usuario</label>
              <input
                className="form-input"
                type="text"
                placeholder="Ingresa tu usuario"
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <input
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>

            <button type="submit" className="login-submit" disabled={cargando}>
              {cargando ? 'Ingresando...' : 'Ingresar al sistema'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 24, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            © 2025 ServiControl · UAGRM FICCT
          </p>
        </div>
      </div>
    </div>
  )
}
