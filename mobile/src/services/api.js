import axios from 'axios'

export const client = axios.create({
	baseURL: process.env.EXPO_PUBLIC_AI_SERVICE_URL,
	timeout: 8000,
	headers: { 'Content-Type': 'application/json' }
})

export const getRadar = data =>
	client.post('/radar', data).then(res => res.data)

export const getEta = data =>
	client.post('/eta', data).then(res => res.data)
