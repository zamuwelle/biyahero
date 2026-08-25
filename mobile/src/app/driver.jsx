import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { WebView } from 'react-native-webview'
import * as Location from 'expo-location'
import { StatusBar } from 'expo-status-bar'

const BACKEND_URL = 'https://biyahero-foaq.onrender.com'
const VEHICLE_ID = 1

// Leaflet map HTML — self-contained, no API key needed
const buildMapHTML = (lat, lng) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const map = L.map('map', { zoomControl: true }).setView([${lat}, ${lng}], 17);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Driver marker (green)
    const driverIcon = L.divIcon({
      html: '<div style="background:#16a34a;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 6px rgba(0,0,0,0.4)"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      className: '',
    });

    const driverMarker = L.marker([${lat}, ${lng}], { icon: driverIcon })
      .addTo(map)
      .bindPopup('🚌 You (Driver) — JEEP-001')
      .openPopup();

    // Listen for position updates from React Native
    window.addEventListener('message', function(e) {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'UPDATE_POSITION') {
          const { lat, lng } = data;
          driverMarker.setLatLng([lat, lng]);
          map.panTo([lat, lng]);
        }
      } catch(err) {}
    });

    // Also handle iOS WebView message format
    document.addEventListener('message', function(e) {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'UPDATE_POSITION') {
          const { lat, lng } = data;
          driverMarker.setLatLng([lat, lng]);
          map.panTo([lat, lng]);
        }
      } catch(err) {}
    });
  </script>
</body>
</html>
`

export default () => {
	const [status, setStatus] = useState('Requesting permission…')
	const [lastPos, setLastPos] = useState(null)
	const [updateCount, setUpdateCount] = useState(0)
	const [error, setError] = useState(null)
	const [mapReady, setMapReady] = useState(false)
	const [mapHTML, setMapHTML] = useState(null)
	const subscriptionRef = useRef(null)
	const webViewRef = useRef(null)

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

					setLastPos(prev => {
						if (!prev) setMapHTML(buildMapHTML(latitude, longitude))
						return { lat: latitude, lng: longitude }
					})

					// Push position update into the WebView map
					if (webViewRef.current) {
						webViewRef.current.postMessage(
							JSON.stringify({ type: 'UPDATE_POSITION', lat: latitude, lng: longitude })
						)
					}

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
					<Text className="text-xs text-slate-400 text-center mt-1">
						{lastPos.lat.toFixed(6)}, {lastPos.lng.toFixed(6)} · Updates sent: {updateCount}
					</Text>
				)}
			</View>

			{lastPos ? (
				<View className="flex-1">
					{!mapReady && (
						<View className="absolute inset-0 items-center justify-center z-10 bg-sky-50">
							<ActivityIndicator size="large" color="#2563eb" />
							<Text className="text-slate-400 mt-3">Loading map…</Text>
						</View>
					)}
					<WebView
						ref={webViewRef}
						style={{ flex: 1 }}
						originWhitelist={['*']}
						source={{ html: mapHTML }}
						onLoad={() => setMapReady(true)}
						javaScriptEnabled
						domStorageEnabled
					/>
				</View>
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
