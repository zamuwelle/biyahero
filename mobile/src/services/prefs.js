import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'biyahero.prefs'

/**
 * Device-local preferences: language and theme.
 *
 * Lives apart from the main store to avoid an import cycle — copy.js needs the
 * current language, and the main store needs copy for its toasts.
 */
export const usePrefs = create((set, get) => ({
	/** 'tl' | 'en' — Filipino ships as the default. */
	lang: 'tl',
	/** 'system' | 'light' | 'dark' — the design follows the device by default. */
	themePref: 'system',
	hydrated: false,

	hydrate: async () => {
		try {
			const raw = await AsyncStorage.getItem(KEY)
			if (raw) {
				const saved = JSON.parse(raw)
				set({
					lang: saved.lang === 'en' ? 'en' : 'tl',
					themePref: ['light', 'dark'].includes(saved.themePref) ? saved.themePref : 'system'
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
	}
}))

const persist = get => {
	const { lang, themePref } = get()
	AsyncStorage.setItem(KEY, JSON.stringify({ lang, themePref })).catch(() => {})
}
