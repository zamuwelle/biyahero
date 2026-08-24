import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import * as Location from 'expo-location'
import { StatusBar } from 'expo-status-bar'
import MapView, { Marker } from 'react-native-maps'

const BACKEND_URL = 'https://biyahero-foaq.onrender.com'
const VEHICLE_ID = 1

export default () => {
	const [status, setStatus] = useState('Requesting permission…')
	const [lastPos, setLastPos] = useState(null)
	const [updateCount, setUpdateCount] = useState(0)
	const [error, setError] = useState(null)
	const subscriptionRef = useRef(null)
	const mapRef = useRef(null)

	useEffect(() => {
		let active = true

		const startTracking = async () => {
			const { status: permStatus } = await Location.requestForegroundPermissionsAsync()

			if (permStatus !== 'granted') {
				setStatus('Location permission denied')
				return
			}

			setStatus('Tracking active — sending GPS to server…')

			subscriptionRef.current = await Location.watchPositionAsync(
				{
					accuracy: Location.Accuracy.High,
					timeInterval: 1500,
					distanceInterval: 1,
				},
				async (location) => {
					if (!active) return

					const { latitude, longitude } = location.coords
					setLastPos({ lat: latitude, lng: longitude })

					mapRef.current?.animateToRegion(
						{
							latitude,
							longitude,
							latitudeDelta: 0.005,
							longitudeDelta: 0.005,
						},
						800
					)

					try {
						const res = await fetch(
							`${BACKEND_URL}/api/vehicles/${VEHICLE_ID}/update-location`,
							{
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({ lat: latitude, lng: longitude }),
							}
						)

						if (res.ok) {
							setUpdateCount((c) => c + 1)
							setError(null)
						} else {
							setError(`Server returned ${res.status}`)
						}
					} catch (err) {
						setError(err.message)
					}
				}
			)
		}

		startTracking()

		return () => {
			active = false
			subscriptionRef.current?.remove()
		}
	}, [])

	return (
		<View className="flex-1 bg-sky-50">
			<View className="p-4 pt-12">
				<Text className="text-2xl font-bold text-blue-800 text-center">🚌 Driver Node</Text>
				<Text className="text-sm text-slate-400 text-center mb-2">Vehicle ID: {VEHICLE_ID}</Text>
				<Text className="text-sm text-green-600 text-center">{status}</Text>
				{lastPos && (
					<Text className="text-xs text-slate-400 text-center mt-1">Updates sent: {updateCount}</Text>
				)}
			</View>

			{lastPos ? (
				<MapView
					ref={mapRef}
					style={{ flex: 1 }}
					initialRegion={{
						latitude: lastPos.lat,
						longitude: lastPos.lng,
						latitudeDelta: 0.005,
						longitudeDelta: 0.005,
					}}
				>
					<Marker
						coordinate={{ latitude: lastPos.lat, longitude: lastPos.lng }}
						title="You (Driver)"
						description={`JEEP-001 — Updates sent: ${updateCount}`}
						pinColor="green"
					/>
				</MapView>
			) : (
				<View className="flex-1 items-center justify-center">
					<ActivityIndicator size="large" color="#2563eb" />
					<Text className="text-slate-400 mt-3">Waiting for GPS fix…</Text>
				</View>
			)}

			{error && (
				<View className="bg-red-50 p-3 absolute bottom-4 left-4 right-4 rounded-xl">
					<Text className="text-sm text-red-600 text-center">⚠ {error}</Text>
				</View>
			)}

			<StatusBar style="auto" />
		</View>
	)
}