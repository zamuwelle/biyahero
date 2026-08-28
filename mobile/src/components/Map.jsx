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
	mall: 'local-mall',
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
const PLACE_MAX_DELTA = 0.11
const PLACE_NEAR_DELTA = 0.05

/**
 * Two tiers, which is how every real map fits a town onto a phone: the places
 * worth naming get a name, everything else gets a dot until you zoom in. A
 * named pin is 52dp of screen and cannot crowd; a dot is 22dp and can sit
 * close to its neighbours, so most of the density lives in the dot tier.
 */
const PLACE_LABEL_CAP_FAR = 9
const PLACE_LABEL_CAP_NEAR = 16
const PLACE_DOT_CAP_FAR = 20
const PLACE_DOT_CAP_NEAR = 34

/**
 * How much of the viewport one pin claims, so two of them cannot print over
 * each other. Google runs a label collision engine; this is the cheap version
 * of the same idea, and it is why a dense poblacion reads as legible places
 * instead of a pile of overlapping text.
 */
const PLACE_CLEAR_X = 0.13
const PLACE_CLEAR_Y = 0.085
const PLACE_DOT_CLEAR_X = 0.042
const PLACE_DOT_CLEAR_Y = 0.030

/** Panning settles before we ask — a drag must not fire a request per frame. */
const PLACE_DEBOUNCE_MS = 600

/** Fetch wider than the screen so a short pan is already answered. */
const PLACE_PAD = 0.5

/**
 * Draw a little past the edge as well. A pin that pops in and out as it
 * crosses the boundary is a native marker created and destroyed each time,
 * and that churn shows up as dropped frames while panning.
 */
const PLACE_OVERDRAW = 1.25

/**
 * How many places to keep from earlier viewports. Holding them means a pan
 * that crosses into new ground ADDS markers instead of replacing every one;
 * the bound stops a long session growing without limit.
 */
const PLACE_MEMORY = 250

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
 * Short window: these are a glyph in a circle, and the icon font is held at
 * launch (see _layout), so there is no font race left to wait out. Pins mount
 * only after the camera has settled and the fetch has returned, so the very
 * first capture already happens on a still map.
 */
const PLACE_SETTLE_MS = 150

/**
 * One place from Biyahero's own layer.
 *
 * Named at 52dp square, or a bare 20dp dot. 52dp is what this stack can
 * actually draw: a custom marker view is rasterised into a bitmap that will
 * not grow past roughly 60dp — a bare 200x36 test box came back a ragged
 * 100x100 blob, which is why the old label chips were half-drawn. So the name
 * is set in 8pt over two lines and truncated, and Android's own info window
 * carries it in full on tap for both tiers; that one is drawn by the OS and is
 * not subject to the cap.
 *
 * Under the fleet on purpose. These are the ground the jeepneys move over.
 */
const PlacePin = memo(({ place, labelled, mapType }) => {
	const { theme, scheme } = useTheme()
	const terminal = place.kind === 'terminal'
	// Dark ink on a pale grid, white on aerial photography — the same swap
	// Google makes, because neither reads on the other's background.
	const onImagery = mapType === 'hybrid'

	// No elevation: an Android shadow is a separate render pass per marker,
	// and with dozens on screen that was most of the cost. A hairline border
	// separates the badge from the map for a fraction of the work.
	const badge = (
		<View
			style={{
				width: labelled ? 26 : 20,
				height: labelled ? 26 : 20,
				borderRadius: labelled ? 13 : 10,
				alignItems: 'center',
				justifyContent: 'center',
				backgroundColor: theme.surface.default,
				borderColor: terminal ? theme.route[1] : theme.border.subtle,
				borderWidth: terminal ? 2 : 1
			}}
		>
			<MaterialIcons
				name={PLACE_ICONS[place.kind] ?? 'place'}
				size={labelled ? 15 : 12}
				color={terminal ? theme.route[1] : theme.icon.secondary}
			/>
		</View>
	)

	return (
		<SettledMarker
			coordinate={place.position}
			anchor={{ x: 0.5, y: 0.5 }}
			zIndex={terminal ? 50 : labelled ? 40 : 35}
			redrawKey={`${scheme}|${mapType}|${labelled}`}
			settleMs={PLACE_SETTLE_MS}
			// Android draws this itself, so the name is safe from the bitmap
			// cap — and it is the only way a dot says what it is.
			title={place.name}
			accessibilityLabel={place.name}
		>
			{labelled ? (
				<View collapsable={false} style={{ width: 52, height: 52, alignItems: 'center' }}>
					{badge}
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
			) : (
				<View collapsable={false} style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
					{badge}
				</View>
			)}
		</SettledMarker>
	)
}, (prev, next) =>
	prev.place.id === next.place.id &&
	prev.labelled === next.labelled &&
	prev.mapType === next.mapType)

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
					// Merge rather than replace: replacing unmounted every
					// marker on screen and rebuilt it, which was the single
					// biggest source of stutter while panning.
					setPlaces(prev => {
						// Not `new Map` — the component in this file is called
						// Map and shadows the global.
						const fresh = new Set(rows.map(p => p.id))
						const all = [...prev.filter(p => !fresh.has(p.id)), ...rows]

						return all.length > PLACE_MEMORY ? all.slice(all.length - PLACE_MEMORY) : all
					})
				})
				// A map without shop pins is a smaller loss than a red box.
				.catch(() => {})
		}, PLACE_DEBOUNCE_MS)

		return () => clearTimeout(timer)
	}, [viewport, initialRegion])

	// Trim the fetched box to what is actually on screen, then to what a phone
	// can draw. The server already ordered them by how much a commuter needs
	// them, so slicing keeps terminals and landmarks and drops the bakeries.
	const view = viewport ?? initialRegion

	// Which places get named depends on the camera, but it must not depend on
	// every twitch of it: a 20 m nudge otherwise reshuffles the tiers, and
	// every marker that changes tier is unmounted and rasterised again. That
	// churn was most of the lag. Quantising to a fifth of the screen means a
	// real pan re-tiers and a settle-in-place does not.
	const layoutKey = view
		? [
			Math.round(view.latitude / (view.latitudeDelta / 5)),
			Math.round(view.longitude / (view.longitudeDelta / 5)),
			view.latitudeDelta.toFixed(3)
		].join('|')
		: 'none'

	const visiblePlaces = useMemo(() => {
		if (!view || view.latitudeDelta > PLACE_MAX_DELTA) return []

		const latPad = (view.latitudeDelta / 2) * PLACE_OVERDRAW
		const lngPad = (view.longitudeDelta / 2) * PLACE_OVERDRAW

		// Merged sets arrive in whatever order they were fetched, so the
		// server's ranking is restored here: what a commuter needs most, then
		// what is nearest the middle of the view.
		const onScreen = places
			.filter(p =>
				Math.abs(p.position.latitude - view.latitude) <= latPad &&
				Math.abs(p.position.longitude - view.longitude) <= lngPad)
			.sort((a, b) =>
				(a.rank - b.rank) ||
				((a.position.latitude - view.latitude) ** 2 + (a.position.longitude - view.longitude) ** 2) -
				((b.position.latitude - view.latitude) ** 2 + (b.position.longitude - view.longitude) ** 2))

		const near = view.latitudeDelta <= PLACE_NEAR_DELTA
		const labelCap = near ? PLACE_LABEL_CAP_NEAR : PLACE_LABEL_CAP_FAR
		const dotCap = near ? PLACE_DOT_CAP_NEAR : PLACE_DOT_CAP_FAR

		// Greedy, in the server's order: the first place to claim a patch of
		// screen keeps it. That order is "most useful first", so a terminal
		// wins its corner and the sari-sari store beside it steps aside — to
		// the dot tier rather than off the map.
		const free = (kept, p, clearX, clearY) =>
			!kept.some(k =>
				Math.abs(k.place.position.longitude - p.position.longitude) / view.longitudeDelta < clearX &&
				Math.abs(k.place.position.latitude - p.position.latitude) / view.latitudeDelta < clearY)

		const kept = []

		for (const place of onScreen) {
			if (kept.length >= labelCap) break
			if (free(kept, place, PLACE_CLEAR_X, PLACE_CLEAR_Y)) kept.push({ place, labelled: true })
		}

		const named = new Set(kept.map(k => k.place.id))

		for (const place of onScreen) {
			if (kept.length >= labelCap + dotCap) break
			if (named.has(place.id)) continue
			if (free(kept, place, PLACE_DOT_CLEAR_X, PLACE_DOT_CLEAR_Y)) kept.push({ place, labelled: false })
		}

		return kept
		// `view` is deliberately not a dependency: layoutKey is its quantised
		// form, and re-running on the raw camera is exactly the churn above.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [places, layoutKey])

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
					if (rememberRegion) AsyncStorage.setItem(REGION_KEY, JSON.stringify(next)).catch(() => {})
				}}
				mapType={mapType}
				// Styling only applies to the drawn map; imagery ignores it.
				customMapStyle={mapType === 'standard' ? MAP_STYLES[scheme] : []}
				showsUserLocation={false}
				showsMyLocationButton={false}
				showsBuildings={false}
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
				{visiblePlaces.map(({ place, labelled }) => (
					<PlacePin key={place.id} place={place} labelled={labelled} mapType={mapType} />
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
