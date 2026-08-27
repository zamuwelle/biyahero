import { useEffect, useState } from 'react'
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '@/components/ui/Screen'
import { Txt } from '@/components/ui/Txt'
import { Header } from '@/components/ui/Header'
import { Chip } from '@/components/ui/Chip'
import { Button } from '@/components/ui/Button'
import { SearchBar } from '@/components/SearchBar'
import { RoutePreview } from '@/components/RoutePreview'
import { useStore } from '@/services/store'
import { fetchRouteForDestination, fetchEta, fetchDestinations } from '@/services/api'
import * as copy from '@/constants/copy'

/**
 * 16 · Start Biyahe. The destination declared here is what the commuter search
 * matches against — this is the moment the route becomes a property of the TRIP
 * rather than of the driver.
 */
export default function StartTrip() {
	const router = useRouter()
	const driver = useStore(s => s.driver)
	const startTrip = useStore(s => s.startTrip)
	const showToast = useStore(s => s.showToast)

	const [destination, setDestination] = useState('')
	const [frequent, setFrequent] = useState([])
	const [route, setRoute] = useState(null)
	const [eta, setEta] = useState(null)
	const [starting, setStarting] = useState(false)

	useEffect(() => {
		fetchDestinations()
			.then(list => setFrequent(list.slice(0, 4).map(d => d.name)))
			.catch(() => setFrequent([]))
	}, [])

	// Resolve the route and its travel time whenever the destination settles.
	useEffect(() => {
		const name = destination.trim()
		if (!name) {
			setRoute(null)
			setEta(null)
			return
		}

		let cancelled = false
		const timer = setTimeout(async () => {
			const found = await fetchRouteForDestination(name).catch(() => null)
			if (cancelled) return
			setRoute(found)

			if (found) {
				const minutes = await fetchEta({
					routeId: found.id,
					vehicleType: driver?.vehicle?.vehicle_type ?? 'jeepney',
					distanceKm: found.length_km
				})
				if (!cancelled) setEta(minutes)
			}
		}, 300)

		return () => {
			cancelled = true
			clearTimeout(timer)
		}
	}, [destination, driver])

	const begin = async () => {
		const name = destination.trim()
		if (!name) return showToast(copy.startTrip.needDestination)

		setStarting(true)
		try {
			const trip = await startTrip(name, route?.id)
			if (trip) router.replace('/driver/trip')
		} catch {
			showToast(copy.common.genericError)
		} finally {
			setStarting(false)
		}
	}

	return (
		<Screen>
			<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
				<ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-6 pt-4 gap-6 flex-grow" keyboardShouldPersistTaps="handled">
					<Header title={copy.startTrip.title} />

					<Txt variant="bodyM" className="text-fg-secondary">{copy.startTrip.body}</Txt>

					<SearchBar
						value={destination}
						onChangeText={setDestination}
						onClear={() => setDestination('')}
						placeholder={copy.startTrip.destinationPlaceholder}
					/>

					{frequent.length > 0 && (
						<View className="gap-3">
							<Txt variant="labelS" className="text-fg-secondary">{copy.startTrip.frequentLabel}</Txt>
							<View className="flex-row flex-wrap gap-2">
								{frequent.map(name => (
									<Chip
										key={name}
										label={name}
										active={destination.trim().toLowerCase() === name.toLowerCase()}
										onPress={() => setDestination(name)}
									/>
								))}
							</View>
						</View>
					)}

					{!!route && (
						<View className="gap-3">
							<Txt variant="labelS" className="text-fg-secondary">{copy.startTrip.previewLabel}</Txt>
							<RoutePreview waypoints={route.waypoints} />
							<Txt variant="caption" className="text-fg-secondary">
								{eta ? copy.startTrip.preview(route.length_km, eta) : `~${route.length_km} km`}
							</Txt>
						</View>
					)}

					<View className="flex-1" />
					<Button
						label={copy.startTrip.start}
						onPress={begin}
						loading={starting}
						disabled={!destination.trim()}
					/>
				</ScrollView>
			</KeyboardAvoidingView>
		</Screen>
	)
}
