import * as tl from './copy.tl'
import * as en from './copy.en'
import { usePrefs } from '@/services/prefs'

/**
 * Language hub. Screens call `useCopy()` and re-render the moment the Settings
 * language row flips; non-React code (store actions) calls `getCopy()` at the
 * time of use, which reads whatever is current.
 *
 * Whole modules are swapped rather than individual strings, so a key missing
 * from one language is a loud `undefined` in review instead of a silent
 * fallback that hides the gap.
 */
const COPIES = { tl, en }

export const useCopy = () => COPIES[usePrefs(s => s.lang)] ?? tl

export const getCopy = () => COPIES[usePrefs.getState().lang] ?? tl

export const LANGS = ['tl', 'en']
