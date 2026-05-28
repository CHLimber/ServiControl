import client from './client'

export const dashboardApi = {
  resumen: () => client.get('/dashboard/'),
}
