import client from './client'

export const asistenteApi = {
  modulos:   ()      => client.get('/asistente/modulos'),
  consultar: (data)  => client.post('/asistente/consultar', data),
}
