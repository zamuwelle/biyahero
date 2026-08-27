import { useEffect, useState } from 'react'
import { View, ScrollView, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import { Screen } from '@/components/ui/Screen'
import { Txt } from '@/components/ui/Txt'
import { SearchBar } from '@/components/SearchBar'
import { EmptyState } from '@/components/EmptyState'
import { useStore } from '@/services/store'
import { fetchDestinations } from '@/services/api'
import { useTheme } from '@/theme/useTheme'
import { useCopy } from '@/constants/copy'

const PlaceRow = ({ icon, tint, name, subtitle, onPress }) => {
	const { theme } = useTheme()

	return (
	<Pressable
		onPress={onPress}
		accessibilityRole="button"
		className="flex-row items-center gap-[14px] py-3 active:opacity-70"
	>
		<View
			className="h-10 w-10 items-center justify-center rounded-full"
			style={{ backgroundColor: tint }}
		>
			<MaterialIcons name={icon} size={20} color={icon === 'place' ? theme.brand.hover : theme.icon.secondary} />
		</View>
		<View className="min-w-0 flex-1">
			<Txt variant="headingS">{name}</Txt>
			{!!subtitle && <Txt variant="caption" className="text-fg-secondary">{subtitle}</Txt>}
		</View>
	</Pressable>
	)
}

/**
 * 06 · Destination Search. Recent searches are device-only — they are read from
 * AsyncStorage and never sent anywhere, which is what the footnote promises.
 */
export default function DestinationSearch() {
	const copy = useCopy()
	const { theme } = useTheme()
	const router = useRouter()
	const [query, setQuery] = useState('')
	const [results, setResults] = useState([])
	const [loading, setLoading] = useState(true)

	const recentSearches = useStore(s => s.recentSearches)
	const setDestination = useStore(s => s.setDestination)

	useEffect(() => {
		let cancelled = false
		setLoading(true)

		// Debounced so a fast typist does not fire a request per keystroke.
		const timer = setTimeout(() => {
			fetchDestinations(query.trim() || undefined)
				.then(data => !cancelled && setResults(data))
				.catch(() => !cancelled && setResults([]))
				.finally(() => !cancelled && setLoading(false))
		}, 220)

		return () => {
			cancelled = true
			clearTimeout(timer)
		}
	}, [query])

	const choose = async place => {
		await setDestination({ name: place.name, subtitle: place.subtitle, lat: place.lat, lng: place.lng })
		router.back()
	}

	const searching = query.trim().length > 0

	return (
		<Screen>
			<View className="flex-row items-center gap-2 pb-4 pt-2">
				<Pressable
					onPress={() => router.back()}
					hitSlop={10}
					accessibilityRole="button"
					accessibilityLabel={copy.common.back}
					className="p-1"
				>
					<MaterialIcons name="arrow-back-ios-new" size={20} color={theme.icon.primary} />
				</Pressable>
				<View className="flex-1">
					<SearchBar value={query} onChangeText={setQuery} onClear={() => setQuery('')} autoFocus />
				</View>
			</View>

			<ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-8 gap-6" keyboardShouldPersistTaps="handled">
				{!searching && recentSearches.length > 0 && (
					<View>
						<Txt variant="labelS" className="mb-1 text-fg-secondary">{copy.search.recent}</Txt>
						{recentSearches.map(place => (
							<PlaceRow
								key={`recent-${place.name}`}
								icon="schedule"
								tint={theme.surface.sunken}
								name={place.name}
								subtitle={place.subtitle}
								onPress={() => choose(place)}
							/>
						))}
					</View>
				)}

				<View>
					<Txt variant="labelS" className="mb-1 text-fg-secondary">
						{searching ? copy.search.resultsTitle(results.length, query.trim()) : copy.search.popular}
					</Txt>

					{results.map(place => (
						<PlaceRow
							key={place.id}
							icon="place"
							tint={theme.brand.subtle}
							name={place.name}
							subtitle={copy.search.activeCount(place.active_count)}
							onPress={() => choose(place)}
						/>
					))}

					{!loading && results.length === 0 && (
						<EmptyState title={copy.search.emptyTitle(query.trim())} body={copy.search.emptyBody} />
					)}
				</View>

				<View className="flex-row items-start gap-3 rounded-lg bg-surface-sunken p-4">
					<MaterialIcons name="lock" size={18} color={theme.icon.secondary} />
					<Txt variant="caption" className="min-w-0 flex-1 text-fg-secondary">{copy.search.privacy}</Txt>
				</View>
			</ScrollView>
		</Screen>
	)
}
