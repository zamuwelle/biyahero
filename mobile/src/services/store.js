import { create } from 'zustand'
import { Vibration } from 'react-native'
import * as Location from 'expo-location'
import { updateDriverLocation, fetchLiveVehicles, registerDriver, updateVehicleStatus } from './api'

let lastAlertedId = null
let intervalId = null
let broadcastWatcher = null
let locationWatcher = null
let toastTimer = null

export const useStore = create((set, get) => ({
	coords: null,
	mapRef: null,
	locationEnabled: true,
	isRadarActive: false,
	isBroadcasting: false,
	vehicleId: 1,
	vehicles: [],
	driver: null,
	occupancy: 'available',
	vehicleFilter: 'all',
	searchQuery: '',
	selectedVehicle: null,
	toast: null,
	setVehicleFilter: vehicleFilter => {
		set({ vehicleFilter })
		get().tick()
	},
	setSearchQuery: searchQuery => set({ searchQuery }),
	setSelectedVehicle: selectedVehicle => set({ selectedVehicle }),
	showToast: msg => {
		if (toastTimer) clearTimeout(toastTimer)
		set({ toast: msg })
		toastTimer = setTimeout(() => set({ toast: null }), 2000)
	},
	setOccupancy: occupancy => {
		set({ occupancy })
		updateVehicleStatus(get().driver?.vehicle?.id || get().vehicleId, occupancy)
	},
	register: data =>
		registerDriver(data).then(res => {
			const driverData = res?.user ? res.user : {
				name: data.name,
				phone: data.phone,
				license_no: data.license_no,
				is_verified: true,
				vehicle: {
					id: 1,
					vehicle_code: data.plate_number,
					vehicle_type: data.vehicle_type,
					plate_number: data.plate_number,
					model: data.model,
					occupancy: 'available'
				}
			}
			set({ driver: driverData, vehicleId: driverData.vehicle?.id || 1 })
			get().showToast('Registration complete')
			return driverData
		}),
	logout: () => set({ driver: null, isBroadcasting: false }),
	toggleLocation: () => {
		const next = !get().locationEnabled
		set({ locationEnabled: next, ...(next ? {} : { coords: null, vehicles: [], isRadarActive: false, isBroadcasting: false }) })
		if (next) get().initLocation()
		else {
			if (locationWatcher) {
				locationWatcher.remove()
				locationWatcher = null
			}
			if (broadcastWatcher) {
				broadcastWatcher.remove()
				broadcastWatcher = null
			}
			if (intervalId) {
				clearInterval(intervalId)
				intervalId = null
			}
			lastAlertedId = null
		}
	},
	setVehicleId: vehicleId => {
		set({ vehicleId })
		get().showToast(`Vehicle ${vehicleId} selected`)
	},
	toggleRadar: () => {
		const next = !get().isRadarActive
		if (next) {
			get().startRadar()
		} else {
			get().stopRadar()
		}
		get().showToast(next ? 'Radar Scanning (2.0 km)' : 'Radar Inactive')
	},
	toggleBroadcast: () => {
		if (!get().locationEnabled) {
			get().showToast('Enable location to broadcast')
			return
		}
		const willBroadcast = !get().isBroadcasting
		set({ isBroadcasting: willBroadcast })
		get().showToast(willBroadcast ? 'Live' : 'Broadcast Stopped')
		if (willBroadcast) {
			Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 1 }, loc => {
				if (!loc?.coords) return
				set({ coords: loc.coords })
				updateDriverLocation(get().vehicleId, loc.coords.latitude, loc.coords.longitude)
			}).then(watcher => { broadcastWatcher = watcher }).catch(() => {})
		} else {
			if (broadcastWatcher) {
				broadcastWatcher.remove()
				broadcastWatcher = null
			}
			updateDriverLocation(get().vehicleId, null, null)
		}
	},
	stopBroadcast: () => {
		if (broadcastWatcher) {
			broadcastWatcher.remove()
			broadcastWatcher = null
		}
		updateDriverLocation(get().vehicleId, null, null)
		set({ isBroadcasting: false })
	},
	recenter: (duration = 500) => get().coords && get().mapRef?.animateToRegion({ latitude: get().coords.latitude, longitude: get().coords.longitude, latitudeDelta: 0.008, longitudeDelta: 0.008 }, duration),
	tick: () => {
		const { coords, isRadarActive, vehicleFilter } = get()
		if (!isRadarActive || !coords) return
		fetchLiveVehicles(coords.latitude, coords.longitude, 2.0, vehicleFilter).then(list => {
			const nearest = list[0]
			if (nearest && nearest.distance_km <= 0.35 && lastAlertedId !== nearest.vehicle_id) {
				lastAlertedId = nearest.vehicle_id
				Vibration.vibrate([0, 200, 100, 200])
			} else if (nearest && nearest.distance_km > 0.6) {
				lastAlertedId = null
			}
			set({ vehicles: list })
		}).catch(() => {})
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
	initLocation: () => {
		if (!get().locationEnabled) return Promise.resolve(false)
		return Location.requestForegroundPermissionsAsync().then(({ status }) => {
			if (status !== 'granted') return false
			Location.getLastKnownPositionAsync().then(loc => loc?.coords && set({ coords: loc.coords })).catch(() => {})
			Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(loc => loc?.coords && set({ coords: loc.coords })).catch(() => {})
			Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 2000, distanceInterval: 1 }, loc => loc?.coords && set({ coords: loc.coords })).then(w => { locationWatcher = w }).catch(() => {})
			return true
		}).catch(() => false)
	}
}))

useStore.getState().initLocation()
