import client from './client'

export const proyectosApi = {
  listar:           ()           => client.get('/proyectos/'),
  estados:          ()           => client.get('/proyectos/estados'),
  obtener:          (id)         => client.get(`/proyectos/${id}`),
  crear:            (data)       => client.post('/proyectos/', data),
  actualizar:       (id, data)   => client.put(`/proyectos/${id}`, data),
  sistemasPorEntidad: (id)       => client.get(`/entidades/${id}/sistemas`),

  // Bitácora de proyecto
  listarBitacora: (id)       => client.get(`/proyectos/${id}/bitacora`),
  crearNota:      (id, data) => client.post(`/proyectos/${id}/bitacora`, data),

  // Documentos de proyecto
  listarDocumentos:  (id)           => client.get(`/proyectos/${id}/documentos`),
  subirDocumento:    (id, data)     => client.post(`/proyectos/${id}/documentos`, data),
  eliminarDocumento: (id, id_doc)   => client.delete(`/proyectos/${id}/documentos/${id_doc}`),
}
