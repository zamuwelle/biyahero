import axios from 'axios'
import Constants from 'expo-constants'

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const client = axios.create({ baseURL: Constants.expoConfig?.extra?.apiUrl, timeout: 8000 })

export const updateDriverLocation = (id, lat, lng) => client.post(`/vehicles/${id}/update-location`, { lat, lng }).catch(() => {})
export const getRouteWaypoints = (id = 1) => client.get(`/routes/${id}`).then(res => res.data).catch(() => null)
export const fetchLiveVehicles = (lat = 14.5995, lng = 120.9842, radius_km = 2.0) =>
	client.post('/commuter-radar', { lat, lng, radius_km, vehicle_type: 'jeepney', route_id: 1, hour_of_day: new Date().getHours(), day_of_week: DAYS[new Date().getDay()] })
		.then(res => (res.data?.nearby_vehicles || []).map(v => ({
			vehicle_id: v.vehicle_id || v.vehicle_code,
			position: { latitude: Number(v.position?.latitude || v.position?.lat || 0), longitude: Number(v.position?.longitude || v.position?.lng || 0) },
			distance_km: Number(v.distance_km || 0),
			predicted_eta_minutes: Number(v.predicted_eta_minutes || 0)
		}))).catch(() => [])
