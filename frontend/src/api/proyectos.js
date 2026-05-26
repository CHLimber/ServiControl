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

  // CU30 — Documentos de proyecto
  listarDocumentos:    (id)              => client.get(`/proyectos/${id}/documentos`),
  subirDocumento:      (id, formData)    => client.post(`/proyectos/${id}/documentos`, formData),
  descargarDocumento:  (id, idDoc)       => client.get(`/proyectos/${id}/documentos/${idDoc}/archivo`, { responseType: 'blob' }),
  eliminarDocumento:   (id, idDoc)       => client.delete(`/proyectos/${id}/documentos/${idDoc}`),
}
