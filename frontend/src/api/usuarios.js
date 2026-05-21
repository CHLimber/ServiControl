import client from './client'

export const usuariosApi = {
  listar:     ()          => client.get('/usuarios/'),
  obtener:    (id)        => client.get(`/usuarios/${id}`),
  crear:      (data)      => client.post('/usuarios/', data),
  actualizar: (id, data)  => client.put(`/usuarios/${id}`, data),
  eliminar:   (id)        => client.delete(`/usuarios/${id}`),
  desbloquear:(id)        => client.post(`/usuarios/${id}/desbloquear`),
}
