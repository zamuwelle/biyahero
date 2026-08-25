import { create } from 'zustand'
import { Vibration } from 'react-native'
import * as Location from 'expo-location'
import { updateDriverLocation, fetchLiveVehicles } from './api'

let lastAlertedId = null
let intervalId = null
let broadcastWatcher = null
let toastTimer = null

const VEHICLES = [
	{ id: 1, code: 'JEEP-001' },
	{ id: 2, code: 'JEEP-002' },
	{ id: 3, code: 'JEEP-003' }
]

export const useStore = create((set, get) => ({
	coords: { latitude: 14.5995, longitude: 120.9842 },
	mapRef: null,
	isRadarActive: false,
	isBroadcasting: false,
	vehicleId: 1,
	radiusKm: 2.0,
	vehicles: [],
	toast: null,
	showToast: msg => {
		if (toastTimer) clearTimeout(toastTimer)
		set({ toast: msg })
		toastTimer = setTimeout(() => set({ toast: null }), 2000)
	},
	setVehicleId: vehicleId => {
		const v = VEHICLES.find(x => x.id === vehicleId)
		set({ vehicleId })
		get().showToast(`Selected ${v?.code || 'Vehicle'}`)
	},
	toggleRadar: () => {
		const next = !get().isRadarActive
		set({ isRadarActive: next })
		get().showToast(next ? 'Radar Scanning (2.0 km)' : 'Radar Inactive')
	},
	toggleBroadcast: () => {
		const willBroadcast = !get().isBroadcasting
		const v = VEHICLES.find(x => x.id === get().vehicleId)
		set({ isBroadcasting: willBroadcast })
		get().showToast(willBroadcast ? `Live Broadcasting (${v?.code})` : 'Broadcast Stopped')
		if (willBroadcast) {
			Location.watchPositionAsync(
				{ accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 1 },
				loc => {
					set({ coords: loc.coords })
					updateDriverLocation(get().vehicleId, loc.coords.latitude, loc.coords.longitude)
				}
			).then(watcher => { broadcastWatcher = watcher })
		} else if (broadcastWatcher) {
			broadcastWatcher.remove()
			broadcastWatcher = null
		}
	},
	setMapRef: mapRef => set({ mapRef }),
	recenter: (duration = 500) => {
		const { mapRef, coords } = get()
		coords && mapRef?.animateCamera({ center: coords, zoom: 16 }, { duration })
	},
	tick: () => {
		const { coords, isRadarActive, radiusKm } = get()
		if (!isRadarActive) return
		const lat = coords?.latitude || 14.5995
		const lng = coords?.longitude || 120.9842

		fetchLiveVehicles(lat, lng, radiusKm).then(list => {
			const nearest = list[0]
			if (nearest && nearest.distance_km <= 0.35 && lastAlertedId !== nearest.vehicle_id) {
				lastAlertedId = nearest.vehicle_id
				Vibration.vibrate([0, 200, 100, 200])
			} else if (nearest && nearest.distance_km > 0.6) {
				lastAlertedId = null
			}
			set({ vehicles: list })
		})
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
