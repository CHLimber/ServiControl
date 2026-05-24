import client from './client'

export const proveedoresApi = {
  // Gestión de proveedores (CU13)
  listar:     (todos = false) => client.get('/proveedores/', { params: todos ? { todos: 1 } : {} }),
  obtener:    (id)            => client.get(`/proveedores/${id}`),
  crear:      (data)          => client.post('/proveedores/', data),
  actualizar: (id, data)      => client.put(`/proveedores/${id}`, data),
  desactivar: (id)            => client.delete(`/proveedores/${id}`),

  // Catálogo de productos por proveedor (CU14)
  listarProductos:    (id)              => client.get(`/proveedores/${id}/productos`),
  agregarProducto:    (id, data)        => client.post(`/proveedores/${id}/productos`, data),
  actualizarProducto: (id, idProd, data) => client.put(`/proveedores/${id}/productos/${idProd}`, data),
  quitarProducto:     (id, idProd)      => client.delete(`/proveedores/${id}/productos/${idProd}`),
}
