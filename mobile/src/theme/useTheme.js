import { useColorScheme } from 'react-native'
import { usePrefs } from '@/services/prefs'
import { day, night } from './tokens'
import { themeVars } from './vars'

/**
 * The active theme. 'system' follows the device — the design's default, since
 * dark UI is less legible in noon sun but right for night driving — and the
 * Settings row can pin it either way.
 *
 * Returns both the raw token object (for icon colours, map styles, anything
 * outside className) and the CSS-variable style the root view applies.
 */
export const useTheme = () => {
	const pref = usePrefs(s => s.themePref)
	const system = useColorScheme()

	const scheme = pref === 'system' ? (system ?? 'light') : pref
	const dark = scheme === 'dark'

	return {
		theme: dark ? night : day,
		dark,
		scheme,
		vars: dark ? themeVars.dark : themeVars.light,
		/** For expo-status-bar: glyph colour is the OPPOSITE of the background. */
		statusBar: dark ? 'light' : 'dark'
	}
}
