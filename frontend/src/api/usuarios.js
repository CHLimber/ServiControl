import client from './client'

export const usuariosApi = {
  listar:        ()          => client.get('/usuarios/'),
  obtener:       (id)        => client.get(`/usuarios/${id}`),
  roles:         ()          => client.get('/usuarios/roles'),
  crear:         (data)      => client.post('/usuarios/', data),
  actualizar:    (id, data)  => client.put(`/usuarios/${id}`, data),
  cambiarEstado: (id)        => client.patch(`/usuarios/${id}/estado`),
  desbloquear:   (id)        => client.patch(`/usuarios/${id}/desbloquear`),
}
