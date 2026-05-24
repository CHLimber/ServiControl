import client from './client'

export const mantenimientoApi = {
  listar:           ()           => client.get('/mantenimiento/'),
  obtener:          (id)         => client.get(`/mantenimiento/${id}`),
  crear:            (data)       => client.post('/mantenimiento/', data),
  actualizar:       (id, d)      => client.put(`/mantenimiento/${id}`, d),
  listarAlertas:    (params = {}) => client.get('/mantenimiento/alertas', { params }),
  crearAlerta:      (data)       => client.post('/mantenimiento/alertas', data),
  actualizarAlerta: (id, d)      => client.put(`/mantenimiento/alertas/${id}`, d),
}
