import axios from 'axios'
import Constants from 'expo-constants'
import { STALE_AFTER_MS } from '@/theme/tokens'

export const client = axios.create({
	baseURL: Constants.expoConfig?.extra?.apiUrl,
	timeout: 10000,
	headers: { Accept: 'application/json' }
})

/** Driver token. Commuters never authenticate, so this stays null for them. */
export const setAuthToken = token => {
	if (token) client.defaults.headers.common.Authorization = `Bearer ${token}`
	else delete client.defaults.headers.common.Authorization
}

/**
 * Server shape → the shape the cards render. Freshness is derived on the client
 * too, so a card goes stale while the screen is open rather than only on refetch.
 */
const normaliseVehicle = v => {
	const pingedAt = v.last_ping_at ? new Date(v.last_ping_at).getTime() : null
	const age = pingedAt ? Date.now() - pingedAt : null
	const stale = v.is_stale || age === null || age > STALE_AFTER_MS

	return {
		id: v.id,
		tripId: v.trip_id,
		vehicle_code: v.vehicle_code,
		vehicle_type: v.vehicle_type,
		plate_number: v.plate_number,
		model: v.model,
		body_number: v.body_number,
		destination: v.destination,
		capacity: stale ? 'unknown' : (v.capacity ?? 'unknown'),
		current_street: v.current_street,
		position: v.position?.lat != null
			? { latitude: Number(v.position.lat), longitude: Number(v.position.lng) }
			: null,
		route: {
			id: v.route?.id,
			label: v.route?.label,
			length_km: v.route?.length_km,
			waypoints: (v.route?.waypoints ?? []).map(w => ({ latitude: Number(w.lat), longitude: Number(w.lng) }))
		},
		is_verified: !!v.driver?.is_verified,
		driver_name: v.driver?.name ?? null,
		driver_years: v.driver?.years_on_route ?? 0,
		stale,
		minutesAgo: age === null ? null : Math.floor(age / 60000)
	}
}

/*
 * Commuter reads. NOTE: no lat/lng parameter exists on any of these by design —
 * the app never asks for a location permission, so it has nothing to send.
 */

export const fetchActiveVehicles = ({ destination, vehicleType } = {}) =>
	client
		.get('/active-vehicles', {
			params: {
				...(destination ? { destination } : {}),
				...(vehicleType && vehicleType !== 'all' ? { vehicle_type: vehicleType } : {})
			}
		})
		.then(res => ({
			vehicles: (res.data?.data ?? []).map(normaliseVehicle),
			meta: res.data?.meta ?? {}
		}))

export const fetchVehicle = id =>
	client.get(`/active-vehicles/${id}`).then(res => normaliseVehicle(res.data?.data ?? res.data))

export const fetchDestinations = q =>
	client.get('/destinations', { params: q ? { q } : {} }).then(res => res.data?.data ?? [])

export const fetchRoute = id => client.get(`/routes/${id}`).then(res => res.data)

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/** Which route serves this destination — used for the driver's pre-trip preview. */
export const fetchRouteForDestination = destination =>
	client.get('/routes/for-destination', { params: { destination } }).then(res => {
		const route = res.data?.data
		if (!route) return null

		return {
			id: route.id,
			label: route.label ?? route.name,
			length_km: Number(route.length_km ?? 0),
			waypoints: (route.waypoints ?? []).map(w => ({ latitude: Number(w.lat), longitude: Number(w.lng) }))
		}
	})

/**
 * Travel time for the DRIVER's own route preview only. This is never shown to a
 * commuter as an arrival time — that would need the commuter's position.
 */
export const fetchEta = ({ routeId, vehicleType, distanceKm }) => {
	const now = new Date()

	return client
		.post('/eta', {
			route_id: routeId,
			vehicle_type: vehicleType,
			hour_of_day: now.getHours(),
			day_of_week: DAYS[now.getDay()],
			distance_km: distanceKm
		})
		.then(res => Math.round(res.data?.predicted_travel_time_minutes ?? 0))
		.catch(() => null)
}

/* Driver writes — the only place the app ever handles a location. */

/**
 * Multipart, because the licence photo is a real file. The server stores it on
 * a private disk for a human reviewer and never returns it.
 */
export const registerDriver = ({ licencePhotoUri, ...fields }) => {
	const form = new FormData()

	Object.entries(fields).forEach(([key, value]) => {
		if (value !== undefined && value !== null && value !== '') form.append(key, String(value))
	})

	form.append('license_photo', {
		uri: licencePhotoUri,
		name: 'licence.jpg',
		type: 'image/jpeg'
	})

	return client
		.post('/register', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 30000 })
		.then(res => res.data?.data)
}

export const loginDriver = credentials =>
	client.post('/login', credentials).then(res => res.data?.data)

export const fetchMe = () => client.get('/me').then(res => res.data?.data)

export const logoutDriver = () => client.post('/logout').catch(() => {})

export const fetchCurrentTrip = () => client.get('/trips/current').then(res => res.data?.data)

export const fetchTripSummary = () => client.get('/trips/summary').then(res => res.data?.data)

export const startTrip = (destination, routeId) =>
	client.post('/trips', { destination, ...(routeId ? { route_id: routeId } : {}) }).then(res => res.data?.data)

export const pingTrip = (tripId, { latitude, longitude, street, distanceKm }) =>
	client.post(`/trips/${tripId}/ping`, {
		lat: latitude,
		lng: longitude,
		...(street ? { street } : {}),
		...(distanceKm != null ? { distance_km: distanceKm } : {})
	})

export const setTripCapacity = (tripId, capacity) =>
	client.patch(`/trips/${tripId}/capacity`, { capacity }).then(res => res.data?.data)

export const endTrip = tripId => client.post(`/trips/${tripId}/end`).then(res => res.data?.data)

export const fetchTripHistory = () => client.get('/trips/history').then(res => res.data?.data ?? [])

/** NOTE: the plate is half the login credential — changing it changes the login. */
export const updateVehicle = payload => client.patch('/vehicle', payload).then(res => res.data?.data)
