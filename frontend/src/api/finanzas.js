import client from './client'

export const finanzasApi = {
  listarPagos:      ()       => client.get('/finanzas/pagos'),
  pagosPorProyecto: (id)     => client.get(`/finanzas/pagos/proyecto/${id}`),
  registrarPago:    (data)   => client.post('/finanzas/pagos', data),

  listarGastos:     ()       => client.get('/finanzas/gastos'),
  gastosPorOrden:   (id)     => client.get(`/finanzas/gastos/orden/${id}`),
  registrarGasto:   (data)   => client.post('/finanzas/gastos', data),
  eliminarGasto:    (id)     => client.delete(`/finanzas/gastos/${id}`),

  cuentasPorCobrar: ()       => client.get('/finanzas/cuentas-por-cobrar'),

  // CU42 — Stripe
  crearStripeIntent:   (data) => client.post('/finanzas/stripe/crear-intent', data),
  completarPagoStripe: (data) => client.post('/finanzas/stripe/completar', data),

  reporte: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v))
    ).toString()
    return client.get(`/finanzas/reporte${qs ? `?${qs}` : ''}`)
  },

  // Exportación del reporte personalizado (Blob PDF/Excel)
  exportarReporte: (params = {}) =>
    client.get('/finanzas/reporte/exportar', { params, responseType: 'blob' }),

  // Reporte por IA (Claude)
  reporteIA: (data = {}) => client.post('/finanzas/reporte/ia', data),

  // Reportes estáticos (SQL fijo)
  listarReportesEstaticos: ()      => client.get('/finanzas/reporte/estaticos'),
  reporteEstatico:         (clave) => client.get(`/finanzas/reporte/estaticos/${clave}`),
  exportarReporteEstatico: (clave, formato) =>
    client.get(`/finanzas/reporte/estaticos/${clave}/exportar`, { params: { formato }, responseType: 'blob' }),
}
