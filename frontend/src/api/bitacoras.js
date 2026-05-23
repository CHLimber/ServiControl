import client from './client'

export const bitacorasApi = {
  // BitacoraCliente — delegado a entidadesApi (CU28)
  listarCliente: (id)   => client.get(`/entidades/${id}/bitacora`),
  crearCliente:  (id, data) => client.post(`/entidades/${id}/bitacora`, data),

  // BitacoraProyecto
  listarProyecto: (id)      => client.get(`/proyectos/${id}/bitacora`),
  crearProyecto:  (id, data) => client.post(`/proyectos/${id}/bitacora`, data),

  // Documentos de proyecto
  listarDocumentos: (id)    => client.get(`/proyectos/${id}/documentos`),
  subirDocumento:   (id, data) => client.post(`/proyectos/${id}/documentos`, data),
}
