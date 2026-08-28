import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { View, Pressable } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps'
import { MaterialIcons } from '@expo/vector-icons'
import { VehicleGlyph } from './VehicleGlyph'
import { Txt } from '@/components/ui/Txt'
import { fetchNearbyPlaces } from '@/services/api'
import { usePrefs, MAP_TYPES } from '@/services/prefs'
import { useCopy } from '@/constants/copy'
import { elevation } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'
import { MAP_STYLES } from '@/theme/mapStyle'

/**
 * Metro Manila, where the demo fleet runs. The commuter pans from here — the app
 * never centres on them, because it never learns where they are.
 */
const DEFAULT_REGION = {
	latitude: 14.5750,
	longitude: 121.0000,
	latitudeDelta: 0.16,
	longitudeDelta: 0.16
}

/**
 * Where the user last panned, remembered on the device only.
 *
 * Without this the map reopens over Metro Manila every launch, which is wrong
 * for anyone living elsewhere. Remembering the last view gives them their own
 * area back without ever asking for a location permission.
 */
const REGION_KEY = 'biyahero.mapRegion'

/**
 * Marker whose view tracking stays on through a generous settle window, then
 * freezes. While tracksViewChanges is true Android re-rasterises the marker
 * continuously — with a whole fleet that is real GPU work every frame. But
 * frozen too early it snapshots a blank view (fonts and SVGs land late on a
 * cold start; a 900ms freeze lost that race on device). So: track for
 * SETTLE_MS after mount, freeze, and re-open the window whenever something
 * that changes the marker's pixels changes (`redrawKey`). Position changes
 * move the frozen bitmap — they need no window.
 */
const SETTLE_MS = 5000

const SettledMarker = ({ redrawKey, settleMs = SETTLE_MS, children, ...markerProps }) => {
	const [tracking, setTracking] = useState(true)

	useEffect(() => {
		setTracking(true)
		const timer = setTimeout(() => setTracking(false), settleMs)
		return () => clearTimeout(timer)
	}, [redrawKey, settleMs])

	return (
		<Marker tracksViewChanges={tracking} {...markerProps}>
			{children}
		</Marker>
	)
}

const VehiclePin = memo(({ vehicle, selected, onSelect }) => {
	const { theme, scheme } = useTheme()

	return (
	<SettledMarker
		coordinate={vehicle.position}
		onPress={() => onSelect?.(vehicle)}
		anchor={{ x: 0.5, y: 0.5 }}
		// Above the destination pin (60): when a vehicle arrives, the live
		// thing wins the pixels. The commuter's own dot (100) tops both.
		zIndex={selected ? 80 : 70}
		redrawKey={`${vehicle.vehicle_type}|${vehicle.stale}|${selected}|${scheme}`}
		accessibilityLabel={`${vehicle.destination}, ${vehicle.plate_number}`}
	>
		<View
			style={[
				elevation.float,
				{
					borderColor: vehicle.stale ? theme.border.strong : theme.route[1],
					borderStyle: vehicle.stale ? 'dashed' : 'solid',
					backgroundColor: selected ? theme.brand.default : theme.surface.default,
					opacity: vehicle.stale ? 0.75 : 1
				}
			]}
			className="h-11 w-11 items-center justify-center rounded-md border-2"
		>
			<VehicleGlyph
				type={vehicle.vehicle_type}
				width={24}
				color={vehicle.stale ? theme.icon.muted : theme.icon.primary}
			/>
		</View>
	</SettledMarker>
	)
}, (prev, next) =>
	// The fleet re-renders every 8 s poll with fresh object identities; only
	// these fields change any pixel or behaviour of a pin.
	prev.selected === next.selected &&
	prev.onSelect === next.onSelect &&
	prev.vehicle.stale === next.vehicle.stale &&
	prev.vehicle.vehicle_type === next.vehicle.vehicle_type &&
	// destination/plate reach the accessibilityLabel, not the pixels — but a
	// screen reader must not keep announcing last trip's destination.
	prev.vehicle.destination === next.vehicle.destination &&
	prev.vehicle.plate_number === next.vehicle.plate_number &&
	prev.vehicle.position?.latitude === next.vehicle.position?.latitude &&
	prev.vehicle.position?.longitude === next.vehicle.position?.longitude
)

/**
 * The driver's OWN vehicle: the same badge as the fleet pins but in
 * location-blue, so their map reads "that's me" — a vehicle, not a dot.
 */
const SelfVehiclePin = ({ vehicle }) => (
	<SettledMarker
		coordinate={vehicle.position}
		anchor={{ x: 0.5, y: 0.5 }}
		redrawKey={vehicle.vehicle_type}
		zIndex={95}
	>
		<View
			style={[elevation.float, { borderColor: '#FFFFFF', backgroundColor: '#1A73E8' }]}
			className="h-11 w-11 items-center justify-center rounded-md border-2"
		>
			<VehicleGlyph type={vehicle.vehicle_type} width={24} color="#FFFFFF" />
		</View>
	</SettledMarker>
)

/**
 * Pin for where a trip (or a search) is headed — "Papuntang Tarlac City" on a
 * card should be findable on the map, not just a word. Icon-only on purpose:
 * Android shears any marker view wider than ~50dp on this stack (label chips
 * came out half-drawn on device), and the name is already on the basemap,
 * the sheet header, and the detail row. The white under-icon keeps the pin
 * legible over dark roads; the tip marks the exact spot.
 */
const DestinationPin = ({ pin }) => {
	const { theme, scheme } = useTheme()

	return (
		<SettledMarker
			coordinate={pin}
			anchor={{ x: 0.5, y: 1 }}
			redrawKey={scheme}
			zIndex={60}
			accessibilityLabel={pin.label}
		>
			<View collapsable={false} style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
				<MaterialIcons name="place" size={52} color={theme.surface.default} style={{ position: 'absolute' }} />
				<MaterialIcons name="place" size={42} color={theme.route[1]} style={{ position: 'absolute', top: 4 }} />
			</View>
		</SettledMarker>
	)
}

/**
 * Biyahero's own place layer.
 *
 * The Google Maps Android SDK only applies a custom style to the plain map
 * type. On satellite and terrain it draws its own labels and far fewer of
 * them, so the three layers disagreed about what exists — a church on
 * satellite, a public market on standard, neither on the other. Drawing the
 * places ourselves is the only way all three can show the same thing.
 */
const PLACE_ICONS = {
	terminal: 'directions-bus',
	worship: 'church',
	school: 'school',
	hospital: 'local-hospital',
	market: 'storefront',
	government: 'account-balance',
	store: 'shopping-bag',
	park: 'park',
	fuel: 'local-gas-station',
	pharmacy: 'local-pharmacy',
	bank: 'savings',
	hotel: 'hotel',
	food: 'restaurant'
}

/**
 * Zoomed out past about a town's width the pins pile on top of each other —
 * Google hides its own POIs at these zooms for the same reason. Closer in,
 * more of them: detail arrives as you zoom, which is the behaviour people
 * already expect from a map.
 */
const PLACE_MAX_DELTA = 0.09
const PLACE_NEAR_DELTA = 0.02
const PLACE_CAP_FAR = 14
const PLACE_CAP_NEAR = 28

/**
 * How much of the viewport one pin claims, so two of them cannot print their
 * names over each other. Google runs a label collision engine; this is the
 * cheap version of the same idea, and it is why a dense poblacion reads as a
 * handful of legible places instead of a pile of overlapping text.
 */
const PLACE_CLEAR_X = 0.13
const PLACE_CLEAR_Y = 0.08

/** Panning settles before we ask — a drag must not fire a request per frame. */
const PLACE_DEBOUNCE_MS = 600

/** Fetch wider than the screen so a short pan is already answered. */
const PLACE_PAD = 0.35

/** A region as map corners, optionally grown past what is on screen. */
const boxFor = (region, pad = 0) => {
	const lat = (region.latitudeDelta / 2) * (1 + pad * 2)
	const lng = (region.longitudeDelta / 2) * (1 + pad * 2)

	return {
		south: region.latitude - lat,
		north: region.latitude + lat,
		west: region.longitude - lng,
		east: region.longitude + lng
	}
}

/** Whether what we already fetched still covers the whole view. */
const boxCovers = (outer, inner) =>
	!!outer &&
	outer.south <= inner.south &&
	outer.north >= inner.north &&
	outer.west <= inner.west &&
	outer.east >= inner.east

/**
 * Short window: these are a glyph in a circle, nowhere near the SVG-and-font
 * race a vehicle pin has to win. It reopens on every camera settle, because
 * Android otherwise freezes whatever it caught mid-flight.
 */
const PLACE_SETTLE_MS = 900

/**
 * One place from Biyahero's own layer.
 *
 * 52dp square, because that is what this stack can actually draw. A custom
 * marker view is rasterised into a bitmap that will not grow past roughly
 * 60dp: a bare 200x36 test box came back as a ragged 100x100 blob, which is
 * why the old label chips were half-drawn. So the name is set in 8pt over two
 * lines and truncated, and Android's own info window carries it in full on
 * tap — that one is drawn by the OS and is not subject to the cap.
 *
 * Under the fleet on purpose. These are the ground the jeepneys move over.
 */
const PlacePin = memo(({ place, redraw, mapType }) => {
	const { theme, scheme } = useTheme()
	const terminal = place.kind === 'terminal'
	// Dark ink on a pale grid, white on aerial photography — the same swap
	// Google makes, because neither reads on the other's background.
	const onImagery = mapType === 'hybrid'

	return (
		<SettledMarker
			coordinate={place.position}
			anchor={{ x: 0.5, y: 0.5 }}
			zIndex={terminal ? 50 : 40}
			redrawKey={`${scheme}|${mapType}|${redraw}`}
			settleMs={PLACE_SETTLE_MS}
			// Android draws this itself, so the name is safe from the bitmap cap.
			title={place.name}
			accessibilityLabel={place.name}
		>
			<View collapsable={false} style={{ width: 52, height: 52, alignItems: 'center' }}>
				<View
					style={[
						elevation.float,
						{
							width: 26,
							height: 26,
							borderRadius: 13,
							alignItems: 'center',
							justifyContent: 'center',
							backgroundColor: theme.surface.default,
							borderColor: terminal ? theme.route[1] : theme.border.subtle,
							borderWidth: terminal ? 2 : 1
						}
					]}
				>
					<MaterialIcons
						name={PLACE_ICONS[place.kind] ?? 'place'}
						size={15}
						color={terminal ? theme.route[1] : theme.icon.secondary}
					/>
				</View>
				<Txt
					numberOfLines={2}
					style={{
						width: 52,
						marginTop: 1,
						textAlign: 'center',
						fontSize: 8,
						lineHeight: 9,
						color: onImagery ? '#FFFFFF' : theme.text.primary,
						textShadowColor: onImagery ? 'rgba(0,0,0,0.9)' : theme.surface.default,
						textShadowRadius: 3
					}}
				>
					{place.name}
				</Txt>
			</View>
		</SettledMarker>
	)
}, (prev, next) =>
	prev.place.id === next.place.id && prev.redraw === next.redraw && prev.mapType === next.mapType)

const LAYER_ICONS = { standard: 'map', hybrid: 'satellite-alt', terrain: 'terrain' }

/**
 * Google-style layer switcher. Satellite is the reason it exists: a commuter
 * who cannot place a street name can almost always recognise the roof of the
 * terminal they are standing next to.
 *
 * Unpositioned on purpose — it sits in the Map's control column so it lines up
 * with whatever else a screen stacks there.
 */
const LayerPicker = () => {
	const copy = useCopy()
	const { theme } = useTheme()
	const mapType = usePrefs(s => s.mapType)
	const setMapType = usePrefs(s => s.setMapType)
	const [open, setOpen] = useState(false)

	return (
		<View className="items-end gap-2">
			{open && (
				<View style={elevation.float} className="gap-1 rounded-lg border-[1.5px] border-line-subtle bg-surface p-2">
					{MAP_TYPES.map(type => (
						<Pressable
							key={type}
							onPress={() => {
								setMapType(type)
								setOpen(false)
							}}
							accessibilityRole="button"
							accessibilityState={{ selected: mapType === type }}
							className={`flex-row items-center gap-2 rounded-md px-3 py-2 active:opacity-80 ${
								mapType === type ? 'bg-brand-subtle' : ''
							}`}
						>
							<MaterialIcons
								name={LAYER_ICONS[type]}
								size={18}
								color={mapType === type ? theme.brand.hover : theme.icon.secondary}
							/>
							<Txt variant="bodyMStrong" className={mapType === type ? 'text-brand-hover' : 'text-fg-secondary'}>
								{copy.mapHome.layerNames[type]}
							</Txt>
						</Pressable>
					))}
				</View>
			)}

			<Pressable
				onPress={() => setOpen(o => !o)}
				accessibilityRole="button"
				accessibilityLabel={copy.mapHome.layers}
				style={elevation.float}
				className="h-14 w-14 items-center justify-center rounded-full border-[1.5px] border-line-subtle bg-surface active:opacity-80"
			>
				<MaterialIcons name="layers" size={24} color={open ? theme.brand.hover : theme.icon.secondary} />
			</Pressable>
		</View>
	)
}

/**
 * Map Canvas. Desaturated on purpose: the map is the ground, vehicles are the
 * figure. Nothing here reads or displays the commuter's own position — there is
 * no myLocation button and no permission request.
 */
export const Map = ({
	vehicles = [],
	selectedId,
	onSelect,
	onMapPress,
	routeWaypoints,
	destinationPin,
	selfVehicle,
	fitTo,
	fitKey,
	myLocation,
	locateNonce = 0,
	rememberRegion = false,
	// Extra round controls (a crosshair, say) stacked under the layer button in
	// the same column, so every screen's controls share one right edge.
	controls,
	// Clears the tallest sheet on any screen using this map.
	controlsBottom = 420
}) => {
	const { theme, scheme } = useTheme()
	const mapType = usePrefs(s => s.mapType)
	const mapRef = useRef(null)
	const [initialRegion, setInitialRegion] = useState(rememberRegion ? null : DEFAULT_REGION)
	// Android silently drops camera commands issued before onMapReady. fitTo is
	// memoised per trip upstream, so a dropped first call would never retry —
	// gate on readiness and the effect re-fires the moment the map can obey.
	const [mapReady, setMapReady] = useState(false)
	// The settled viewport, which is what the place layer is drawn for. It is
	// where the map is POINTED — chosen by dragging — never where the user is.
	const [viewport, setViewport] = useState(null)
	const [places, setPlaces] = useState([])
	const fetchedBox = useRef(null)
	// Bumped every time the camera stops, to reopen the place pins' capture
	// window. Panning must not leave a field of half-drawn markers behind.
	const [settleTick, setSettleTick] = useState(0)

	useEffect(() => {
		if (!rememberRegion) return

		AsyncStorage.getItem(REGION_KEY)
			.then(saved => setInitialRegion(saved ? JSON.parse(saved) : DEFAULT_REGION))
			.catch(() => setInitialRegion(DEFAULT_REGION))
	}, [rememberRegion])

	// Biyahero's own place layer: fetched for a box wider than the screen, so a
	// short pan is already answered, and only once the map has stopped moving.
	useEffect(() => {
		const view = viewport ?? initialRegion
		if (!view) return

		if (view.latitudeDelta > PLACE_MAX_DELTA) {
			// Zoomed out past the point where labels are readable. Drop the box
			// too, so coming back down re-fetches instead of drawing a stale set.
			fetchedBox.current = null
			setPlaces([])

			return
		}

		if (boxCovers(fetchedBox.current, boxFor(view))) return

		const timer = setTimeout(() => {
			const box = boxFor(view, PLACE_PAD)

			fetchNearbyPlaces(box)
				.then(rows => {
					fetchedBox.current = box
					setPlaces(rows)
				})
				// A map without shop pins is a smaller loss than a red box.
				.catch(() => {})
		}, PLACE_DEBOUNCE_MS)

		return () => clearTimeout(timer)
	}, [viewport, initialRegion])

	// Trim the fetched box to what is actually on screen, then to what a phone
	// can draw. The server already ordered them by how much a commuter needs
	// them, so slicing keeps terminals and landmarks and drops the bakeries.
	const visiblePlaces = useMemo(() => {
		const view = viewport ?? initialRegion
		if (!view || view.latitudeDelta > PLACE_MAX_DELTA) return []

		const latPad = view.latitudeDelta / 2
		const lngPad = view.longitudeDelta / 2

		const onScreen = places.filter(p =>
			Math.abs(p.position.latitude - view.latitude) <= latPad &&
			Math.abs(p.position.longitude - view.longitude) <= lngPad)

		// Greedy, in the server's order: the first place to claim a patch of
		// screen keeps it. That order is "most useful first", so a terminal
		// wins its corner and the sari-sari store beside it steps aside.
		const kept = []
		const cap = view.latitudeDelta <= PLACE_NEAR_DELTA ? PLACE_CAP_NEAR : PLACE_CAP_FAR

		for (const p of onScreen) {
			if (kept.length >= cap) break

			const clashes = kept.some(k =>
				Math.abs(k.position.longitude - p.position.longitude) / view.longitudeDelta < PLACE_CLEAR_X &&
				Math.abs(k.position.latitude - p.position.latitude) / view.latitudeDelta < PLACE_CLEAR_Y)

			if (!clashes) kept.push(p)
		}

		return kept
	}, [places, viewport, initialRegion])

	// Crosshair tap: bring the commuter's own dot into view.
	useEffect(() => {
		if (locateNonce > 0 && myLocation && mapRef.current) {
			mapRef.current.animateCamera({ center: myLocation, zoom: 15 }, { duration: 600 })
		}
	}, [locateNonce])

	// Frame the matches ONCE per fitKey — a new search, a new route. The
	// points array is rebuilt on every 8 s poll, and re-fitting on that would
	// yank the camera back the moment anyone pans or zooms.
	const lastFitKey = useRef(null)
	useEffect(() => {
		const points = fitTo?.filter(Boolean)

		// Nothing to frame — the search was cleared, or its matches have not
		// arrived yet. Release the key so returning to the SAME destination
		// frames again instead of being mistaken for the frame still showing.
		if (!points?.length) {
			lastFitKey.current = null
			return
		}

		if (!mapReady || !mapRef.current) return
		if (fitKey !== undefined && fitKey === lastFitKey.current) return

		lastFitKey.current = fitKey
		mapRef.current.fitToCoordinates(points, {
			edgePadding: { top: 120, right: 80, bottom: 380, left: 80 },
			animated: true
		})
	}, [fitTo, fitKey, mapReady])

	// Hold the map back until the saved region is known, otherwise it mounts on
	// the default and visibly jumps.
	if (!initialRegion) return <View className="flex-1 bg-map-base" />

	return (
		<View className="flex-1 bg-map-base">
			<MapView
				ref={mapRef}
				provider={PROVIDER_GOOGLE}
				style={{ flex: 1 }}
				initialRegion={initialRegion}
				onMapReady={() => setMapReady(true)}
				// Tapping bare map clears whatever the user was following —
				// marker taps fire their own handler and never reach this.
				// POI labels are their own gesture on Android and would
				// otherwise swallow the tap, so they clear the focus too.
				onPress={onMapPress}
				onPoiClick={onMapPress}
				onRegionChangeComplete={next => {
					setViewport(next)
					setSettleTick(t => t + 1)
					if (rememberRegion) AsyncStorage.setItem(REGION_KEY, JSON.stringify(next)).catch(() => {})
				}}
				mapType={mapType}
				// Styling only applies to the drawn map; imagery ignores it.
				customMapStyle={mapType === 'standard' ? MAP_STYLES[scheme] : []}
				showsUserLocation={false}
				showsMyLocationButton={false}
				showsBuildings={true}
				showsCompass={false}
				toolbarEnabled={false}
				rotateEnabled={false}
			>
				{!!routeWaypoints?.length && (
					<Polyline coordinates={routeWaypoints} strokeColor={theme.route[1]} strokeWidth={5} />
				)}

				{/* No start dot: routes render navigation-style — the line begins
				    at the vehicle and is consumed as it travels. */}
				{/* Under everything else Biyahero draws: these are the ground the
				    fleet moves over, not the thing being tracked. */}
				{visiblePlaces.map(place => (
					<PlacePin key={place.id} place={place} redraw={settleTick} mapType={mapType} />
				))}

				{!!destinationPin && <DestinationPin pin={destinationPin} />}

				{vehicles
					.filter(v => v.position)
					.map(v => (
						<VehiclePin key={v.id} vehicle={v} selected={v.id === selectedId} onSelect={onSelect} />
					))}

				{!!selfVehicle?.position && <SelfVehiclePin vehicle={selfVehicle} />}

				{!!myLocation && (
					<SettledMarker coordinate={myLocation} anchor={{ x: 0.5, y: 0.5 }} redrawKey="static" zIndex={100}>
						{/* The conventional blue dot: halo, white ring, solid core. */}
						<View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(26,115,232,0.18)' }}>
							<View
								className="h-[18px] w-[18px] rounded-full border-[3px]"
								style={{ backgroundColor: '#1A73E8', borderColor: '#FFFFFF' }}
							/>
						</View>
					</SettledMarker>
				)}
			</MapView>

			{/* One column owns every floating control: two absolutely positioned
			    siblings drift apart the moment their paddings differ. */}
			<View style={{ position: 'absolute', right: 24, bottom: controlsBottom }} className="items-end gap-3">
				<LayerPicker />
				{controls}
			</View>
		</View>
	)
}
