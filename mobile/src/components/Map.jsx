import { memo, useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps'
import { MaterialIcons } from '@expo/vector-icons'
import { VehicleGlyph } from './VehicleGlyph'
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

const SettledMarker = ({ redrawKey, children, ...markerProps }) => {
	const [tracking, setTracking] = useState(true)

	useEffect(() => {
		setTracking(true)
		const timer = setTimeout(() => setTracking(false), SETTLE_MS)
		return () => clearTimeout(timer)
	}, [redrawKey])

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
	rememberRegion = false
}) => {
	const { theme, scheme } = useTheme()
	const mapRef = useRef(null)
	const [initialRegion, setInitialRegion] = useState(rememberRegion ? null : DEFAULT_REGION)
	// Android silently drops camera commands issued before onMapReady. fitTo is
	// memoised per trip upstream, so a dropped first call would never retry —
	// gate on readiness and the effect re-fires the moment the map can obey.
	const [mapReady, setMapReady] = useState(false)

	useEffect(() => {
		if (!rememberRegion) return

		AsyncStorage.getItem(REGION_KEY)
			.then(saved => setInitialRegion(saved ? JSON.parse(saved) : DEFAULT_REGION))
			.catch(() => setInitialRegion(DEFAULT_REGION))
	}, [rememberRegion])

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
				onRegionChangeComplete={region => {
					if (rememberRegion) AsyncStorage.setItem(REGION_KEY, JSON.stringify(region)).catch(() => {})
				}}
				customMapStyle={MAP_STYLES[scheme]}
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
		</View>
	)
}
