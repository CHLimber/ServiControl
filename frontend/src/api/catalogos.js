import client from './client'

export const catalogosApi = {
  tiposDocumento: () => client.get('/catalogos/tipos-documento'),
  municipios: () => client.get('/catalogos/municipios'),
  tiposEstablecimiento: () => client.get('/catalogos/tipos-establecimiento'),
  tiposSistema: () => client.get('/catalogos/tipos-sistema'),
  servicios: () => client.get('/catalogos/servicios'),
  categorias: () => client.get('/catalogos/categorias'),
  cargos:         () => client.get('/catalogos/cargos'),
  especialidades: () => client.get('/catalogos/especialidades'),
  proveedores:    () => client.get('/catalogos/proveedores'),
  empleados:      () => client.get('/catalogos/empleados'),
  sistemas:       () => client.get('/catalogos/sistemas'),
}
