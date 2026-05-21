import client from './client'

export const bitacorasApi = {
  listarCliente:    (id)    => client.get(`/bitacoras/clientes/${id}`),
  crearCliente:     (data)  => client.post('/bitacoras/clientes/', data),
  listarProyecto:   (id)    => client.get(`/bitacoras/proyectos/${id}`),
  crearProyecto:    (data)  => client.post('/bitacoras/proyectos/', data),
  listarDocumentos: (id)    => client.get(`/bitacoras/documentos/${id}`),
  subirDocumento:   (data)  => client.post('/bitacoras/documentos/', data),
}
