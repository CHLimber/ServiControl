import client from './client'

export const ordenesApi = {
  listar:    ()           => client.get('/ordenes/'),
  estados:   ()           => client.get('/ordenes/estados'),
  obtener:   (id)         => client.get(`/ordenes/${id}`),
  crear:     (data)       => client.post('/ordenes/', data),
  actualizar:(id, data)   => client.put(`/ordenes/${id}`, data),

  // CU23 — Asignar / reasignar personal
  actualizarEmpleados: (id, data) => client.put(`/ordenes/${id}/empleados`, data),

  // CU24 — Asignar / reasignar materiales
  actualizarMateriales: (id, data) => client.put(`/ordenes/${id}/materiales`, data),

  // CU25 — Reportar consumo real de materiales
  reportarConsumo: (id, data) => client.put(`/ordenes/${id}/consumo`, data),
}
