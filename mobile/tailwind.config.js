const { day, radius, fonts, semanticColors } = require('./src/theme/tokens')

/**
 * Semantic-only palette. Screens name the ROLE a colour plays (`bg-surface`,
 * `text-fg-secondary`, `border-line`), never the hue.
 *
 * Every colour resolves through a CSS variable set on the root view (see
 * src/theme/vars.js), which is what makes dark mode a single style swap.
 * The `rgb(var() / <alpha-value>)` form keeps `/70`-style modifiers working.
 */
const colors = Object.fromEntries(
	Object.keys(semanticColors(day)).map(key => [key, `rgb(var(--biya-${key}) / <alpha-value>)`])
)

module.exports = {
	content: ['./src/**/*.{js,jsx}'],
	presets: [require('nativewind/preset')],
	theme: {
		extend: {
			colors,
			borderRadius: Object.fromEntries(Object.entries(radius).map(([k, v]) => [k, `${v}px`])),
			fontFamily: {
				regular: [fonts.regular],
				medium: [fonts.medium],
				semibold: [fonts.semibold],
				bold: [fonts.bold],
				extrabold: [fonts.extrabold],
				mono: [fonts.mono],
				'mono-bold': [fonts.monoBold]
			}
		}
	},
	plugins: []
}
