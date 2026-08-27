/**
 * Biyahero — design tokens.
 * Mirrors the `Color` and `Scale` variable collections in the Figma file
 * "Biyahero — Design System & Screens". Verified against get_variable_defs.
 *
 * Day is the shipping theme: dark UI is less legible in direct noon sunlight,
 * which is exactly when people commute. `night` is defined so the palette stays
 * complete, but only `day` is wired into tailwind.config.js.
 */

export const primitives = {
	ink: {
		950: '#070C15', 900: '#0B1220', 850: '#101827', 800: '#141C2E',
		700: '#1E293B', 600: '#263449', 500: '#3A4A63', 400: '#64748B',
		300: '#94A3B8', 200: '#CBD5E1', 100: '#E2E8F0', 50: '#F1F5F9', 0: '#FFFFFF'
	},
	/** Signal Yellow — the language of PH jeepney route boards and transit signage. */
	signal: { 700: '#B88A00', 600: '#E0A800', 500: '#FFC72C', 400: '#FFD75E', 300: '#FFE494', 100: '#FFF6DC' },
	green: { 900: '#052E16', 600: '#15803D', 500: '#22C55E', 400: '#4ADE80', 100: '#DCFCE7' },
	amber: { 900: '#451A03', 600: '#D97706', 500: '#F59E0B', 400: '#FBBF24', 100: '#FEF3C7' },
	red: { 900: '#450A0A', 600: '#DC2626', 500: '#EF4444', 400: '#F87171', 100: '#FEE2E2' },
	route: { 1: '#38BDF8', 2: '#A78BFA', 3: '#FB7185', 4: '#84CC16', 5: '#FB923C', 6: '#F472B6' },
	water: { night: '#0A2033', day: '#DCEAF7' },
	park: { night: '#0F2A1C', day: '#DCF0E1' }
}

const p = primitives

export const day = {
	surface: { canvas: p.ink[50], default: p.ink[0], raised: p.ink[0], sunken: p.ink[100], inverse: p.ink[900], scrim: p.ink[900] },
	text: { primary: p.ink[900], secondary: p.ink[500], inverse: p.ink[0], onBrand: p.ink[950], danger: p.red[600], success: p.green[600] },
	brand: { default: p.signal[500], hover: p.signal[600], subtle: p.signal[100] },
	border: { subtle: p.ink[100], default: p.ink[200], strong: p.ink[400], focus: p.signal[600] },
	icon: { primary: p.ink[900], secondary: p.ink[500], muted: p.ink[400] },
	capacity: {
		open: { fg: p.green[600], bg: p.green[100] },
		filling: { fg: p.amber[600], bg: p.amber[100] },
		full: { fg: p.red[600], bg: p.red[100] },
		stale: { fg: p.ink[500], bg: p.ink[100] }
	},
	action: { dangerBg: p.red[600], dangerFg: p.ink[0] },
	map: { base: p.ink[100], block: p.ink[50], road: p.ink[0], roadMajor: p.signal[100], water: p.water.day, park: p.park.day },
	route: p.route
}

export const night = {
	surface: { canvas: p.ink[900], default: p.ink[800], raised: p.ink[700], sunken: p.ink[950], inverse: p.ink[0], scrim: p.ink[950] },
	// Deliberately only TWO text tiers. A third grey fails 4.5:1 on dark surfaces —
	// muted greys live in `icon` and `border`, where the 3:1 UI threshold applies.
	text: { primary: p.ink[0], secondary: p.ink[300], inverse: p.ink[900], onBrand: p.ink[950], danger: p.red[400], success: p.green[400] },
	brand: { default: p.signal[500], hover: p.signal[400], subtle: p.signal[700] },
	border: { subtle: p.ink[600], default: p.ink[500], strong: p.ink[400], focus: p.signal[500] },
	icon: { primary: p.ink[0], secondary: p.ink[300], muted: p.ink[400] },
	capacity: {
		open: { fg: p.green[400], bg: p.green[900] },
		filling: { fg: p.amber[400], bg: p.amber[900] },
		full: { fg: p.red[400], bg: p.red[900] },
		stale: { fg: p.ink[300], bg: p.ink[600] }
	},
	action: { dangerBg: p.red[500], dangerFg: p.ink[0] },
	map: { base: p.ink[850], block: p.ink[800], road: p.ink[700], roadMajor: p.ink[600], water: p.water.night, park: p.park.night },
	route: p.route
}

/** The shipping theme. Imported directly wherever a raw colour value is needed. */
export const theme = day

export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40, 9: 48, 10: 64 }
export const radius = { xs: 6, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 28, full: 999 }
/** 48, not the 44 iOS minimum — the driver taps this in a moving vehicle. */
export const size = { touchMin: 48, iconSm: 16, iconMd: 20, iconLg: 24, iconXl: 32, pin: 44, avatar: 40, sheetGrabber: 36 }

const PJS = {
	regular: 'PlusJakartaSans_400Regular',
	medium: 'PlusJakartaSans_500Medium',
	semibold: 'PlusJakartaSans_600SemiBold',
	bold: 'PlusJakartaSans_700Bold',
	extrabold: 'PlusJakartaSans_800ExtraBold'
}
const JBM = { medium: 'JetBrainsMono_500Medium', bold: 'JetBrainsMono_700Bold' }

export const fonts = { ...PJS, mono: JBM.medium, monoBold: JBM.bold }

/** Body sits one step larger than typical: outdoor sunlight, one-handed use, older drivers. */
export const type = {
	displayL: { fontFamily: PJS.extrabold, fontSize: 34, lineHeight: 40, letterSpacing: -0.6 },
	displayS: { fontFamily: PJS.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
	headingL: { fontFamily: PJS.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
	headingM: { fontFamily: PJS.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
	headingS: { fontFamily: PJS.semibold, fontSize: 17, lineHeight: 24, letterSpacing: -0.1 },
	bodyL: { fontFamily: PJS.medium, fontSize: 17, lineHeight: 26, letterSpacing: 0 },
	bodyM: { fontFamily: PJS.regular, fontSize: 15, lineHeight: 22, letterSpacing: 0 },
	bodyMStrong: { fontFamily: PJS.semibold, fontSize: 15, lineHeight: 22, letterSpacing: 0 },
	labelL: { fontFamily: PJS.semibold, fontSize: 14, lineHeight: 18, letterSpacing: 0.2 },
	labelS: { fontFamily: PJS.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.6 },
	caption: { fontFamily: PJS.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.1 },
	// Mono for alphanumeric codes: plate numbers scan faster, ETAs align in lists.
	monoPlate: { fontFamily: JBM.bold, fontSize: 20, lineHeight: 24, letterSpacing: 1.0 },
	monoData: { fontFamily: JBM.bold, fontSize: 15, lineHeight: 20, letterSpacing: 0.3 },
	monoCaption: { fontFamily: JBM.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 }
}

export const elevation = {
	/** Elevation/Float — floating map controls and chips. */
	float: { shadowColor: '#000000', shadowOpacity: 0.28, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 4 },
	/** Elevation/Sheet — the bottom sheet, casting upward. */
	sheet: { shadowColor: '#000000', shadowOpacity: 0.4, shadowOffset: { width: 0, height: -4 }, shadowRadius: 24, elevation: 16 }
}

/** A ping older than this renders the vehicle as Stale — dashed pin + "last seen" label. */
export const STALE_AFTER_MS = 120_000
/** Commuter destination matches any trip polyline passing within this radius. */
export const ROUTE_MATCH_RADIUS_M = 400
/** Driver location broadcast interval — throttled for data and battery. */
export const PING_INTERVAL_MS = 8_000

/**
 * The four PH public-utility vehicle classes the app covers.
 * Tricycle and habal-habal are deliberately out of scope for v1 — they serve an
 * AREA rather than a route, so they need a different trip model entirely.
 */
export const VEHICLE_TYPES = ['jeepney', 'ejeep', 'bus', 'uv_express']

export const VEHICLE_LABELS = {
	jeepney: 'Jeepney',
	ejeep: 'E-Jeep',
	bus: 'Bus',
	uv_express: 'UV Express'
}

/**
 * Where a passenger may actually board. UV Express loads at its terminal and will
 * not stop mid-route, so showing it as "nearby" the way a jeepney is shown would
 * promise a ride that never stops.
 */
export const BOARDING_RULE = {
	jeepney: 'anywhere',
	ejeep: 'stops',
	bus: 'stops',
	uv_express: 'terminal'
}
