import client from './client'

export const rolesApi = {
  listar:           ()          => client.get('/roles/'),
  obtener:          (id)        => client.get(`/roles/${id}`),
  crear:            (data)      => client.post('/roles/', data),
  actualizar:       (id, data)  => client.put(`/roles/${id}`, data),
  eliminar:         (id)        => client.delete(`/roles/${id}`),
  listarPermisos:   ()          => client.get('/roles/permisos/'),
  asignarPermisos:  (id, data)  => client.put(`/roles/${id}/permisos`, data),
}
