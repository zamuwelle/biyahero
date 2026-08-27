import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import * as api from './api'
import { PING_INTERVAL_MS } from '@/theme/tokens'
import * as copy from '@/constants/copy'

const KEYS = { role: 'biyahero.role', token: 'biyahero.token', searches: 'biyahero.searches' }
const MAX_RECENT = 3

let pollTimer = null
let broadcastWatcher = null
let toastTimer = null
let lastStreetLookup = 0

/** Reverse-geocode sparingly — it is rate-limited and the street rarely changes. */
const STREET_LOOKUP_INTERVAL_MS = 30_000

export const useStore = create((set, get) => ({
	/* ---------------------------------------------------------------- shared */
	role: null,
	hydrated: false,
	toast: null,

	showToast: message => {
		if (toastTimer) clearTimeout(toastTimer)
		set({ toast: message })
		toastTimer = setTimeout(() => set({ toast: null }), 2200)
	},

	setRole: async role => {
		set({ role })
		await AsyncStorage.setItem(KEYS.role, role)
	},

	/** Restore role, driver session and recent searches before the first render. */
	hydrate: async () => {
		try {
			const [role, token, searches] = await Promise.all([
				AsyncStorage.getItem(KEYS.role),
				AsyncStorage.getItem(KEYS.token),
				AsyncStorage.getItem(KEYS.searches)
			])

			if (token) {
				api.setAuthToken(token)
				try {
					const driver = await api.fetchMe()
					set({ driver })
					const trip = await api.fetchCurrentTrip().catch(() => null)
					if (trip) set({ trip, isBroadcasting: true })
				} catch {
					// Token no longer valid — drop it rather than half-restoring a session.
					await AsyncStorage.removeItem(KEYS.token)
					api.setAuthToken(null)
				}
			}

			set({
				role: role ?? null,
				recentSearches: searches ? JSON.parse(searches) : [],
				hydrated: true
			})
		} catch {
			set({ hydrated: true })
		}
	},

	/* ------------------------------------------------------------- commuter */
	// No coords, no permission, no radius. The only filters are a typed
	// destination and a vehicle class.
	vehicles: [],
	activeCount: 0,
	loading: false,
	error: null,
	destination: null,
	vehicleFilter: 'all',
	selectedVehicleId: null,
	recentSearches: [],

	setVehicleFilter: filter => {
		set({ vehicleFilter: filter })
		get().refresh()
	},

	setDestination: async destination => {
		set({ destination, selectedVehicleId: null })
		if (destination) await get().rememberSearch(destination)
		get().refresh()
	},

	clearDestination: () => {
		set({ destination: null, selectedVehicleId: null })
		get().refresh()
	},

	selectVehicle: selectedVehicleId => set({ selectedVehicleId }),

	/** Recent searches live on the device only — never sent to the server. */
	rememberSearch: async destination => {
		const next = [destination, ...get().recentSearches.filter(d => d.name !== destination.name)].slice(0, MAX_RECENT)
		set({ recentSearches: next })
		await AsyncStorage.setItem(KEYS.searches, JSON.stringify(next))
	},

	clearSearches: async () => {
		set({ recentSearches: [] })
		await AsyncStorage.removeItem(KEYS.searches)
		get().showToast(copy.settings.searchesCleared)
	},

	refresh: async () => {
		const { destination, vehicleFilter } = get()
		set({ loading: true })

		try {
			const { vehicles, meta } = await api.fetchActiveVehicles({
				destination: destination?.name,
				vehicleType: vehicleFilter
			})
			set({ vehicles, activeCount: meta.count ?? vehicles.length, error: null })
		} catch {
			set({ error: copy.common.offline })
		} finally {
			set({ loading: false })
		}
	},

	startPolling: () => {
		if (pollTimer) clearInterval(pollTimer)
		get().refresh()
		// 8 s, matching the driver broadcast interval — polling faster would only
		// re-render the same pings.
		pollTimer = setInterval(() => get().refresh(), PING_INTERVAL_MS)
	},

	stopPolling: () => {
		if (pollTimer) clearInterval(pollTimer)
		pollTimer = null
	},

	/* --------------------------------------------------------------- driver */
	driver: null,
	trip: null,
	summary: null,
	isBroadcasting: false,
	registering: false,

	register: async payload => {
		set({ registering: true })
		try {
			const data = await api.registerDriver(payload)
			api.setAuthToken(data.token)
			await AsyncStorage.setItem(KEYS.token, data.token)
			set({ driver: data.user })
			return data.user
		} finally {
			set({ registering: false })
		}
	},

	login: async phone => {
		const data = await api.loginDriver(phone)
		api.setAuthToken(data.token)
		await AsyncStorage.setItem(KEYS.token, data.token)
		set({ driver: data.user })
		return data.user
	},

	/** Re-reads the driver, including verification_status — polled by the pending screen. */
	refreshMe: async () => {
		try {
			const driver = await api.fetchMe()
			set({ driver })
			return driver
		} catch {
			return null
		}
	},

	logout: async () => {
		await api.logoutDriver()
		await AsyncStorage.removeItem(KEYS.token)
		api.setAuthToken(null)
		get().stopBroadcast()
		set({ driver: null, trip: null, summary: null })
	},

	loadSummary: async () => {
		try {
			set({ summary: await api.fetchTripSummary() })
		} catch {
			set({ summary: null })
		}
	},

	/**
	 * Starting a trip is what makes the driver visible. Location capture begins
	 * here and nowhere else — this is the app's only GPS permission prompt.
	 */
	startTrip: async (destination, routeId) => {
		// The server refuses an unapproved driver too; this is the local guard so
		// we never even ask for GPS from someone who cannot broadcast yet.
		if (get().driver?.verification_status !== 'approved') {
			get().showToast(copy.pending.notApproved)
			return null
		}

		const { status } = await Location.requestForegroundPermissionsAsync()
		if (status !== 'granted') {
			get().showToast(copy.settings.locationOff)
			return null
		}

		const trip = await api.startTrip(destination, routeId)
		set({ trip, isBroadcasting: true })
		await get().beginBroadcast(trip.id)
		return trip
	},

	beginBroadcast: async tripId => {
		if (broadcastWatcher) broadcastWatcher.remove()

		broadcastWatcher = await Location.watchPositionAsync(
			{ accuracy: Location.Accuracy.High, timeInterval: PING_INTERVAL_MS, distanceInterval: 20 },
			async loc => {
				if (!loc?.coords) return
				const { latitude, longitude } = loc.coords

				let street
				if (Date.now() - lastStreetLookup > STREET_LOOKUP_INTERVAL_MS) {
					lastStreetLookup = Date.now()
					try {
						const [place] = await Location.reverseGeocodeAsync({ latitude, longitude })
						street = place?.street || place?.name || place?.district || undefined
					} catch {
						// A failed lookup just means the card keeps the previous street.
					}
				}

				api.pingTrip(tripId, { latitude, longitude, street }).catch(() => {})
			}
		)
	},

	setCapacity: async capacity => {
		const { trip } = get()
		if (!trip) return
		set({ trip: { ...trip, capacity } })
		try {
			await api.setTripCapacity(trip.id, capacity)
		} catch {
			get().showToast(copy.common.genericError)
		}
	},

	endTrip: async () => {
		const { trip } = get()
		get().stopBroadcast()
		if (trip) await api.endTrip(trip.id).catch(() => {})
		set({ trip: null, isBroadcasting: false })
		get().loadSummary()
	},

	stopBroadcast: () => {
		if (broadcastWatcher) {
			broadcastWatcher.remove()
			broadcastWatcher = null
		}
		set({ isBroadcasting: false })
	}
}))
