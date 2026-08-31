import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Location from 'expo-location'
import * as api from './api'
import { PING_INTERVAL_MS } from '@/theme/tokens'
import { Vibration } from 'react-native'
import { distanceM, NEAR_M, NEAR_RESET_M } from './geo'
import { getCopy } from '@/constants/copy'

const KEYS = { role: 'biyahero.role', token: 'biyahero.token', driver: 'biyahero.driver', searches: 'biyahero.searches' }
const MAX_RECENT = 3

let pollTimer = null
let broadcastWatcher = null
let broadcastGuard = null
let myLocationWatcher = null
// Vehicles already announced, so two jeepneys in range do not buzz forever.
let alertedIds = new Set()
let toastTimer = null
let lastStreetLookup = 0
// Only the newest /active-vehicles reply may write to the store.
let refreshSeq = 0

/**
 * The broadcast watcher itself: streams the driver's fix to the server every
 * ping interval and mirrors it into the store for the driver's own map.
 */
const startBroadcastWatcher = (tripId, get, set) => {
	// Distance is accumulated here because only this watcher sees every fix.
	// It was never sent at all, so every kilometre figure a real driver saw —
	// this trip, today's total, their history, their profile — was 0.
	let travelledKm = get().trip?.distance_km ?? 0
	let lastFix = null

	return Location.watchPositionAsync(
		{ accuracy: Location.Accuracy.High, timeInterval: PING_INTERVAL_MS, distanceInterval: 20 },
		async loc => {
			if (!loc?.coords) return
			const { latitude, longitude } = loc.coords
			const here = { latitude, longitude }

			// GPS jitter while parked would otherwise inflate the total, so a
			// hop under 15 m does not count as distance travelled.
			const hop = distanceM(lastFix, here)
			if (hop !== null && hop >= 15) travelledKm += hop / 1000
			lastFix = here

			set({ broadcastPosition: here, trip: { ...get().trip, distance_km: Number(travelledKm.toFixed(2)) } })

			let street
			if (Date.now() - lastStreetLookup > STREET_LOOKUP_INTERVAL_MS) {
				lastStreetLookup = Date.now()
				try {
					const [place] = await Location.reverseGeocodeAsync({ latitude, longitude })
					// place.name is a Plus Code ("HMCF+MRR") when the OS has no
					// street — useless on a commuter card, so a real place name
					// is preferred and a code is dropped entirely.
					const isPlusCode = value => /^[A-Z0-9]{4,8}\+[A-Z0-9]{2,4}$/i.test(value ?? '')
					street =
						[place?.street, place?.district, place?.subregion, place?.city, place?.name]
							.find(value => value && !isPlusCode(value)) ?? undefined
				} catch {
					// A failed lookup just means the card keeps the previous street.
				}
			}

			api.pingTrip(tripId, { latitude, longitude, street, distanceKm: Number(travelledKm.toFixed(2)) }).catch(() => {})
		}
	)
}

/**
 * One GPS fix, cached-first. High accuracy, never Balanced — the network
 * provider hangs forever on some devices (this MediaTek included).
 */
const currentFix = async () => {
	try {
		// maxAge matters: an unbounded cached fix from another city hours ago is
		// exactly the wrong-corridor bug this position exists to prevent.
		const seed = await Location.getLastKnownPositionAsync({ maxAge: 60_000 })
		if (seed?.coords) return { latitude: seed.coords.latitude, longitude: seed.coords.longitude }
		// Race a timeout: getCurrentPositionAsync can hang on a cold GPS, and a
		// spinner that never resolves is worse than the server's clear refusal.
		const fix = await Promise.race([
			Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
			new Promise(resolve => setTimeout(() => resolve(null), 12_000))
		])
		return fix?.coords ? { latitude: fix.coords.latitude, longitude: fix.coords.longitude } : null
	} catch {
		return null
	}
}

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

				// Show the cached profile immediately; the network refresh follows.
				const cached = await AsyncStorage.getItem(KEYS.driver).catch(() => null)
				if (cached) set({ driver: JSON.parse(cached) })

				// NOT awaited: the splash used to sit through two round-trips, which
				// on a weak signal meant twenty seconds staring at nothing.
				get().resumeSession()
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

	/**
	 * Refresh the driver session in the background, and pick a run back up
	 * if the process died mid-trip.
	 */
	resumeSession: async () => {
		try {
			const driver = await api.fetchMe()
			set({ driver })
			await AsyncStorage.setItem(KEYS.driver, JSON.stringify(driver))

			const trip = await api.fetchCurrentTrip().catch(() => null)
			if (trip) {
				set({ trip, isBroadcasting: true })
				// Without restarting the watcher the LIVE banner would lie:
				// no pings, no dot, no watchdog.
				get()
					.beginBroadcast(trip.id)
					.catch(() => set({ isBroadcasting: false }))
			}
		} catch (e) {
			// Only a REJECTED token ends the session. A network failure must not
			// log the driver out, or every dead spot forces a re-registration.
			if (e?.response?.status === 401) {
				await AsyncStorage.multiRemove([KEYS.token, KEYS.driver])
				api.setAuthToken(null)
				set({ driver: null, trip: null })
			}
		}
	},

	/* ------------------------------------------------------------- commuter */
	// Filtering never uses a commuter position. `myLocation` exists only when
	// the commuter taps the crosshair and grants permission — strictly opt-in,
	// display-and-alert only, never sent to the server.
	myLocation: null,
	myLocationOn: false,
	vehicles: [],
	activeCount: 0,
	loading: false,
	error: null,
	destination: null,
	/** How wide the "passes near here" corridor is, straight from the server. */
	corridorRadiusM: null,
	destinationPosition: null,
	vehiclesFor: null,
	destinationResolved: true,
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
		get().showToast(getCopy().settings.searchesCleared)
	},

	refresh: async () => {
		const { destination, vehicleFilter } = get()
		const seq = ++refreshSeq
		set({ loading: true })

		try {
			const { vehicles, meta } = await api.fetchActiveVehicles({
				destination: destination?.name,
				destCoords: destination?.lat != null ? { lat: destination.lat, lng: destination.lng } : undefined,
				vehicleType: vehicleFilter
			})
			// A slower earlier request must not overwrite a newer answer, or the
			// header ends up describing a list it did not produce.
			if (seq !== refreshSeq) return

			set({
				vehicles,
				activeCount: meta.count ?? vehicles.length,
				corridorRadiusM: meta.corridor_radius_m ?? null,
				// Where the server actually located the search, so a typed place
				// no destination row knows can still be pinned on the map.
				destinationPosition: meta.destination_position
					? {
							latitude: Number(meta.destination_position.lat),
							longitude: Number(meta.destination_position.lng)
						}
					: null,
				// The place this list was measured against. Naming a distance
				// after a destination it was not computed for invents a figure.
				vehiclesFor: destination?.name ?? null,
				// The server says outright when it could not locate the place; saying
				// "no rides pass there" instead would blame the fleet for a typo.
				destinationResolved: meta.resolved !== false,
				error: null
			})
			get().checkProximity()
		} catch {
			set({ error: getCopy().common.offline })
		} finally {
			set({ loading: false })
		}
	},

	/**
	 * Opt-in blue dot. Nothing here talks to the server: the position feeds the
	 * map marker, the distance lines, and the nearby vibration — that is all.
	 */
	enableMyLocation: async () => {
		// A second tap while the first is still resolving would leave an
		// orphaned watcher writing myLocation forever.
		if (myLocationWatcher) return true

		const servicesOn = await Location.hasServicesEnabledAsync().catch(() => false)
		if (!servicesOn) {
			get().showToast(getCopy().mapHome.locationServicesOff)
			return false
		}

		const { status } = await Location.requestForegroundPermissionsAsync()
		if (status !== 'granted') {
			get().showToast(getCopy().settings.locationOff)
			return false
		}

		set({ myLocationOn: true })
		get().showToast(getCopy().mapHome.myLocationOn)

		const apply = coords => {
			if (!coords) return
			set({ myLocation: { latitude: coords.latitude, longitude: coords.longitude } })
			get().checkProximity()
		}

		try {
			// Seed from the OS cache instantly, then demand a fresh fix — the
			// cache alone can be empty on a cold permission grant.
			// Bounded: an hours-old fix from another city would place the dot —
			// and every distance computed from it — somewhere they are not.
			const seed = await Location.getLastKnownPositionAsync({ maxAge: 60_000 })
			apply(seed?.coords)

			// High, not Balanced: on some devices (this MediaTek included) the
			// network provider never answers and Balanced hangs forever, while
			// GPS resolves fine — the driver-side watcher proved that.
			if (!seed?.coords) {
				const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
				apply(fix?.coords)
			}

			myLocationWatcher = await Location.watchPositionAsync(
				{ accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
				loc => apply(loc?.coords)
			)
		} catch (e) {
			// Surfacing beats a silently empty map — this is why the dot exists.
			// Clear the seed fix too: a lingering myLocation with the toggle off
			// would keep distance-sorting the list to a frozen coordinate.
			get().showToast(`${getCopy().common.genericError} (${e?.message ?? 'location'})`)
			set({ myLocation: null, myLocationOn: false })
			return false
		}

		return true
	},

	disableMyLocation: () => {
		if (myLocationWatcher) {
			myLocationWatcher.remove()
			myLocationWatcher = null
		}
		alertedIds = new Set()
		set({ myLocation: null, myLocationOn: false })
		get().showToast(getCopy().mapHome.myLocationOff)
	},

	toggleMyLocation: () => (get().myLocationOn ? get().disableMyLocation() : get().enableMyLocation()),

	/**
	 * Vibrate once when a LIVE vehicle comes within NEAR_M of the commuter,
	 * and not again until it has left NEAR_RESET_M — otherwise a jeepney
	 * crawling in traffic would buzz the phone continuously.
	 */
	checkProximity: (candidates = null) => {
		const { myLocation, myLocationOn, vehicles } = get()
		if (!myLocationOn || !myLocation) return

		const live = (candidates ?? vehicles).filter(v => !v.stale && v.position)
		const withDistance = live
			.map(v => ({ v, d: distanceM(myLocation, v.position) }))
			.filter(x => x.d !== null)
			.sort((a, b) => a.d - b.d)

		// Per VEHICLE, not just the nearest one: with two jeepneys in range
		// a single slot flip-flopped and buzzed on every poll.
		for (const { v, d } of withDistance) {
			if (d > NEAR_RESET_M) alertedIds.delete(v.id)
		}

		const arriving = withDistance.find(x => x.d <= NEAR_M && !alertedIds.has(x.v.id))
		if (!arriving) return

		alertedIds.add(arriving.v.id)
		Vibration.vibrate([0, 250, 120, 250])
		get().showToast(getCopy().mapHome.near(arriving.v.plate_number))
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
			await AsyncStorage.setItem(KEYS.driver, JSON.stringify(data.user))
			set({ driver: data.user })
			return data.user
		} finally {
			set({ registering: false })
		}
	},

	login: async credentials => {
		const data = await api.loginDriver(credentials)
		api.setAuthToken(data.token)
		await AsyncStorage.setItem(KEYS.token, data.token)
		await AsyncStorage.setItem(KEYS.driver, JSON.stringify(data.user))
		set({ driver: data.user })
		return data.user
	},

	/** Re-reads the driver, including verification_status — polled by the pending screen. */
	refreshMe: async () => {
		try {
			const driver = await api.fetchMe()
			set({ driver })
			await AsyncStorage.setItem(KEYS.driver, JSON.stringify(driver))
			return driver
		} catch {
			return null
		}
	},

	logout: async () => {
		await api.logoutDriver()
		await AsyncStorage.multiRemove([KEYS.token, KEYS.driver])
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
	startTrip: async (destination, { routeId, destCoords } = {}) => {
		// The server refuses an unapproved driver too; this is the local guard so
		// we never even ask for GPS from someone who cannot broadcast yet.
		if (get().driver?.verification_status !== 'approved') {
			get().showToast(getCopy().pending.notApproved)
			return null
		}

		// GPS off means the watcher would produce nothing: a driver would look
		// "live" to themselves while never appearing to a single commuter.
		const servicesOn = await Location.hasServicesEnabledAsync().catch(() => false)
		if (!servicesOn) {
			get().showToast(getCopy().driverHome.locationServicesOff)
			return null
		}

		const { status } = await Location.requestForegroundPermissionsAsync()
		if (status !== 'granted') {
			get().showToast(getCopy().settings.locationOff)
			return null
		}

		const position = await currentFix()
		const trip = await api.startTrip(destination, { routeId, position, destCoords })
		set({ trip, isBroadcasting: true })
		await get().beginBroadcast(trip.id)
		return trip
	},

	/**
	 * Mid-trip destination change. The server re-resolves the route from the
	 * vehicle's live position, so the drawn line re-routes the way a
	 * navigation app would — the run itself keeps going.
	 */
	rerouteTrip: async (destination, { routeId, destCoords } = {}) => {
		const trip = get().trip
		if (!trip) return null

		const position = await currentFix()
		const updated = await api.rerouteTrip(trip.id, destination, { routeId, position, destCoords })
		set({ trip: updated })
		get().showToast(getCopy().startTrip.rerouted)
		return updated
	},

	/** Route intent for /driver/start: deep links drop params, stores don't. */
	rerouting: false,
	beginReroute: () => set({ rerouting: true }),
	endReroute: () => set({ rerouting: false }),

	/** The driver's own live fix — their map draws from it, navigation-style. */
	broadcastPosition: null,

	beginBroadcast: async tripId => {
		if (broadcastWatcher) broadcastWatcher.remove()
		if (broadcastGuard) clearInterval(broadcastGuard)

		// The driver's GPS is the only thing commuters can track. If Location
		// gets switched off mid-trip the watcher just goes silent, so keep
		// telling the driver until it is back on.
		broadcastGuard = setInterval(async () => {
			const servicesOn = await Location.hasServicesEnabledAsync().catch(() => false)
			if (!servicesOn) get().showToast(getCopy().driverHome.locationServicesOff)
		}, 20_000)

		try {
			broadcastWatcher = await startBroadcastWatcher(tripId, get, set)
		} catch (e) {
			// A rejected watcher (GPS flipped off mid-start) must not leave the
			// guard toasting forever with nothing to guard.
			get().stopBroadcast()
			throw e
		}
	},

	setCapacity: async capacity => {
		const { trip } = get()
		if (!trip) return
		set({ trip: { ...trip, capacity } })
		try {
			await api.setTripCapacity(trip.id, capacity)
		} catch {
			get().showToast(getCopy().common.genericError)
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
		if (broadcastGuard) {
			clearInterval(broadcastGuard)
			broadcastGuard = null
		}
		set({ isBroadcasting: false, broadcastPosition: null })
	}
}))
