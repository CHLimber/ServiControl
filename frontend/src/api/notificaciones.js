import client from './client'

export const notificacionesApi = {
  listar:       ()    => client.get('/notificaciones/'),
  marcarLeida:  (id)  => client.put(`/notificaciones/${id}/leer`),
  marcarTodas:  ()    => client.put('/notificaciones/leer-todas'),
  eliminar:     (id)  => client.delete(`/notificaciones/${id}`),
  noLeidas:     ()    => client.get('/notificaciones/no-leidas'),

  // CU45 — Preferencias de notificación
  getPreferencias:    ()     => client.get('/notificaciones/preferencias'),
  guardarPreferencias: (data) => client.put('/notificaciones/preferencias', data),
}
