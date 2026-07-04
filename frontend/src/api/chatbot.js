import client from './client'

export const chatbotApi = {
  modulos:   ()      => client.get('/chatbot/modulos'),
  consultar: (data)  => client.post('/chatbot/consultar', data),
}
