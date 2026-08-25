import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { WebView } from 'react-native-webview'
import * as Location from 'expo-location'
import { StatusBar } from 'expo-status-bar'

const BACKEND_URL = 'https://biyahero-foaq.onrender.com'
const RADAR_PARAMS = {
	radius_km: 2.0,
	vehicle_type: 'jeepney',
	route_id: 1,
}

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
    .eta-label {
      background: #1e40af;
      color: white;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: bold;
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const map = L.map('map', { zoomControl: true }).setView([${lat}, ${lng}], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Commuter marker (blue dot — "you")
    const commuterIcon = L.divIcon({
      html: '<div style="background:#2563eb;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 6px rgba(0,0,0,0.4)"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      className: '',
    });

    const commuterMarker = L.marker([${lat}, ${lng}], { icon: commuterIcon })
      .addTo(map)
      .bindPopup('📍 You (Commuter)')
      .openPopup();

    // Vehicle markers — keyed by vehicle_id
    const vehicleMarkers = {};

    function makeVehicleIcon(etaMinutes) {
      return L.divIcon({
        html: '<div style="background:#dc2626;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 0 6px rgba(0,0,0,0.4)"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        className: '',
      });
    }

    window.addEventListener('message', function(e) {
      try {
        const data = JSON.parse(e.data);

        if (data.type === 'UPDATE_COMMUTER') {
          commuterMarker.setLatLng([data.lat, data.lng]);
          map.panTo([data.lat, data.lng]);
        }

        if (data.type === 'UPDATE_VEHICLES') {
          const incoming = data.vehicles;
          const incomingIds = incoming.map(v => v.vehicle_id);

          // Remove markers for vehicles no longer nearby
          Object.keys(vehicleMarkers).forEach(id => {
            if (!incomingIds.includes(id)) {
              map.removeLayer(vehicleMarkers[id]);
              delete vehicleMarkers[id];
            }
          });

          // Add or update markers for nearby vehicles
          incoming.forEach(vehicle => {
            if (!vehicle.position) return;
            const { lat, lng } = vehicle.position;
            const eta = vehicle.predicted_eta_minutes;
            const label = eta != null ? eta.toFixed(1) + ' min' : vehicle.vehicle_id;

            if (vehicleMarkers[vehicle.vehicle_id]) {
              vehicleMarkers[vehicle.vehicle_id].setLatLng([lat, lng]);
              vehicleMarkers[vehicle.vehicle_id].setPopupContent(
                '🚌 ' + vehicle.vehicle_id + '<br>ETA: ' + label + '<br>' + vehicle.distance_km + ' km away'
              );
            } else {
              const marker = L.marker([lat, lng], { icon: makeVehicleIcon(eta) })
                .addTo(map)
                .bindPopup('🚌 ' + vehicle.vehicle_id + '<br>ETA: ' + label + '<br>' + vehicle.distance_km + ' km away');
              vehicleMarkers[vehicle.vehicle_id] = marker;
            }
          });
        }
      } catch(err) {}
    });

    document.addEventListener('message', function(e) {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'UPDATE_COMMUTER') {
          commuterMarker.setLatLng([data.lat, data.lng]);
          map.panTo([data.lat, data.lng]);
        }
        if (data.type === 'UPDATE_VEHICLES') {
          const incoming = data.vehicles;
          const incomingIds = incoming.map(v => v.vehicle_id);
          Object.keys(vehicleMarkers).forEach(id => {
            if (!incomingIds.includes(id)) {
              map.removeLayer(vehicleMarkers[id]);
              delete vehicleMarkers[id];
            }
          });
          incoming.forEach(vehicle => {
            if (!vehicle.position) return;
            const { lat, lng } = vehicle.position;
            const eta = vehicle.predicted_eta_minutes;
            const label = eta != null ? eta.toFixed(1) + ' min' : vehicle.vehicle_id;
            if (vehicleMarkers[vehicle.vehicle_id]) {
              vehicleMarkers[vehicle.vehicle_id].setLatLng([lat, lng]);
            } else {
              const marker = L.marker([lat, lng], { icon: makeVehicleIcon(eta) })
                .addTo(map)
                .bindPopup('🚌 ' + vehicle.vehicle_id + '<br>ETA: ' + label + '<br>' + vehicle.distance_km + ' km away');
              vehicleMarkers[vehicle.vehicle_id] = marker;
            }
          });
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
	const [nearbyCount, setNearbyCount] = useState(0)
	const [error, setError] = useState(null)
	const [mapReady, setMapReady] = useState(false)
	const [mapHTML, setMapHTML] = useState(null)  // built once, never changes
	const subscriptionRef = useRef(null)
	const intervalRef = useRef(null)
	const webViewRef = useRef(null)
	const currentCoordsRef = useRef(null)

	useEffect(() => {
		let active = true

		const startTracking = async () => {
			const { status: permStatus } = await Location.requestForegroundPermissionsAsync()

			if (permStatus !== 'granted') {
				setStatus('Location permission denied')
				return
			}

			setStatus('Scanning for nearby jeepneys…')

			// Watch GPS position — update commuter marker in real time
			subscriptionRef.current = await Location.watchPositionAsync(
				{
					accuracy: Location.Accuracy.High,
					timeInterval: 2000,
					distanceInterval: 2,
				},
				(location) => {
					if (!active) return
					const { latitude, longitude } = location.coords
					currentCoordsRef.current = { lat: latitude, lng: longitude }

					// Only set lastPos once — to build the HTML with initial coords
					// After that, all updates go through postMessage only
					setLastPos(prev => {
						if (!prev) {
							// First fix — build the map HTML once
							setMapHTML(buildMapHTML(latitude, longitude))
						}
						return { lat: latitude, lng: longitude }
					})

					webViewRef.current?.postMessage(
						JSON.stringify({ type: 'UPDATE_COMMUTER', lat: latitude, lng: longitude })
					)
				}
			)

			// Poll radar every 5 seconds using latest cached coords
			intervalRef.current = setInterval(async () => {
				if (!active || !currentCoordsRef.current) return

				const { lat, lng } = currentCoordsRef.current
				const now = new Date()

				try {
					const res = await fetch(`${BACKEND_URL}/api/commuter-radar`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							lat,
							lng,
							...RADAR_PARAMS,
							hour_of_day: now.getHours(),
							day_of_week: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()],
						}),
					})

					const data = await res.json()
					const vehicles = data.nearby_vehicles ?? []
					setNearbyCount(vehicles.length)
					setError(null)

					if (vehicles.length > 0) {
						setStatus(`${vehicles.length} jeepney${vehicles.length > 1 ? 's' : ''} nearby`)
					} else {
						setStatus('Scanning for nearby jeepneys…')
					}

					webViewRef.current?.postMessage(
						JSON.stringify({ type: 'UPDATE_VEHICLES', vehicles })
					)
				} catch (err) {
					setError(err.message)
				}
			}, 5000)
		}

		startTracking()

		return () => {
			active = false
			subscriptionRef.current?.remove()
			clearInterval(intervalRef.current)
		}
	}, [])

	return (
		<View className="flex-1 bg-sky-50">
			<View className="p-4 pt-12">
				<Text className="text-2xl font-bold text-blue-800 text-center">📍 Commuter</Text>
				<Text className="text-sm text-green-600 text-center">{status}</Text>
				{lastPos && (
					<Text className="text-xs text-slate-400 text-center mt-1">
						{lastPos.lat.toFixed(6)}, {lastPos.lng.toFixed(6)}
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

			{nearbyCount > 0 && (
				<View className="bg-blue-600 p-3 absolute bottom-4 left-4 right-4 rounded-xl">
					<Text className="text-sm text-white text-center font-semibold">
						🚌 {nearbyCount} jeepney{nearbyCount > 1 ? 's' : ''} detected nearby — tap a marker for ETA
					</Text>
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
