import { useEffect, useRef, useState } from 'react'
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

const VehiclePin = ({ vehicle, selected, onPress }) => {
	const { theme } = useTheme()

	return (
	<Marker
		coordinate={vehicle.position}
		onPress={onPress}
		anchor={{ x: 0.5, y: 0.5 }}
		// Above the destination pin (60): when a vehicle arrives, the live
		// thing wins the pixels. The commuter's own dot (100) tops both.
		zIndex={selected ? 80 : 70}
		// Permanently true. Android snapshots custom marker views, and every
		// timed freeze-after-mount heuristic lost the race on cold start,
		// leaving an empty map. With ~a dozen markers the re-snapshot cost is
		// nothing; an invisible fleet is everything.
		tracksViewChanges={true}
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
	</Marker>
	)
}

/**
 * Pin for where a trip (or a search) is headed — "Papuntang Tarlac City" on a
 * card should be findable on the map, not just a word. Icon-only on purpose:
 * Android shears any marker view wider than ~50dp on this stack (label chips
 * came out half-drawn on device), and the name is already on the basemap,
 * the sheet header, and the detail row. The white under-icon keeps the pin
 * legible over dark roads; the tip marks the exact spot.
 */
const DestinationPin = ({ pin }) => {
	const { theme } = useTheme()

	return (
		<Marker
			coordinate={pin}
			anchor={{ x: 0.5, y: 1 }}
			tracksViewChanges={true}
			zIndex={60}
			accessibilityLabel={pin.label}
		>
			<View collapsable={false} style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
				<MaterialIcons name="place" size={52} color={theme.surface.default} style={{ position: 'absolute' }} />
				<MaterialIcons name="place" size={42} color={theme.route[1]} style={{ position: 'absolute', top: 4 }} />
			</View>
		</Marker>
	)
}

/**
 * Map Canvas. Desaturated on purpose: the map is the ground, vehicles are the
 * figure. Nothing here reads or displays the commuter's own position — there is
 * no myLocation button and no permission request.
 */
export const Map = ({ vehicles = [], selectedId, onSelect, routeWaypoints, destinationPin, fitTo, myLocation, locateNonce = 0, rememberRegion = false }) => {
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

	// When a destination narrows the list, frame the matches instead of leaving
	// the user to hunt for them on a city-wide view.
	useEffect(() => {
		const points = fitTo?.filter(Boolean)
		if (!mapReady || !points?.length || !mapRef.current) return

		mapRef.current.fitToCoordinates(points, {
			edgePadding: { top: 120, right: 80, bottom: 380, left: 80 },
			animated: true
		})
	}, [fitTo, mapReady])

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

				{/* Small hollow dot on the route's other end, so the line reads
				    start → destination rather than as a floating squiggle. */}
				{!!routeWaypoints?.length && (
					<Marker coordinate={routeWaypoints[0]} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={true} zIndex={55}>
						<View
							className="h-[14px] w-[14px] rounded-full border-[3px]"
							style={{ backgroundColor: theme.surface.default, borderColor: theme.route[1] }}
						/>
					</Marker>
				)}

				{!!destinationPin && <DestinationPin pin={destinationPin} />}

				{vehicles
					.filter(v => v.position)
					.map(v => (
						<VehiclePin key={v.id} vehicle={v} selected={v.id === selectedId} onPress={() => onSelect?.(v)} />
					))}

				{!!myLocation && (
					<Marker coordinate={myLocation} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={true} zIndex={100}>
						{/* The conventional blue dot: halo, white ring, solid core. */}
						<View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(26,115,232,0.18)' }}>
							<View
								className="h-[18px] w-[18px] rounded-full border-[3px]"
								style={{ backgroundColor: '#1A73E8', borderColor: '#FFFFFF' }}
							/>
						</View>
					</Marker>
				)}
			</MapView>
		</View>
	)
}
