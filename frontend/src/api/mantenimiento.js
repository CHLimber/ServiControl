import client from './client'

export const mantenimientoApi = {
  listar:     ()       => client.get('/mantenimiento/'),
  obtener:    (id)     => client.get(`/mantenimiento/${id}`),
  crear:      (data)   => client.post('/mantenimiento/', data),
  actualizar: (id, d)  => client.put(`/mantenimiento/${id}`, d),
  alertas:    ()       => client.get('/mantenimiento/alertas/'),
}
