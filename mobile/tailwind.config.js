const { day, radius, fonts } = require('./src/theme/tokens')

/**
 * Semantic-only palette. Screens name the ROLE a colour plays (`bg-surface`,
 * `text-fg-secondary`, `border-line`), never the hue — so the whole app can be
 * re-themed from src/theme/tokens.js without touching a screen.
 */
module.exports = {
	content: ['./src/**/*.{js,jsx}'],
	presets: [require('nativewind/preset')],
	theme: {
		extend: {
			colors: {
				surface: {
					DEFAULT: day.surface.default,
					canvas: day.surface.canvas,
					raised: day.surface.raised,
					sunken: day.surface.sunken,
					inverse: day.surface.inverse
				},
				fg: {
					DEFAULT: day.text.primary,
					secondary: day.text.secondary,
					inverse: day.text.inverse,
					'on-brand': day.text.onBrand,
					danger: day.text.danger,
					success: day.text.success
				},
				brand: {
					DEFAULT: day.brand.default,
					hover: day.brand.hover,
					subtle: day.brand.subtle
				},
				line: {
					DEFAULT: day.border.default,
					subtle: day.border.subtle,
					strong: day.border.strong,
					focus: day.border.focus
				},
				icon: {
					DEFAULT: day.icon.primary,
					secondary: day.icon.secondary,
					muted: day.icon.muted
				},
				danger: day.action.dangerBg,
				capacity: {
					'open-fg': day.capacity.open.fg,
					'open-bg': day.capacity.open.bg,
					'filling-fg': day.capacity.filling.fg,
					'filling-bg': day.capacity.filling.bg,
					'full-fg': day.capacity.full.fg,
					'full-bg': day.capacity.full.bg,
					'stale-fg': day.capacity.stale.fg,
					'stale-bg': day.capacity.stale.bg
				},
				route: day.route,
				map: {
					base: day.map.base,
					block: day.map.block,
					road: day.map.road,
					'road-major': day.map.roadMajor,
					water: day.map.water,
					park: day.map.park
				}
			},
			// Spacing is deliberately NOT overridden. Tailwind's default 4px scale
			// already contains every value in the Figma `space` collection
			// (4/8/12/16/20/24/32/40/48/64 = 1/2/3/4/5/6/8/10/12/16), and remapping
			// the keys silently resized anything sized against the default scale.
			// Import `space` from theme/tokens.js when a raw number is needed.
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
