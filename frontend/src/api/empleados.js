import client from './client'

export const empleadosApi = {
  listar:     (todos = false) => client.get(`/empleados/?todos=${todos}`),
  obtener:    (id)            => client.get(`/empleados/${id}`),
  crear:      (data)          => client.post('/empleados/', data),
  actualizar: (id, data)      => client.put(`/empleados/${id}`, data),
  desactivar: (id)            => client.delete(`/empleados/${id}`),
}
