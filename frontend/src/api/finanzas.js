import client from './client'

export const finanzasApi = {
  listarPagos:    ()       => client.get('/finanzas/pagos/'),
  obtenerPago:    (id)     => client.get(`/finanzas/pagos/${id}`),
  crearPago:      (data)   => client.post('/finanzas/pagos/', data),
  listarGastos:   ()       => client.get('/finanzas/gastos/'),
  crearGasto:     (data)   => client.post('/finanzas/gastos/', data),
  cuentasCobrar:  ()       => client.get('/finanzas/cuentas-por-cobrar'),
}
