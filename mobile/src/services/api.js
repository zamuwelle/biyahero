import axios from 'axios'
import { Vibration } from 'react-native'

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
let tick = 0
let lastAlertedId = null

export const client = axios.create({
	baseURL: process.env.EXPO_PUBLIC_AI_SERVICE_URL,
	timeout: 8000,
	headers: { 'Content-Type': 'application/json' }
})

export const getRadar = data =>
	client.post('/radar', data).then(res => res.data)

export const getEta = data =>
	client.post('/eta', data).then(res => res.data)

export const scanNearbyVehicles = (lat = 14.5995, lng = 120.9842, radiusKm = 2.0) => {
	tick += 0.35
	const o1 = Math.sin(tick) * 0.012
	const o2 = Math.sin(tick + 2.09) * 0.012
	const o3 = Math.sin(tick + 4.18) * 0.012

	const candidates = [
		{ vehicle_id: 'JEEP-001', vehicle_type: 'jeepney', curr_position: { lat: lat + o1, lng: lng + o1 * 0.6 } },
		{ vehicle_id: 'JEEP-002', vehicle_type: 'jeepney', curr_position: { lat: lat - o2 * 0.7, lng: lng + o2 } },
		{ vehicle_id: 'JEEP-003', vehicle_type: 'jeepney', curr_position: { lat: lat + o3 * 0.5, lng: lng - o3 } }
	]

	const calcDist = (vLat, vLng) => {
		const dLat = (vLat - lat) * 111.32
		const dLng = (vLng - lng) * 111.32 * Math.cos(lat * 0.01745)
		return Math.max(0.12, Math.sqrt(dLat * dLat + dLng * dLng))
	}

	return getRadar({
		commuter_location: { lat, lng },
		radius_km: radiusKm,
		candidate_vehicles: candidates
	}).then(data =>
		Promise.all((data.nearby_vehicles || []).map(v => {
			const match = candidates.find(c => c.vehicle_id === v.vehicle_id) || candidates[0]
			const vLat = v.curr_position?.lat || match.curr_position.lat
			const vLng = v.curr_position?.lng || match.curr_position.lng

			return getEta({
				route_id: 1,
				vehicle_type: v.vehicle_type,
				hour_of_day: new Date().getHours(),
				day_of_week: DAYS[new Date().getDay()],
				distance_km: v.distance_km
			}).then(eta => ({
				...v,
				predicted_eta_minutes: eta.predicted_travel_time_minutes,
				position: { latitude: vLat, longitude: vLng }
			})).catch(() => ({
				...v,
				predicted_eta_minutes: (v.distance_km / 20) * 60,
				position: { latitude: vLat, longitude: vLng }
			}))
		}))
	).catch(() =>
		candidates.map(c => {
			const d = calcDist(c.curr_position.lat, c.curr_position.lng)
			return {
				vehicle_id: c.vehicle_id,
				vehicle_type: c.vehicle_type,
				distance_km: d,
				predicted_eta_minutes: (d / 20) * 60,
				position: { latitude: c.curr_position.lat, longitude: c.curr_position.lng }
			}
		})
	).then(list => {
		const sorted = (list || []).sort((a, b) => a.distance_km - b.distance_km)
		const nearest = sorted[0]
		if (nearest && nearest.distance_km <= 0.35 && lastAlertedId !== nearest.vehicle_id) {
			lastAlertedId = nearest.vehicle_id
			Vibration.vibrate([0, 150])
		} else if (nearest && nearest.distance_km > 0.6) {
			lastAlertedId = null
		}
		return sorted
	})
}
