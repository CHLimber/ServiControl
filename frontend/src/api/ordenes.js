import client from './client'

export const ordenesApi = {
  listar:    ()           => client.get('/ordenes/'),
  estados:   ()           => client.get('/ordenes/estados'),
  obtener:   (id)         => client.get(`/ordenes/${id}`),
  crear:     (data)       => client.post('/ordenes/', data),
  actualizar:(id, data)   => client.put(`/ordenes/${id}`, data),

  // CU25 — Reportar consumo real de materiales
  reportarConsumo: (id, data) => client.put(`/ordenes/${id}/consumo`, data),
}
