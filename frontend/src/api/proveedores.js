import client from './client'

export const proveedoresApi = {
  // Gestión de proveedores (CU13)
  listar:     (todos = false) => client.get('/proveedores/', { params: todos ? { todos: 1 } : {} }),
  obtener:    (id)            => client.get(`/proveedores/${id}`),
  crear:      (data)          => client.post('/proveedores/', data),
  actualizar: (id, data)      => client.put(`/proveedores/${id}`, data),
  desactivar: (id)            => client.delete(`/proveedores/${id}`),

  // CU08 — Teléfonos de proveedor (CRUD independiente)
  listarTelefonos:  (id)        => client.get(`/proveedores/${id}/telefonos`),
  agregarTelefono:  (id, data)  => client.post(`/proveedores/${id}/telefonos`, data),
  eliminarTelefono: (id, idTel) => client.delete(`/proveedores/${id}/telefonos/${idTel}`),

  // Catálogo de productos por proveedor (CU14)
  listarProductos:    (id)              => client.get(`/proveedores/${id}/productos`),
  agregarProducto:    (id, data)        => client.post(`/proveedores/${id}/productos`, data),
  actualizarProducto: (id, idProd, data) => client.put(`/proveedores/${id}/productos/${idProd}`, data),
  quitarProducto:     (id, idProd)      => client.delete(`/proveedores/${id}/productos/${idProd}`),

  // CU39 — Consulta de catálogo (solo lectura)
  catalogoListar:    ()             => client.get('/proveedores/catalogo'),
  catalogoProductos: (id, params = {}) => client.get(`/proveedores/catalogo/${id}/productos`, { params }),
}
