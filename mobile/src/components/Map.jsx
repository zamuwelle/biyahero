import { useEffect, useRef } from 'react'
import { View } from 'react-native'
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps'
import { VehicleGlyph } from './VehicleGlyph'
import { theme, elevation } from '@/theme/tokens'
import { MAP_STYLE } from '@/theme/mapStyle'

/** Metro Manila. The commuter pans from here — the app never centres on them. */
const INITIAL_REGION = {
	latitude: 14.5750,
	longitude: 121.0000,
	latitudeDelta: 0.16,
	longitudeDelta: 0.16
}

const VehiclePin = ({ vehicle, selected, onPress }) => (
	<Marker
		coordinate={vehicle.position}
		onPress={onPress}
		anchor={{ x: 0.5, y: 0.5 }}
		tracksViewChanges={false}
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

/**
 * Map Canvas. Desaturated on purpose: the map is the ground, vehicles are the
 * figure. Nothing here reads or displays the commuter's own position — there is
 * no myLocation button and no permission request.
 */
export const Map = ({ vehicles = [], selectedId, onSelect, routeWaypoints, fitTo }) => {
	const mapRef = useRef(null)

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

	return (
		<View className="flex-1 bg-map-base">
			<MapView
				ref={mapRef}
				provider={PROVIDER_GOOGLE}
				style={{ flex: 1 }}
				initialRegion={INITIAL_REGION}
				customMapStyle={MAP_STYLE}
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
