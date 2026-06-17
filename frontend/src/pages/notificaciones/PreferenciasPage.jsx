import { useState, useEffect } from 'react'
import { notificacionesApi } from '../../api/notificaciones'
import { Bell, Mail, Save } from 'lucide-react'

export default function PreferenciasPage() {
  const [prefs, setPrefs]       = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError]       = useState('')
  const [exito, setExito]       = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    try {
      const data = await notificacionesApi.getPreferencias()
      setPrefs(data)
    } catch {
      setError('No se pudieron cargar las preferencias.')
    } finally {
      setCargando(false)
    }
  }

  function toggle(tipo, canal) {
    setExito('')
    setPrefs(ps => ps.map(p => p.tipo === tipo ? { ...p, [canal]: !p[canal] } : p))
  }

  async function guardar() {
    setGuardando(true)
    setError('')
    setExito('')
    try {
      await notificacionesApi.guardarPreferencias({
        preferencias: prefs.map(p => ({
          tipo: p.tipo, en_centro: p.en_centro, en_correo: p.en_correo,
        })),
      })
      setExito('Preferencias guardadas correctamente.')
    } catch (err) {
      setError(err?.error || 'No se pudieron guardar las preferencias.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Preferencias de notificación</h1>
          <p className="page-subtitle">Elegí qué avisos querés recibir y por qué canal</p>
        </div>
        <button className="btn btn-primary" onClick={guardar} disabled={guardando || cargando}>
          <Save size={16} style={{ marginRight: 6 }} />
          {guardando ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}
      {exito && <div className="alert alert-success" style={{ marginBottom: 16 }}>{exito}</div>}

      <div className="card" style={{ maxWidth: 720 }}>
        {cargando ? (
          <div className="empty-state">Cargando preferencias...</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tipo de notificación</th>
                  <th style={{ width: 160, textAlign: 'center' }}>
                    <Bell size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                    Centro
                  </th>
                  <th style={{ width: 160, textAlign: 'center' }}>
                    <Mail size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                    Correo
                  </th>
                </tr>
              </thead>
              <tbody>
                {prefs.map(p => (
                  <tr key={p.tipo}>
                    <td style={{ fontWeight: 500 }}>{p.etiqueta}</td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={p.en_centro}
                        onChange={() => toggle(p.tipo, 'en_centro')}
                        style={{ width: 18, height: 18, cursor: 'pointer' }} />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={p.en_correo}
                        onChange={() => toggle(p.tipo, 'en_correo')}
                        style={{ width: 18, height: 18, cursor: 'pointer' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-muted text-sm" style={{ padding: '12px 4px 0' }}>
          Estas preferencias se aplican a los próximos eventos del sistema. El correo requiere
          tener un email registrado en tu perfil.
        </p>
      </div>
    </div>
  )
}
