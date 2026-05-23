import client from './client'

export const cotizacionesApi = {
  listar:         ()           => client.get('/cotizaciones/'),
  obtener:        (id)         => client.get(`/cotizaciones/${id}`),
  crear:          (data)       => client.post('/cotizaciones/', data),
  actualizar:     (id, data)   => client.put(`/cotizaciones/${id}`, data),
  editarDetalles: (id, data)   => client.put(`/cotizaciones/${id}/detalles`, data),
  cambiarEstado:  (id, estado) => client.post(`/cotizaciones/${id}/cambiar-estado`, { estado }),
  sistemasPorEntidad: (id)      => client.get(`/entidades/${id}/sistemas`),
  crearSistema:       (id, data) => client.post(`/entidades/${id}/sistemas`, data),
}
