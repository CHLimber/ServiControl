import client from './client'

export const entidadesApi = {
  listar:    ()           => client.get('/entidades/'),
  obtener:   (id)         => client.get(`/entidades/${id}`),
  crear:     (data)       => client.post('/entidades/', data),
  actualizar:(id, data)   => client.put(`/entidades/${id}`, data),
  desactivar:(id)         => client.delete(`/entidades/${id}`),

  // CU28 — Bitácora de cliente
  listarBitacora: (id)       => client.get(`/entidades/${id}/bitacora`),
  crearNota:      (id, data) => client.post(`/entidades/${id}/bitacora`, data),
}
