import { View, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '@/components/ui/Screen'
import { Txt } from '@/components/ui/Txt'
import { Header } from '@/components/ui/Header'
import { Row } from '@/components/ui/Row'
import { Segmented } from '@/components/ui/Segmented'
import { useStore } from '@/services/store'
import * as copy from '@/constants/copy'

/**
 * 03 · Settings. Reachable from either mode — the role switch is the point of
 * the screen, since a driver is usually a commuter too.
 */
export default function Settings() {
	const router = useRouter()
	const role = useStore(s => s.role)
	const setRole = useStore(s => s.setRole)
	const recentSearches = useStore(s => s.recentSearches)
	const clearSearches = useStore(s => s.clearSearches)

	const switchRole = async next => {
		if (next === role) return
		await setRole(next)
		router.replace(next === 'driver' ? '/driver' : '/commuter')
	}

	return (
		<Screen>
			<ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-8 pt-4 gap-8">
				<Header title={copy.settings.title} />

				<View className="gap-3">
					<Txt variant="labelS" className="text-fg-secondary">{copy.settings.modeLabel}</Txt>
					<Segmented
						value={role ?? 'commuter'}
						onChange={switchRole}
						options={[
							{ value: 'commuter', label: copy.settings.commuter },
							{ value: 'driver', label: copy.settings.driver }
						]}
					/>
				</View>

				<View className="gap-3">
					<Row title={copy.settings.language} subtitle={copy.settings.languageValue} onPress={() => {}} />
					<Row title={copy.settings.theme} subtitle={copy.settings.themeValue} onPress={() => {}} />
					<Row
						title={copy.settings.location}
						subtitle={role === 'driver' ? copy.settings.locationOn : copy.settings.locationOff}
						onPress={() => {}}
					/>
					<Row
						title={copy.settings.clearSearches}
						subtitle={recentSearches.length ? copy.settings.clearSearchesHint : copy.settings.searchesCleared}
						onPress={recentSearches.length ? clearSearches : undefined}
					/>
				</View>

				<Txt variant="caption" className="text-fg-secondary">{copy.settings.privacy}</Txt>
			</ScrollView>
		</Screen>
	)
}
