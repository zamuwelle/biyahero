import { useEffect, useRef } from 'react'
import { View } from 'react-native'
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps'
import { useTheme } from '@/theme/useTheme'
import { MAP_STYLES } from '@/theme/mapStyle'

/** Non-interactive thumbnail of the route the driver is about to declare. */
export const RoutePreview = ({ waypoints = [], height = 150 }) => {
	const { theme, scheme } = useTheme()
	const mapRef = useRef(null)

	useEffect(() => {
		if (waypoints.length < 2 || !mapRef.current) return

		// Small delay: fitToCoordinates before layout settles is a no-op on Android.
		const timer = setTimeout(() => {
			mapRef.current?.fitToCoordinates(waypoints, {
				edgePadding: { top: 32, right: 32, bottom: 32, left: 32 },
				animated: false
			})
		}, 240)

		return () => clearTimeout(timer)
	}, [waypoints])

	if (waypoints.length < 2) return null

	const start = waypoints[0]
	const end = waypoints[waypoints.length - 1]

	return (
		<View style={{ height }} className="overflow-hidden rounded-lg bg-map-base">
			<MapView
				ref={mapRef}
				provider={PROVIDER_GOOGLE}
				style={{ flex: 1 }}
				customMapStyle={MAP_STYLES[scheme]}
				initialRegion={{ ...start, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
				scrollEnabled={false}
				zoomEnabled={false}
				rotateEnabled={false}
				pitchEnabled={false}
				toolbarEnabled={false}
			>
				<Polyline coordinates={waypoints} strokeColor={theme.route[1]} strokeWidth={5} />
				<Marker coordinate={start} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
					<View
						className="h-[14px] w-[14px] rounded-full border-[3px] bg-surface"
						style={{ borderColor: theme.route[1] }}
					/>
				</Marker>
				<Marker coordinate={end} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
					<View className="h-4 w-4 rounded-full bg-surface-inverse" />
				</Marker>
			</MapView>
		</View>
	)
}
