import { vars } from 'nativewind'
import { day, night, semanticColors } from './tokens'

/**
 * Per-theme CSS variable values, applied as a style on the root view.
 * tailwind.config.js references the same keys as `rgb(var(--biya-k) / alpha)`,
 * so flipping this one style object re-colours every semantic class at once.
 *
 * Values are "R G B" triplets rather than hex, so alpha modifiers like
 * `bg-surface-inverse/70` keep working.
 */
const triplet = hex => {
	const n = parseInt(hex.slice(1), 16)
	return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

const build = t =>
	vars(Object.fromEntries(Object.entries(semanticColors(t)).map(([k, v]) => [`--biya-${k}`, triplet(v)])))

export const themeVars = {
	light: build(day),
	dark: build(night)
}
