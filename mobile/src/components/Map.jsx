import { useEffect, useRef, useState } from 'react'
import { View, Text, Easing } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import MapView, { Marker, Circle, Polyline, AnimatedRegion, PROVIDER_GOOGLE } from 'react-native-maps'
import { MaterialIcons } from '@expo/vector-icons'
import { useStore } from '@/services/store'
import { getRouteWaypoints } from '@/services/api'
import { IconButton } from '@/components/IconButton'

const VehicleMarker = ({ vehicle, isNearest }) => {
	const markerRef = useRef(null)
	const animatedCoord = useRef(
		new AnimatedRegion({
			latitude: vehicle.position.latitude,
			longitude: vehicle.position.longitude,
			latitudeDelta: 0,
			longitudeDelta: 0
		})
	).current

	useEffect(() => {
		if (vehicle?.position?.latitude == null) return
		animatedCoord.timing({
			latitude: vehicle.position.latitude,
			longitude: vehicle.position.longitude,
			duration: 1000,
			easing: Easing.linear,
			useNativeDriver: false
		}).start()
		if (isNearest) {
			const timer = setTimeout(() => markerRef.current?.showCallout(), 100)
			return () => clearTimeout(timer)
		}
	}, [vehicle.position.latitude, vehicle.position.longitude, isNearest])

	const isNear = vehicle.distance_km <= 0.5
	const meters = Math.round(vehicle.distance_km * 1000)
	const eta = vehicle.predicted_eta_minutes < 1 ? 'arriving' : `${Math.round(vehicle.predicted_eta_minutes)} mins`
	const title = `${eta} · ${meters}m · ${vehicle.vehicle_id}`

	return (
		<Marker.Animated
			ref={markerRef}
			coordinate={animatedCoord}
			anchor={{ x: 0.5, y: 0.5 }}
			tracksViewChanges={true}
			title={title}
			onPress={() => useStore.getState().setSelectedVehicle(vehicle)}
		>
			<View
				collapsable={false}
				style={{
					width: 24,
					height: 24,
					borderRadius: 12,
					backgroundColor: isNear ? '#2563eb' : '#64748b',
					borderWidth: 2,
					borderColor: '#ffffff',
					alignItems: 'center',
					justifyContent: 'center',
					elevation: isNear ? 4 : 2
				}}
			>
				<MaterialIcons name="directions-bus" size={14} color="white" />
			</View>
		</Marker.Animated>
	)
}

export const Map = ({ showRadar = false, action }) => {
	const insets = useSafeAreaInsets()
	const [waypoints, setWaypoints] = useState([])
	const coords = useStore(s => s.coords)
	const locationEnabled = useStore(s => s.locationEnabled)
	const isRadarActive = useStore(s => s.isRadarActive)
	const vehicles = useStore(s => s.vehicles)
	const recenter = useStore(s => s.recenter)
	const initLocation = useStore(s => s.initLocation)
	const toast = useStore(s => s.toast)

	const [centeredOnce, setCenteredOnce] = useState(false)

	useEffect(() => {
		if (locationEnabled) initLocation()
		else useStore.getState().showToast('Location is turned off')
		getRouteWaypoints(1).then(d => Array.isArray(d?.waypoints) && setWaypoints(d.waypoints.map(w => ({ latitude: Number(w.lat), longitude: Number(w.lng) }))))
	}, [locationEnabled])

	useEffect(() => {
		if (coords && locationEnabled && !centeredOnce) {
			recenter(500)
			setCenteredOnce(true)
		}
	}, [coords, locationEnabled])

	return (
		<View className="flex-1 overflow-hidden">
			<MapView
				ref={ref => useStore.setState({ mapRef: ref })}
				provider={PROVIDER_GOOGLE}
				initialRegion={coords ? {
					latitude: coords.latitude,
					longitude: coords.longitude,
					latitudeDelta: 0.1,
					longitudeDelta: 0.1
				} : undefined}
				style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: -60 }}
				showsUserLocation={showRadar && locationEnabled}
				showsMyLocationButton={false}
				showsCompass={false}
				toolbarEnabled={false}
				onMapReady={() => coords && recenter(500)}
			>
				{showRadar && waypoints.length > 0 && (
					<Polyline
						coordinates={waypoints}
						strokeColor="#2563eb"
						strokeWidth={4}
					/>
				)}

				{showRadar && isRadarActive && coords && locationEnabled && (
					<Circle
						center={coords}
						radius={2000}
						fillColor="rgba(37, 99, 235, 0.08)"
						strokeColor="rgba(37, 99, 235, 0.35)"
						strokeWidth={1.5}
					/>
				)}

				{showRadar && isRadarActive && locationEnabled && (vehicles || []).map((v, i) => (
					<VehicleMarker key={v.vehicle_id} vehicle={v} isNearest={i === 0} />
				))}

				{!showRadar && coords && locationEnabled && (
					<Marker coordinate={coords} anchor={{ x: 0.5, y: 0.5 }}>
						<View className="w-8 h-8 rounded-full bg-amber-400 border-2 border-white items-center justify-center shadow-md">
							<MaterialIcons name="drive-eta" size={18} color="#0f172a" />
						</View>
					</Marker>
				)}
			</MapView>

			{toast && (
				<View pointerEvents="none" style={{ bottom: insets.bottom + 96 }} className="absolute self-center px-4 py-2 rounded-2xl bg-slate-900/95 shadow-xl border border-slate-700 items-center z-50">
					<Text className="text-white text-xs font-black tracking-wide">{toast}</Text>
				</View>
			)}
			<View style={{ bottom: insets.bottom + 80 }} className="absolute right-4 gap-3 z-30">
				{action}
				<IconButton name={showRadar ? 'explore' : 'my-location'} size={32} color={showRadar ? '#dc2626' : '#059669'} onPress={() => recenter(500)} />
			</View>
		</View>
	)
}
