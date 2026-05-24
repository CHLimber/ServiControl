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

  reporte: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v))
    ).toString()
    return client.get(`/finanzas/reporte${qs ? `?${qs}` : ''}`)
  },
}
