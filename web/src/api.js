import axios from 'axios'
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000'
export const api = axios.create({ baseURL })

export function withAuth(token){
  return axios.create({
    baseURL,
    headers: {
      Authorization: token ? `Bearer ${token}` : undefined,
      'x-tenant': import.meta.env.VITE_TENANT_KEY || 'default',
    },
  })
}
