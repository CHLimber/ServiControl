import client from './client'

export const empleadosApi = {
  listar:     (todos = false) => client.get(`/empleados/?todos=${todos}`),
  obtener:    (id)            => client.get(`/empleados/${id}`),
  crear:      (data)          => client.post('/empleados/', data),
  actualizar: (id, data)      => client.put(`/empleados/${id}`, data),
  desactivar: (id)            => client.delete(`/empleados/${id}`),

  // CU08 — Teléfonos de empleado (CRUD independiente)
  listarTelefonos:  (id)        => client.get(`/empleados/${id}/telefonos`),
  agregarTelefono:  (id, data)  => client.post(`/empleados/${id}/telefonos`, data),
  eliminarTelefono: (id, idTel) => client.delete(`/empleados/${id}/telefonos/${idTel}`),

  // CU10 — Cargo de empleado (independiente)
  asignarCargo: (id, data) => client.put(`/empleados/${id}/cargo`, data),

  // CU11 — Especialidades de empleado (CRUD independiente)
  listarEspecialidades: (id)        => client.get(`/empleados/${id}/especialidades`),
  agregarEspecialidad:  (id, data)  => client.post(`/empleados/${id}/especialidades`, data),
  quitarEspecialidad:   (id, idEsp) => client.delete(`/empleados/${id}/especialidades/${idEsp}`),
}
