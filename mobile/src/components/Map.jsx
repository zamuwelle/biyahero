import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps'
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
	const { theme, scheme } = useTheme()

	/**
	 * Android + custom marker views: with tracksViewChanges permanently false,
	 * the marker snapshots its view BEFORE the glyph has drawn and renders
	 * invisible — intermittently, since it is a race. Track until the view has
	 * had time to draw, then freeze for performance; re-arm whenever anything
	 * that changes the pin's appearance changes.
	 */
	const [tracks, setTracks] = useState(true)
	useEffect(() => {
		setTracks(true)
		const timer = setTimeout(() => setTracks(false), 900)
		return () => clearTimeout(timer)
	}, [selected, vehicle.stale, vehicle.vehicle_type, scheme])

	return (
	<Marker
		coordinate={vehicle.position}
		onPress={onPress}
		anchor={{ x: 0.5, y: 0.5 }}
		tracksViewChanges={tracks}
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
 * Map Canvas. Desaturated on purpose: the map is the ground, vehicles are the
 * figure. Nothing here reads or displays the commuter's own position — there is
 * no myLocation button and no permission request.
 */
export const Map = ({ vehicles = [], selectedId, onSelect, routeWaypoints, fitTo, rememberRegion = false }) => {
	const { theme, scheme } = useTheme()
	const mapRef = useRef(null)
	const [initialRegion, setInitialRegion] = useState(rememberRegion ? null : DEFAULT_REGION)

	useEffect(() => {
		if (!rememberRegion) return

		AsyncStorage.getItem(REGION_KEY)
			.then(saved => setInitialRegion(saved ? JSON.parse(saved) : DEFAULT_REGION))
			.catch(() => setInitialRegion(DEFAULT_REGION))
	}, [rememberRegion])

	// When a destination narrows the list, frame the matches instead of leaving
	// the user to hunt for them on a city-wide view.
	useEffect(() => {
		const points = fitTo?.filter(Boolean)
		if (!points?.length || !mapRef.current) return

		mapRef.current.fitToCoordinates(points, {
			edgePadding: { top: 120, right: 80, bottom: 380, left: 80 },
			animated: true
		})
	}, [fitTo])

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
				onRegionChangeComplete={region => {
					if (rememberRegion) AsyncStorage.setItem(REGION_KEY, JSON.stringify(region)).catch(() => {})
				}}
				customMapStyle={MAP_STYLES[scheme]}
				showsUserLocation={false}
				showsMyLocationButton={false}
				showsCompass={false}
				toolbarEnabled={false}
				rotateEnabled={false}
			>
				{!!routeWaypoints?.length && (
					<Polyline coordinates={routeWaypoints} strokeColor={theme.route[1]} strokeWidth={5} />
				)}

				{vehicles
					.filter(v => v.position)
					.map(v => (
						<VehiclePin key={v.id} vehicle={v} selected={v.id === selectedId} onPress={() => onSelect?.(v)} />
					))}
			</MapView>
		</View>
	)
}
