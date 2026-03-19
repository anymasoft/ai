import axios from 'axios'

const API_BASE = '/api'

export const extractContacts = async (urls) => {
  const response = await axios.post(`${API_BASE}/extract`, {
    urls: urls,
  })
  return response.data
}

export const healthCheck = async () => {
  const response = await axios.get(`${API_BASE}/health`)
  return response.data
}

export const saveHtmlPages = async (urls) => {
  const response = await axios.post('/debug/save-html', {
    urls: urls,
  })
  return response.data
}
