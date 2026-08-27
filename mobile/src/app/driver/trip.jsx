import { useEffect, useState } from 'react'
import { View, Pressable, ScrollView } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { Map } from '@/components/Map'
import { Sheet } from '@/components/ui/Sheet'
import { Txt } from '@/components/ui/Txt'
import { Button } from '@/components/ui/Button'
import { CapacityPicker } from '@/components/CapacityPicker'
import { useStore } from '@/services/store'
import { elevation } from '@/theme/tokens'
import * as copy from '@/constants/copy'

/**
 * 17 · Active Trip. While this screen is open the vehicle is broadcasting and
 * visible to commuters — ending the trip removes it from their map immediately.
 */
export default function ActiveTrip() {
	const router = useRouter()
	const insets = useSafeAreaInsets()

	const driver = useStore(s => s.driver)
	const trip = useStore(s => s.trip)
	const setCapacity = useStore(s => s.setCapacity)
	const endTrip = useStore(s => s.endTrip)

	const [elapsed, setElapsed] = useState(0)

	useEffect(() => {
		if (!trip?.started_at) return

		const tick = () => setElapsed(Math.max(0, Math.round((Date.now() - new Date(trip.started_at).getTime()) / 60000)))
		tick()
		const timer = setInterval(tick, 30_000)

		return () => clearInterval(timer)
	}, [trip?.started_at])

	if (!driver) return <Redirect href="/driver/vehicle" />
	if (!trip) return <Redirect href="/driver" />

	const waypoints = (trip.route?.waypoints ?? []).map(w => ({ latitude: Number(w.lat), longitude: Number(w.lng) }))

	const finish = async () => {
		await endTrip()
		router.replace('/driver')
	}

	return (
		<View className="flex-1 bg-surface-canvas">
			<StatusBar style="dark" />
			<Map vehicles={[]} routeWaypoints={waypoints} fitTo={waypoints} />

			<View
				style={{ top: insets.top + 6, ...elevation.float }}
				className="absolute self-center flex-row items-center gap-2 rounded-full border-[1.5px] border-capacity-open-fg bg-surface px-4 py-2"
			>
				<View className="h-[9px] w-[9px] rounded-full bg-capacity-open-fg" />
				<Txt variant="bodyMStrong" className="text-capacity-open-fg">{copy.activeTrip.liveBanner}</Txt>
			</View>

			<Sheet peekHeight={390}>
				<ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-6 gap-6">
					<View className="flex-row items-start justify-between gap-3 pt-1">
						<View className="min-w-0 flex-1 gap-[2px]">
							<Txt variant="headingL" numberOfLines={1}>{copy.activeTrip.heading(trip.destination)}</Txt>
							<Txt variant="caption" className="text-fg-secondary">
								{copy.activeTrip.elapsed(elapsed, (trip.distance_km ?? 0).toFixed(1))}
							</Txt>
						</View>
						<Pressable
							onPress={() => router.replace('/driver/start')}
							accessibilityRole="button"
							className="rounded-full border-[1.5px] border-line-subtle bg-surface px-4 py-2 active:opacity-80"
						>
							<Txt variant="bodyMStrong" className="text-fg-secondary">{copy.activeTrip.change}</Txt>
						</Pressable>
					</View>

					<View className="gap-3">
						<Txt variant="labelS" className="text-fg-secondary">{copy.activeTrip.capacityPrompt}</Txt>
						<CapacityPicker value={trip.capacity} onChange={setCapacity} />
					</View>

					<View className="gap-3">
						<Button label={copy.activeTrip.end} tone="danger" onPress={finish} />
						<Txt variant="caption" className="text-center text-fg-secondary">{copy.activeTrip.endNote}</Txt>
					</View>
				</ScrollView>
			</Sheet>
		</View>
	)
}
