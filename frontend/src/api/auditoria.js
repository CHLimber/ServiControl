import client from './client'

export function getAuditoria(params = {}) {
  return client.get('/auditoria/', { params })
}

export function getAuditoriaPorId(id) {
  return client.get(`/auditoria/${id}`)
}

export function getAcciones() {
  return client.get('/auditoria/acciones')
}

export function getModulos() {
  return client.get('/auditoria/modulos')
}

// CU48 — Usuarios con actividad registrada
export function getUsuariosConActividad() {
  return client.get('/auditoria/usuarios')
}

// CU49 — Reporte de actividad por período
export function getReporteActividad(params = {}) {
  return client.get('/auditoria/reporte-actividad', { params })
}

// CU47 — Exportar log (devuelve un Blob para descarga)
export function exportarAuditoria(params = {}) {
  return client.get('/auditoria/exportar', { params, responseType: 'blob' })
}

// CU49 — Exportar reporte de actividad en PDF o Excel (Blob)
export function exportarReporteActividad(params = {}) {
  return client.get('/auditoria/reporte-actividad/exportar', { params, responseType: 'blob' })
}
