import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'biyahero.prefs'

/** The map looks a commuter can choose between. */
export const MAP_TYPES = ['standard', 'hybrid', 'terrain']

/**
 * Device-local preferences: language, theme and map look.
 *
 * Lives apart from the main store to avoid an import cycle — copy.js needs the
 * current language, and the main store needs copy for its toasts.
 */
export const usePrefs = create((set, get) => ({
	/** 'tl' | 'en' — Filipino ships as the default. */
	lang: 'tl',
	/** 'system' | 'light' | 'dark' — the design follows the device by default. */
	themePref: 'system',
	/**
	 * 'standard' | 'hybrid' | 'terrain'. Hybrid is satellite WITH labels —
	 * imagery alone hides the street names people navigate by.
	 */
	mapType: 'standard',
	hydrated: false,

	hydrate: async () => {
		try {
			const raw = await AsyncStorage.getItem(KEY)
			if (raw) {
				const saved = JSON.parse(raw)
				set({
					lang: saved.lang === 'en' ? 'en' : 'tl',
					themePref: ['light', 'dark'].includes(saved.themePref) ? saved.themePref : 'system',
					mapType: MAP_TYPES.includes(saved.mapType) ? saved.mapType : 'standard'
				})
			}
		} catch {
			// Defaults already stand.
		} finally {
			set({ hydrated: true })
		}
	},

	setLang: lang => {
		set({ lang })
		persist(get)
	},

	setThemePref: themePref => {
		set({ themePref })
		persist(get)
	},

	setMapType: mapType => {
		set({ mapType })
		persist(get)
	}
}))

const persist = get => {
	const { lang, themePref, mapType } = get()
	AsyncStorage.setItem(KEY, JSON.stringify({ lang, themePref, mapType })).catch(() => {})
}
