import { useCallback, useState } from 'react'
import { View, FlatList, ActivityIndicator } from 'react-native'
import { Redirect, useFocusEffect } from 'expo-router'
import { Screen } from '@/components/ui/Screen'
import { Txt } from '@/components/ui/Txt'
import { Header } from '@/components/ui/Header'
import { EmptyState } from '@/components/EmptyState'
import { useStore } from '@/services/store'
import { useTheme } from '@/theme/useTheme'
import { fetchTripHistory } from '@/services/api'
import { useCopy } from '@/constants/copy'

const two = n => String(n).padStart(2, '0')

/**
 * Kasaysayan ng biyahe — the driver's completed runs, straight from the trips
 * table. These are the same rows the profile counters are derived from, so the
 * list and the totals can never disagree.
 */
export default function TripHistory() {
	const copy = useCopy()
	const { theme } = useTheme()
	const driver = useStore(s => s.driver)

	const [rows, setRows] = useState(null)

	useFocusEffect(
		useCallback(() => {
			let cancelled = false
			fetchTripHistory()
				.then(data => !cancelled && setRows(data))
				.catch(() => !cancelled && setRows([]))
			return () => {
				cancelled = true
			}
		}, [])
	)

	if (!driver) return <Redirect href="/driver/vehicle" />

	const formatDate = iso => {
		const d = new Date(iso)
		return `${d.getDate()} ${copy.history.months[d.getMonth()]} ${d.getFullYear()} · ${two(d.getHours())}:${two(d.getMinutes())}`
	}

	return (
		<Screen>
			<Header title={copy.history.title} className="pt-4" />

			{rows === null ? (
				<View className="flex-1 items-center justify-center">
					<ActivityIndicator color={theme.brand.hover} />
				</View>
			) : rows.length === 0 ? (
				<View className="flex-1 justify-center">
					<EmptyState icon="route" title={copy.history.empty} body={copy.history.emptyBody} />
				</View>
			) : (
				<FlatList
					data={rows}
					keyExtractor={item => String(item.id)}
					showsVerticalScrollIndicator={false}
					contentContainerClassName="gap-3 pb-8 pt-6"
					renderItem={({ item }) => (
						<View className="flex-row items-center gap-3 rounded-lg border-[1.5px] border-line-subtle bg-surface p-4">
							<View className="min-w-0 flex-1 gap-[2px]">
								<Txt variant="headingS" numberOfLines={1}>{item.destination}</Txt>
								<Txt variant="caption" className="text-fg-secondary">{formatDate(item.started_at)}</Txt>
							</View>
							<Txt variant="monoData" className="text-fg-secondary">
								{copy.history.meta(item.duration_min, item.distance_km)}
							</Txt>
						</View>
					)}
				/>
			)}
		</Screen>
	)
}
