import client from './client'

export const entidadesApi = {
  listar:    ()           => client.get('/entidades/'),
  obtener:   (id)         => client.get(`/entidades/${id}`),
  crear:     (data)       => client.post('/entidades/', data),
  actualizar:(id, data)   => client.put(`/entidades/${id}`, data),
  desactivar:(id)         => client.delete(`/entidades/${id}`),

  // CU08 — Teléfonos de entidad (CRUD independiente)
  listarTelefonos:  (id)       => client.get(`/entidades/${id}/telefonos`),
  agregarTelefono:  (id, data) => client.post(`/entidades/${id}/telefonos`, data),
  eliminarTelefono: (id, idTel) => client.delete(`/entidades/${id}/telefonos/${idTel}`),

  // CU28 — Bitácora de cliente
  listarBitacora: (id)       => client.get(`/entidades/${id}/bitacora`),
  crearNota:      (id, data) => client.post(`/entidades/${id}/bitacora`, data),

  // Establecimientos
  listarEstablecimientos:    ()           => client.get('/entidades/establecimientos'),
  crearEstablecimiento:      (data)       => client.post('/entidades/establecimientos', data),
  actualizarEstablecimiento: (id, data)   => client.put(`/entidades/establecimientos/${id}`, data),
  desactivarEstablecimiento: (id)         => client.delete(`/entidades/establecimientos/${id}`),

  // Sistemas
  listarSistemas:    ()           => client.get('/entidades/sistemas'),
  crearSistema:      (data)       => client.post('/entidades/sistemas', data),
  actualizarSistema: (id, data)   => client.put(`/entidades/sistemas/${id}`, data),
  desactivarSistema: (id)         => client.delete(`/entidades/sistemas/${id}`),
}
