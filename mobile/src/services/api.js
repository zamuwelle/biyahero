import axios from 'axios'

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export const client = axios.create({
	baseURL: process.env.EXPO_PUBLIC_AI_SERVICE_URL,
	timeout: 8000,
	headers: { 'Content-Type': 'application/json' }
})

export const updateDriverLocation = (vehicleId, lat, lng) =>
	client.post(`/vehicles/${vehicleId}/update-location`, { lat, lng }).then(res => res.data).catch(() => {})

export const getRouteWaypoints = (routeId = 1) =>
	client.get(`/routes/${routeId}`).then(res => res.data).catch(() => null)

export const fetchLiveVehicles = (lat = 14.5995, lng = 120.9842, radiusKm = 2.0) =>
	client.post('/commuter-radar', {
		lat,
		lng,
		radius_km: radiusKm,
		vehicle_type: 'jeepney',
		route_id: 1,
		hour_of_day: new Date().getHours(),
		day_of_week: DAYS[new Date().getDay()]
	}).then(res =>
		(res.data?.nearby_vehicles || []).map(v => ({
			vehicle_id: v.vehicle_id || v.vehicle_code,
			position: { latitude: Number(v.position?.lat || v.curr_position?.lat || v.live_lat), longitude: Number(v.position?.lng || v.curr_position?.lng || v.live_lng) },
			distance_km: Number(v.distance_km),
			predicted_eta_minutes: Number(v.predicted_eta_minutes || v.predicted_travel_time_minutes || (v.distance_km / 20) * 60)
		})).filter(v => !isNaN(v.position.latitude) && !isNaN(v.position.longitude))
	).catch(() => [])
