import { useEffect, useRef, useState } from 'react'
import { View, Easing } from 'react-native'
import MapView, { Marker, Circle, Polyline, AnimatedRegion, PROVIDER_GOOGLE } from 'react-native-maps'
import { MaterialIcons } from '@expo/vector-icons'
import { useStore } from '../services/store'
import { getRouteWaypoints } from '../services/api'

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

export const Map = ({ showRadar = false }) => {
	const [waypoints, setWaypoints] = useState([])
	const coords = useStore(s => s.coords)
	const isRadarActive = useStore(s => s.isRadarActive)
	const radiusKm = useStore(s => s.radiusKm)
	const vehicles = useStore(s => s.vehicles)
	const setMapRef = useStore(s => s.setMapRef)
	const recenter = useStore(s => s.recenter)

	useEffect(() => {
		getRouteWaypoints(1).then(data => {
			if (data?.waypoints) setWaypoints(data.waypoints.map(w => ({ latitude: w.lat, longitude: w.lng })))
		})
	}, [])

	return (
		<View className="flex-1 overflow-hidden">
			<MapView
				ref={setMapRef}
				provider={PROVIDER_GOOGLE}
				style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: -60 }}
				showsUserLocation
				showsMyLocationButton={false}
				showsCompass={false}
				toolbarEnabled={false}
				onMapReady={() => recenter(600)}
			>
				{waypoints.length > 0 && (
					<Polyline
						coordinates={waypoints}
						strokeColor="#2563eb"
						strokeWidth={4}
					/>
				)}

				{showRadar && isRadarActive && coords && (
					<Circle
						center={coords}
						radius={radiusKm * 1000}
						fillColor="rgba(37, 99, 235, 0.08)"
						strokeColor="rgba(37, 99, 235, 0.35)"
						strokeWidth={1.5}
					/>
				)}

				{showRadar && isRadarActive && (vehicles || []).filter(v => v?.position?.latitude != null).map((v, i) => (
					<VehicleMarker key={v.vehicle_id} vehicle={v} isNearest={i === 0} />
				))}
			</MapView>
		</View>
	)
}
