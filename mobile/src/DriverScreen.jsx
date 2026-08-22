import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import * as Location from 'expo-location'

// Change this to your laptop's local IP and the vehicle ID you want to drive
const BACKEND_URL = 'http://10.123.53.108:8001'
const VEHICLE_ID = 1

export default function DriverScreen() {
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
                    timeInterval: 3000,   // send every 3 seconds
                    distanceInterval: 3,  // or every 3 meters moved
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
        <View style={styles.container}>
            <Text style={styles.title}>🚌 Driver Node</Text>
            <Text style={styles.label}>Vehicle ID: {VEHICLE_ID}</Text>

            <View style={styles.card}>
                <Text style={styles.statusText}>{status}</Text>
            </View>

            {lastPos && (
                <View style={styles.card}>
                    <Text style={styles.coordLabel}>Last sent position</Text>
                    <Text style={styles.coord}>Lat: {lastPos.lat.toFixed(6)}</Text>
                    <Text style={styles.coord}>Lng: {lastPos.lng.toFixed(6)}</Text>
                    <Text style={styles.updates}>Updates sent: {updateCount}</Text>
                </View>
            )}

            {!lastPos && status === 'Tracking active — sending GPS to server…' && (
                <ActivityIndicator style={{ marginTop: 20 }} size="large" color="#2563eb" />
            )}

            {error && (
                <View style={styles.errorCard}>
                    <Text style={styles.errorText}>⚠ {error}</Text>
                </View>
            )}
        </View>
    )
}

const styles = {
    container: {
        flex: 1,
        backgroundColor: '#f0f9ff',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1e40af',
        marginBottom: 8,
    },
    label: {
        fontSize: 14,
        color: '#64748b',
        marginBottom: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        width: '100%',
        marginBottom: 12,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    statusText: {
        fontSize: 15,
        color: '#16a34a',
        textAlign: 'center',
    },
    coordLabel: {
        fontSize: 12,
        color: '#94a3b8',
        marginBottom: 6,
        textAlign: 'center',
    },
    coord: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
        textAlign: 'center',
    },
    updates: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 8,
        textAlign: 'center',
    },
    errorCard: {
        backgroundColor: '#fef2f2',
        borderRadius: 12,
        padding: 12,
        width: '100%',
    },
    errorText: {
        color: '#dc2626',
        fontSize: 13,
        textAlign: 'center',
    },
}
