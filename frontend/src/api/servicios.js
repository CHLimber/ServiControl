import client from './client'

export const serviciosApi = {
  listar:     (todos = false) => client.get('/servicios/', { params: todos ? { todos: 1 } : {} }),
  obtener:    (id)            => client.get(`/servicios/${id}`),
  crear:      (data)          => client.post('/servicios/', data),
  actualizar: (id, data)      => client.put(`/servicios/${id}`, data),
  desactivar: (id)            => client.delete(`/servicios/${id}`),
}
