import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import * as Location from 'expo-location'
import { StatusBar } from 'expo-status-bar'

const BACKEND_URL = 'https://biyahero-foaq.onrender.com'
const VEHICLE_ID = 1

export default () => {
	const [status, setStatus] = useState('Requesting permission…')
	const [lastPos, setLastPos] = useState(null)
	const [updateCount, setUpdateCount] = useState(0)
	const [error, setError] = useState(null)
	const subscriptionRef = useRef(null)

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
					timeInterval: 3000,
					distanceInterval: 3,
				},
				async (location) => {
					if (!active) return

					const { latitude, longitude } = location.coords
					setLastPos({ lat: latitude, lng: longitude })

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
		<View className="flex-1 items-center justify-center bg-sky-50 p-6">
			<Text className="text-3xl font-bold text-blue-800 mb-2">🚌 Driver Node</Text>
			<Text className="text-sm text-slate-400 mb-5">Vehicle ID: {VEHICLE_ID}</Text>

			<View className="bg-white rounded-xl p-4 w-full mb-3 shadow-sm">
				<Text className="text-base text-green-600 text-center">{status}</Text>
			</View>

			{lastPos && (
				<View className="bg-white rounded-xl p-4 w-full mb-3 shadow-sm">
					<Text className="text-xs text-slate-400 mb-1.5 text-center">Last sent position</Text>
					<Text className="text-lg font-semibold text-slate-900 text-center">Lat: {lastPos.lat.toFixed(6)}</Text>
					<Text className="text-lg font-semibold text-slate-900 text-center">Lng: {lastPos.lng.toFixed(6)}</Text>
					<Text className="text-xs text-slate-400 mt-2 text-center">Updates sent: {updateCount}</Text>
				</View>
			)}

			{!lastPos && status === 'Tracking active — sending GPS to server…' && (
				<ActivityIndicator className="mt-5" size="large" color="#2563eb" />
			)}

			{error && (
				<View className="bg-red-50 rounded-xl p-3 w-full">
					<Text className="text-sm text-red-600 text-center">⚠ {error}</Text>
				</View>
			)}

			<StatusBar style="auto" />
		</View>
	)
}
