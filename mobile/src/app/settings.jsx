import { useCallback, useState } from 'react'
import { View, ScrollView, Linking } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import * as Location from 'expo-location'
import { Screen } from '@/components/ui/Screen'
import { Txt } from '@/components/ui/Txt'
import { Header } from '@/components/ui/Header'
import { Row } from '@/components/ui/Row'
import { Segmented } from '@/components/ui/Segmented'
import { useStore } from '@/services/store'
import { usePrefs } from '@/services/prefs'
import { useCopy, LANGS } from '@/constants/copy'

const THEME_CYCLE = ['system', 'light', 'dark']

/**
 * 03 · Settings. Reachable from either mode — the role switch is the point of
 * the screen, since a driver is usually a commuter too.
 *
 * Language and theme apply instantly: copy re-renders through useCopy() and
 * colours through the root vars, so the change is visible before the row is
 * released. The location row reports the REAL permission state and hands off
 * to system settings, because that is where the permission actually lives.
 */
export default function Settings() {
	const copy = useCopy()
	const router = useRouter()

	const role = useStore(s => s.role)
	const setRole = useStore(s => s.setRole)
	const recentSearches = useStore(s => s.recentSearches)
	const clearSearches = useStore(s => s.clearSearches)

	const lang = usePrefs(s => s.lang)
	const setLang = usePrefs(s => s.setLang)
	const themePref = usePrefs(s => s.themePref)
	const setThemePref = usePrefs(s => s.setThemePref)

	const [locationStatus, setLocationStatus] = useState(null)

	// Re-read on every focus: the user may have changed it in system settings.
	useFocusEffect(
		useCallback(() => {
			let cancelled = false
			Location.getForegroundPermissionsAsync()
				.then(({ status }) => !cancelled && setLocationStatus(status))
				.catch(() => !cancelled && setLocationStatus(null))
			return () => {
				cancelled = true
			}
		}, [])
	)

	const switchRole = async next => {
		if (next === role) return
		await setRole(next)
		router.replace(next === 'driver' ? '/driver' : '/commuter')
	}

	const cycleLang = () => {
		const next = LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length]
		setLang(next)
	}

	const cycleTheme = () => {
		const next = THEME_CYCLE[(THEME_CYCLE.indexOf(themePref) + 1) % THEME_CYCLE.length]
		setThemePref(next)
	}

	const locationSubtitle =
		locationStatus === 'granted'
			? copy.settings.locationOn
			: locationStatus === 'denied'
				? copy.settings.locationOff
				: copy.settings.locationNotAsked

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
					<Row
						title={copy.settings.language}
						subtitle={`${copy.settings.languageNames[lang]} · ${copy.settings.tapToChange}`}
						onPress={cycleLang}
					/>
					<Row
						title={copy.settings.theme}
						subtitle={`${copy.settings.themeNames[themePref]} · ${copy.settings.tapToChange}`}
						onPress={cycleTheme}
					/>
					<Row
						title={copy.settings.location}
						subtitle={locationSubtitle}
						onPress={() => Linking.openSettings().catch(() => {})}
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
