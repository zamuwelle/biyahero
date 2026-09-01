import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, View, ScrollView, KeyboardAvoidingView, Platform, Pressable, BackHandler, Keyboard } from 'react-native'
import { useRouter } from 'expo-router'
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps'
import { MaterialIcons } from '@expo/vector-icons'
import * as Location from 'expo-location'
import { Screen } from '@/components/ui/Screen'
import { Txt } from '@/components/ui/Txt'
import { Header } from '@/components/ui/Header'
import { Button } from '@/components/ui/Button'
import { SearchBar } from '@/components/SearchBar'
import { RoutePreview } from '@/components/RoutePreview'
import { useStore } from '@/services/store'
import { fetchRouteForDestination, fetchRoute, fetchEta, fetchNearbyRoutes, fetchRecentRoutes, searchPlaces, resolvePlace, newSearchSession } from '@/services/api'
import { MatchedText } from '@/components/MatchedText'
import { MAP_STYLES_WITH_PLACES } from '@/theme/mapStyle'
import { useTheme } from '@/theme/useTheme'
import { useCopy } from '@/constants/copy'

/**
 * Long enough that a fast typist spends one request instead of six on a
 * geocoder that asks for a call a second, short enough that the list feels
 * like it is keeping up. Anything near half a second reads as a stall.
 */
const TYPEAHEAD_DEBOUNCE_MS = 180

/** Does this row still answer what has been typed so far? */
const matchesQuery = (place, query) => {
	const haystack = `${place.name} ${place.subtitle ?? ''}`.toLowerCase()

	return query
		.toLowerCase()
		.split(/[\s,\-]+/)
		.filter(Boolean)
		.every(token => haystack.includes(token))
}

/**
 * 16 · Start Biyahe — and, when the store says so, mid-trip rerouting.
 *
 * The destination declared here is what the commuter search matches against.
 * Nothing is hardcoded: the route options are whatever corridors actually
 * pass near the driver's GPS position, the destination can be pinned on the
 * map, and an unknown town gets a brand-new road-snapped route built from
 * where the driver is standing.
 */
export default function StartTrip() {
	const copy = useCopy()
	const { theme, scheme } = useTheme()
	const router = useRouter()
	const driver = useStore(s => s.driver)
	const startTrip = useStore(s => s.startTrip)
	const rerouting = useStore(s => s.rerouting)
	const endReroute = useStore(s => s.endReroute)
	const rerouteTrip = useStore(s => s.rerouteTrip)
	const showToast = useStore(s => s.showToast)

	const [destination, setDestination] = useState('')
	const [position, setPosition] = useState(null)
	const [nearby, setNearby] = useState([])
	const [recent, setRecent] = useState([])
	const [selectedRouteId, setSelectedRouteId] = useState(null)
	const [pinned, setPinned] = useState(null)
	const [picking, setPicking] = useState(false)
	// Which pin the map picker is collecting: the destination, or another road
	// along the way.
	const [pickMode, setPickMode] = useState('destination')
	const [via, setVia] = useState([])
	const [pickPoint, setPickPoint] = useState(null)
	const [route, setRoute] = useState(null)
	const [eta, setEta] = useState(null)
	const [starting, setStarting] = useState(false)
	const [suggestions, setSuggestions] = useState([])
	// The last answered query and its results, so the next keystroke can be
	// answered from memory before the network has said anything.
	const lastQuery = useRef('')
	const lastResults = useRef([])
	// One session covers every keystroke of a search and the pick that ends
	// it; picking starts a fresh one.
	const session = useRef(newSearchSession())
	const [resolving, setResolving] = useState(null)
	const [searching, setSearching] = useState(false)
	const [searchFailed, setSearchFailed] = useState(false)
	// A picked place that Biyahero already serves keeps its route preview —
	// its exact coordinates ride along without hiding the corridor.
	const [pickedKnown, setPickedKnown] = useState(false)
	// Bumped on every manual choice, so a slow reverse geocode from an older
	// pin confirm can never clobber what the driver picked meanwhile.
	const chosenRef = useRef(0)
	// The text a suggestion put in the field — typing again must search, but
	// the choice itself must not immediately re-open the list.
	const chosenTextRef = useRef('')

	// The same run, again: a driver's own last three routes beat anything we
	// could infer for them.
	useEffect(() => {
		let cancelled = false

		fetchRecentRoutes()
			.then(rows => !cancelled && setRecent(rows))
			.catch(() => {})

		return () => {
			cancelled = true
		}
	}, [])

	// The driver's fix seeds the fallback route list and the point a new route
	// would start from. Drivers granted location long ago (trips need it), so
	// this resolves quietly.
	useEffect(() => {
		let cancelled = false

		const locate = async () => {
			const { status } = await Location.requestForegroundPermissionsAsync()
			if (status !== 'granted') return
			// maxAge: a cached fix from another city would list that city's
			// routes as "near you" — the exact bug this screen exists to kill.
			const seed =
				(await Location.getLastKnownPositionAsync({ maxAge: 60_000 }).catch(() => null)) ??
				(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(() => null))
			if (cancelled || !seed?.coords) return
			const at = { latitude: seed.coords.latitude, longitude: seed.coords.longitude }
			setPosition(at)
			fetchNearbyRoutes(at)
				.then(list => !cancelled && setNearby(list))
				.catch(() => {})
		}

		locate()
		return () => {
			cancelled = true
		}
	}, [])

	// Leaving without submitting must not leave the next visit in reroute mode.
	useEffect(() => () => endReroute(), [endReroute])

	// Type-ahead: places we already serve first, then anywhere in PH. Debounced
	// because every keystroke would otherwise hit a rate-limited geocoder.
	useEffect(() => {
		const q = destination.trim()
		if (q.length < 2 || q === chosenTextRef.current) {
			setSuggestions([])
			setSearching(false)
			setSearchFailed(false)
			return
		}

		// Narrow what is already on screen while the network catches up. One
		// more letter should TIGHTEN the list, not blank it for half a second
		// and start over — that blink is most of what makes a search box feel
		// broken even when it is working.
		const previous = lastQuery.current

		if (previous && q.toLowerCase().startsWith(previous.toLowerCase())) {
			const narrowed = lastResults.current.filter(place => matchesQuery(place, q))

			if (narrowed.length) setSuggestions(narrowed)
		}

		let cancelled = false
		setSearching(true)
		const timer = setTimeout(() => {
			searchPlaces(q, position, session.current)
				.then(found => {
					if (cancelled) return
					lastQuery.current = q
					lastResults.current = found
					setSuggestions(found)
					setSearchFailed(false)
				})
				// A dead network is not "walang nahanap" — saying so would send
				// the driver hunting for a different name that also cannot work.
				.catch(() => {
					if (cancelled) return
					setSuggestions([])
					setSearchFailed(true)
				})
				.finally(() => !cancelled && setSearching(false))
		}, TYPEAHEAD_DEBOUNCE_MS)

		return () => {
			cancelled = true
			clearTimeout(timer)
		}
	}, [destination, position])

	// Android back while the map picker is open closes the PICKER, not the screen.
	useEffect(() => {
		if (!picking) return
		const sub = BackHandler.addEventListener('hardwareBackPress', () => {
			setPicking(false)
			return true
		})
		return () => sub.remove()
	}, [picking])

	// Preview: an explicitly tapped route wins; otherwise resolve the typed
	// name. No preview means a NEW route will be built server-side on start.
	useEffect(() => {
		const name = destination.trim()
		if (selectedRouteId) {
			let cancelled = false
			setEta(null)
			fetchRoute(selectedRouteId)
				.then(async found => {
					if (cancelled) return
					const waypoints = (found.waypoints ?? []).map(w => ({ latitude: Number(w.lat), longitude: Number(w.lng) }))
					setRoute({ id: found.id, label: found.label, length_km: Number(found.length_km ?? 0), waypoints })
					const minutes = await fetchEta({
						routeId: found.id,
						vehicleType: driver?.vehicle?.vehicle_type ?? 'jeepney',
						distanceKm: Number(found.length_km ?? 0)
					})
					if (!cancelled) setEta(minutes)
				})
				.catch(() => {})
			return () => {
				cancelled = true
			}
		}

		// A pinned spot has no corridor to preview — unless it is a place we
		// already serve, where the exact pin and the known route coexist.
		if (!name || (pinned && !pickedKnown)) {
			setRoute(null)
			setEta(null)
			return
		}

		let cancelled = false
		const timer = setTimeout(async () => {
			const found = await fetchRouteForDestination(name).catch(() => null)
			if (cancelled) return
			setRoute(found)

			if (found) {
				const minutes = await fetchEta({
					routeId: found.id,
					vehicleType: driver?.vehicle?.vehicle_type ?? 'jeepney',
					distanceKm: found.length_km
				})
				if (!cancelled) setEta(minutes)
			}
		}, 300)

		return () => {
			cancelled = true
			clearTimeout(timer)
		}
	}, [destination, selectedRouteId, pinned, pickedKnown, driver])

	// The driver's own last five routes — one list, one length, no guessing
	// why it grew. Corridors near them appear only when there is no history
	// at all, so a driver's first run still has somewhere to start.
	const routeShortcuts = recent.length > 0 ? recent : nearby

	const typeDestination = text => {
		chosenRef.current++
		chosenTextRef.current = ''
		setDestination(text)
		setSelectedRouteId(null)
		setPinned(null)
		setPickedKnown(false)
	}

	const pickNearby = r => {
		chosenRef.current++
		chosenTextRef.current = r.destination
		setDestination(r.destination)
		setSelectedRouteId(r.id)
		setPinned(null)
		setPickedKnown(false)
		setSuggestions([])
		// The choice is made — get the keyboard out from over the button.
		Keyboard.dismiss()
	}

	// A picked suggestion carries exact coordinates — the same precision as
	// dropping a pin, which is what makes the commuter's marker land right.
	const pickPlace = async place => {
		let coords = place.coords

		// A Google prediction has no point until it is chosen. Resolve it with
		// the same session token, which is what closes the billing session.
		if (!coords && place.placeId) {
			setResolving(place.placeId)
			coords = (await resolvePlace(place.placeId, session.current).catch(() => null))?.coords ?? null
			setResolving(null)

			if (!coords) {
				// Without a point there is no route to build. Say so rather
				// than starting a trip that goes nowhere.
				showToast(copy.startTrip.resolveFailed)

				return
			}
		}

		session.current = newSearchSession()
		chosenRef.current++
		chosenTextRef.current = place.name
		setDestination(place.name)
		setPinned(coords)
		setPickedKnown(place.known)
		setSelectedRouteId(null)
		setSuggestions([])
		Keyboard.dismiss()
	}

	const addVia = async () => {
		if (!pickPoint) return
		const point = pickPoint
		setPicking(false)
		setVia(list => [...list, point])

		// Named on the device, so it costs no request and no rate limit. It is
		// only a label — the coordinate is what shapes the route.
		const [place] = await Location.reverseGeocodeAsync(point).catch(() => [])
		const name = place?.name ?? place?.street ?? place?.district ?? null
		if (name) {
			setVia(list => list.map(p => (p === point ? { ...p, name } : p)))
		}
	}

	const confirmPin = async () => {
		if (!pickPoint) return
		if (pickMode === 'via') return addVia()

		const token = ++chosenRef.current
		setPicking(false)
		setPinned(pickPoint)
		setPickedKnown(false)
		setSelectedRouteId(null)
		setSuggestions([])

		// A human-readable name for the pinned spot — it becomes the trip's
		// searchable destination, so "Piniling lokasyon" is the last resort.
		const places = await Location.reverseGeocodeAsync(pickPoint).catch(() => [])
		if (chosenRef.current !== token) return
		const place = places?.[0]
		const name = place?.district || place?.city || place?.subregion || copy.startTrip.pinnedFallback
		// Claim the text as a made choice, or the type-ahead treats the name we
		// just wrote as fresh typing and re-opens the list over the finished pin.
		chosenTextRef.current = name
		setDestination(name)
	}

	const begin = async () => {
		const name = destination.trim()
		if (!name) return showToast(copy.startTrip.needDestination)

		setStarting(true)
		try {
			const options = {
				routeId: selectedRouteId ?? undefined,
				destCoords: pinned ?? undefined,
				// Only meaningful for a route we are about to build: tapping a
				// listed corridor already picked its roads.
				via: selectedRouteId ? undefined : via
			}
			const rerouted = rerouting
			const trip = rerouted ? await rerouteTrip(name, options) : await startTrip(name, options)
			if (trip) {
				endReroute()
				// Reroute arrived here via push from the trip screen — going back
				// keeps the stack flat instead of stacking trip copies.
				if (rerouted) router.back()
				else router.replace('/driver/trip')
			}
		} catch (e) {
			showToast(e?.response?.data?.message ?? copy.common.genericError)
		} finally {
			setStarting(false)
		}
	}

	if (picking) {
		return (
			<View className="flex-1 bg-surface-canvas">
				<MapView
					provider={PROVIDER_GOOGLE}
					style={{ flex: 1 }}
					initialRegion={{
						latitude: position?.latitude ?? 14.575,
						longitude: position?.longitude ?? 121.0,
						latitudeDelta: 0.05,
						longitudeDelta: 0.05
					}}
					customMapStyle={MAP_STYLES_WITH_PLACES[scheme]}
					onPress={e => setPickPoint(e.nativeEvent.coordinate)}
					toolbarEnabled={false}
					rotateEnabled={false}
				>
					{!!pickPoint && (
						<Marker coordinate={pickPoint} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={true}>
							<View collapsable={false} style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
								<MaterialIcons name="place" size={52} color={theme.surface.default} style={{ position: 'absolute' }} />
								<MaterialIcons name="place" size={42} color={theme.route[1]} style={{ position: 'absolute', top: 4 }} />
							</View>
						</Marker>
					)}
				</MapView>

				<View style={{ position: 'absolute', top: 56, left: 24, right: 24, elevation: 6 }} className="rounded-lg bg-surface p-3">
					<Txt variant="bodyMStrong" className="text-center">
						{pickMode === 'via' ? copy.startTrip.viaPinHint : copy.startTrip.pinHint}
					</Txt>
				</View>

				<View style={{ position: 'absolute', bottom: 40, left: 24, right: 24, gap: 8 }}>
					<Button
						label={pickMode === 'via' ? copy.startTrip.viaPinUse : copy.startTrip.pinUse}
						onPress={confirmPin}
						disabled={!pickPoint}
					/>
					<Button label={copy.common.cancel} tone="secondary" onPress={() => setPicking(false)} />
				</View>
			</View>
		)
	}

	return (
		<Screen>
			<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
				<ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-6 pt-4 gap-6 flex-grow" keyboardShouldPersistTaps="handled">
					<Header title={rerouting ? copy.startTrip.rerouteTitle : copy.startTrip.title} />

					<Txt variant="bodyM" className="text-fg-secondary">
						{rerouting ? copy.startTrip.rerouteBody : copy.startTrip.body}
					</Txt>

					<SearchBar
						value={destination}
						onChangeText={typeDestination}
						onClear={() => typeDestination('')}
						placeholder={copy.startTrip.destinationPlaceholder}
					/>

					{!pinned && (searching || suggestions.length > 0) && (
						<View className="gap-2">
							<Txt variant="labelS" className="text-fg-secondary">{copy.startTrip.suggestionsLabel}</Txt>
							{searching && suggestions.length === 0 && (
								<Txt variant="caption" className="text-fg-secondary">{copy.startTrip.searching}</Txt>
							)}
							{suggestions.map(place => (
								<Pressable
									key={`${place.name}-${place.coords.latitude}-${place.coords.longitude}`}
									onPress={() => pickPlace(place)}
									accessibilityRole="button"
									className="flex-row items-center gap-3 rounded-lg border-[1.5px] border-line-subtle bg-surface p-3 active:opacity-80"
								>
									<MaterialIcons
										name={place.known ? 'directions-bus' : 'place'}
										size={20}
										color={place.known ? theme.route[1] : theme.icon.secondary}
									/>
									<View className="min-w-0 flex-1">
										<MatchedText text={place.name} query={destination} numberOfLines={1} />
										{!!place.subtitle && (
											<Txt variant="caption" className="text-fg-secondary" numberOfLines={1}>{place.subtitle}</Txt>
										)}
									</View>
									{/* Chain names repeat across the country. The distance is
									    what tells a driver whether this is the branch down
									    the road or one two provinces over. */}
									{resolving === place.placeId ? (
										<ActivityIndicator size="small" color={theme.icon.secondary} />
									) : place.distanceM != null ? (
										<Txt variant="caption" className="text-fg-secondary">
											{copy.startTrip.away(place.distanceM)}
										</Txt>
									) : null}
								</Pressable>
							))}
						</View>
					)}

					{!searching && suggestions.length === 0 && destination.trim().length >= 2 && !pinned && !selectedRouteId && (
						<Txt variant="caption" className="text-fg-secondary">
							{searchFailed ? copy.startTrip.searchFailed : copy.startTrip.noPlaces}
						</Txt>
					)}

					<Pressable
						onPress={() => {
							setPickMode('destination')
							setPickPoint(pinned ?? null)
							setPicking(true)
						}}
						accessibilityRole="button"
						className="flex-row items-center gap-3 rounded-lg border-[1.5px] border-line-subtle bg-surface p-3 active:opacity-80"
					>
						<MaterialIcons name="place" size={22} color={pinned ? theme.route[1] : theme.icon.secondary} />
						<Txt variant="bodyMStrong" className={pinned ? '' : 'text-fg-secondary'}>
							{copy.startTrip.pickOnMap}
						</Txt>
						{!!pinned && <MaterialIcons name="check-circle" size={18} color={theme.text.success} />}
					</Pressable>

					{/* Only for a route we are about to build. Tapping a listed
					    corridor already chose its roads, and a driver with no
					    destination yet has nothing for these to sit between. */}
					{!selectedRouteId && (destination.trim().length > 0 || pinned) && (
						<View className="gap-3">
							<View className="gap-[3px]">
								<Txt variant="labelS" className="text-fg-secondary">{copy.startTrip.viaLabel}</Txt>
								<Txt variant="caption" className="text-fg-secondary">{copy.startTrip.viaHint}</Txt>
							</View>

							{via.map((point, index) => (
								<View
									key={`${point.latitude},${point.longitude},${index}`}
									className="flex-row items-center gap-3 rounded-lg border-[1.5px] border-line-subtle bg-surface p-3"
								>
									<Txt variant="bodyMStrong" className="text-fg-secondary">{index + 1}</Txt>
									<Txt variant="bodyM" numberOfLines={1} className="min-w-0 flex-1">
										{point.name ?? copy.startTrip.viaPinned}
									</Txt>
									<Pressable
										onPress={() => setVia(list => list.filter((_, at) => at !== index))}
										accessibilityRole="button"
										accessibilityLabel={copy.startTrip.viaRemove}
										hitSlop={10}
									>
										<MaterialIcons name="close" size={20} color={theme.icon.secondary} />
									</Pressable>
								</View>
							))}

							<Pressable
								onPress={() => {
									setPickMode('via')
									setPickPoint(null)
									setPicking(true)
								}}
								accessibilityRole="button"
								className="flex-row items-center gap-3 rounded-lg border-[1.5px] border-dashed border-line-subtle p-3 active:opacity-80"
							>
								<MaterialIcons name="add" size={22} color={theme.icon.secondary} />
								<Txt variant="bodyMStrong" className="text-fg-secondary">{copy.startTrip.viaAdd}</Txt>
							</Pressable>
						</View>
					)}

					{routeShortcuts.length > 0 && (
						<View className="gap-3">
							<Txt variant="labelS" className="text-fg-secondary">
								{recent.length > 0 ? copy.startTrip.recentLabel : copy.startTrip.nearbyLabel}
							</Txt>
							<View className="gap-2">
								{routeShortcuts.map(r => (
									<Pressable
										key={r.id}
										onPress={() => pickNearby(r)}
										accessibilityRole="button"
										className={`rounded-lg border-[1.5px] p-3 active:opacity-80 ${
											selectedRouteId === r.id ? 'border-brand bg-brand-subtle' : 'border-line-subtle bg-surface'
										}`}
									>
										<Txt variant="bodyMStrong" numberOfLines={1}>{r.label}</Txt>
										<Txt variant="caption" className="text-fg-secondary">
											{r.distance_m != null
												? copy.startTrip.nearbyMeta(r.length_km, r.distance_m)
												: copy.startTrip.recentMeta(r.length_km, r.lastUsedAt)}
										</Txt>
									</Pressable>
								))}
							</View>
						</View>
					)}

					{!!route && (
						<View className="gap-3">
							<Txt variant="labelS" className="text-fg-secondary">{copy.startTrip.previewLabel}</Txt>
							<RoutePreview waypoints={route.waypoints} />
							<Txt variant="caption" className="text-fg-secondary">
								{eta ? copy.startTrip.preview(route.length_km, eta) : `~${route.length_km} km`}
							</Txt>
						</View>
					)}

					{!route && (!!destination.trim() || !!pinned) && (
						<View className="flex-row items-start gap-3 rounded-lg bg-surface-sunken p-3">
							<MaterialIcons name="alt-route" size={20} color={theme.icon.secondary} />
							<Txt variant="caption" className="min-w-0 flex-1 text-fg-secondary">{copy.startTrip.newRouteNote}</Txt>
						</View>
					)}

					<View className="flex-1" />
					<Button
						label={rerouting ? copy.startTrip.rerouteSubmit : copy.startTrip.start}
						onPress={begin}
						loading={starting}
						disabled={!destination.trim()}
					/>
				</ScrollView>
			</KeyboardAvoidingView>
		</Screen>
	)
}
