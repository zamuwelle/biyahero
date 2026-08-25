import { create } from 'zustand'
import { Vibration } from 'react-native'
import * as Location from 'expo-location'

let angle = 0
let lastAlertedId = null
let intervalId = null

export const useStore = create((set, get) => ({
	coords: { latitude: 14.5995, longitude: 120.9842 },
	mapRef: null,
	isRadarActive: false,
	radiusKm: 2.0,
	vehicles: [],
	toggleRadar: () => set(s => ({ isRadarActive: !s.isRadarActive })),
	setMapRef: mapRef => set({ mapRef }),
	recenter: (duration = 500) => {
		const { mapRef, coords } = get()
		coords && mapRef?.animateCamera({ center: coords, zoom: 16 }, { duration })
	},
	tick: () => {
		angle += 0.08
		const { coords, isRadarActive } = get()
		if (!isRadarActive) return
		const lat = coords?.latitude || 14.5995
		const lng = coords?.longitude || 120.9842

		const v1Pos = { latitude: lat + 0.012 * Math.sin(angle), longitude: lng + 0.007 * Math.sin(angle) }
		const v2Pos = { latitude: lat - 0.012 * Math.sin(angle + 2.09), longitude: lng + 0.008 * Math.sin(angle + 2.09) }
		const v3Pos = { latitude: lat + 0.010 * Math.sin(angle + 4.18), longitude: lng - 0.010 * Math.sin(angle + 4.18) }

		const calcDist = pos => {
			const dLat = (pos.latitude - lat) * 111.32
			const dLng = (pos.longitude - lng) * 111.32 * Math.cos(lat * 0.01745)
			return Math.max(0.12, Math.sqrt(dLat * dLat + dLng * dLng))
		}

		const d1 = calcDist(v1Pos)
		const d2 = calcDist(v2Pos)
		const d3 = calcDist(v3Pos)

		const list = [
			{ vehicle_id: 'JEEP-001', position: v1Pos, distance_km: d1, predicted_eta_minutes: (d1 / 20) * 60 },
			{ vehicle_id: 'JEEP-002', position: v2Pos, distance_km: d2, predicted_eta_minutes: (d2 / 20) * 60 },
			{ vehicle_id: 'JEEP-003', position: v3Pos, distance_km: d3, predicted_eta_minutes: (d3 / 20) * 60 }
		].sort((a, b) => a.distance_km - b.distance_km)

		const nearest = list[0]
		if (nearest && nearest.distance_km <= 0.35 && lastAlertedId !== nearest.vehicle_id) {
			lastAlertedId = nearest.vehicle_id
			Vibration.vibrate([0, 200, 100, 200])
		} else if (nearest && nearest.distance_km > 0.6) {
			lastAlertedId = null
		}

		set({ vehicles: list })
	},
	startRadar: () => {
		if (intervalId) clearInterval(intervalId)
		set({ isRadarActive: true })
		get().tick()
		intervalId = setInterval(() => get().tick(), 1000)
	},
	stopRadar: () => {
		if (intervalId) {
			clearInterval(intervalId)
			intervalId = null
		}
		Vibration.cancel()
		lastAlertedId = null
		set({ vehicles: [], isRadarActive: false })
	},
	initLocation: () =>
		Location.requestForegroundPermissionsAsync().then(({ status }) => {
			if (status !== 'granted') return
			Location.getCurrentPositionAsync({}).then(loc => {
				set({ coords: loc.coords })
				get().recenter(600)
			})
			Location.watchPositionAsync({ timeInterval: 2000, distanceInterval: 1 }, loc => set({ coords: loc.coords }))
		})
}))

useStore.getState().initLocation()
