import { createContext, useContext, useEffect, useState } from 'react'
import { authApi } from '../api/auth'

const AuthContext = createContext(null)

function leerUsuarioLocal() {
  const raw = localStorage.getItem('usuario')
  if (!raw || raw === 'undefined') return null
  try {
    const u = JSON.parse(raw)
    if (u && !Array.isArray(u.permisos)) u.permisos = []
    return u
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [usuario, setUsuario] = useState(() => leerUsuarioLocal())

  // Si el usuario en localStorage es antiguo (sin permisos), los traemos del /me
  useEffect(() => {
    if (!token) return
    if (usuario && Array.isArray(usuario.permisos) && usuario.permisos.length > 0) return
    authApi.me()
      .then(data => {
        const u = {
          id: data.id,
          username: data.username,
          rol: data.rol,
          permisos: data.permisos || [],
        }
        localStorage.setItem('usuario', JSON.stringify(u))
        setUsuario(u)
      })
      .catch(() => {
        // Si /me falla por token inválido, el interceptor de Axios ya limpia la sesión
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function login(username, password) {
    const data = await authApi.login(username, password)
    const u = { ...data.usuario, permisos: data.usuario.permisos || [] }
    localStorage.setItem('token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    localStorage.setItem('usuario', JSON.stringify(u))
    setToken(data.access_token)
    setUsuario(u)
  }

  async function logout() {
    try {
      await authApi.logout()
    } catch (_) {
      // Si falla el aviso al servidor, igual limpiamos la sesión local
    }
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('usuario')
    setToken(null)
    setUsuario(null)
  }

  async function refrescarPermisos() {
    if (!token) return
    const data = await authApi.me()
    const u = {
      id: data.id,
      username: data.username,
      rol: data.rol,
      permisos: data.permisos || [],
    }
    localStorage.setItem('usuario', JSON.stringify(u))
    setUsuario(u)
  }

  const permisos = usuario?.permisos || []
  const esAdmin = usuario?.rol === 'Administrador'

  function puede(nombre) {
    if (!usuario) return false
    if (esAdmin) return true
    if (!nombre) return true
    return permisos.includes(nombre)
  }

  function puedeAlguno(...nombres) {
    return nombres.some(n => puede(n))
  }

  return (
    <AuthContext.Provider value={{ token, usuario, permisos, esAdmin, login, logout, puede, puedeAlguno, refrescarPermisos }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
