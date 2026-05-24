import client from './client'

export const categoriasApi = {
  listar:     (todas = false) => client.get('/categorias/', { params: todas ? { todas: 1 } : {} }),
  obtener:    (id)            => client.get(`/categorias/${id}`),
  crear:      (data)          => client.post('/categorias/', data),
  actualizar: (id, data)      => client.put(`/categorias/${id}`, data),
  desactivar: (id)            => client.delete(`/categorias/${id}`),
}
