import { day, night } from './tokens'

/**
 * Google Maps styles matching the Figma Map Canvas: a desaturated street grid
 * with tinted arterials. Colours stay muted so route lines and vehicle pins
 * keep the figure/ground contrast — and the labels a commuter orients by stay
 * on: street names, town names, and barangay names ("nasa Balibago na").
 *
 * What is switched off is Google's OWN places, and that is the whole point.
 * The Android SDK applies a custom style to the plain map type only, so every
 * POI Google draws appears on standard and on neither of the other two — the
 * exact split people noticed. Biyahero draws its own places instead (PlacePin
 * in Map.jsx), identical on all three layers because we put them there.
 * Leaving both on labelled the same simbahan twice on standard and once
 * nowhere else.
 *
 * `googlePlaces` flips that back on for maps with no place layer of their own.
 */
const build = (t, googlePlaces) => [
	{ elementType: 'geometry', stylers: [{ color: t.map.block }] },
	{ elementType: 'labels.text.fill', stylers: [{ color: t.text.secondary }] },
	{ elementType: 'labels.text.stroke', stylers: [{ color: t.surface.default }] },

	// Boundary lines off, place NAMES on. Barangay names ride on
	// administrative.neighborhood and are how people here actually say where
	// they are, so they are pinned on explicitly rather than left to Google's
	// default zoom heuristics.
	{ featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
	{ featureType: 'administrative', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
	{ featureType: 'administrative.locality', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
	{ featureType: 'administrative.neighborhood', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
	{ featureType: 'administrative.land_parcel', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },

	// One place layer, not two. `labels` covers name and icon together —
	// turning off half of it leaves a nameless glyph, or a loose word sitting
	// beside our pin that belongs to the shop next door.
	{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: googlePlaces ? 'on' : 'off' }] },
	{ featureType: 'transit.station', elementType: 'labels', stylers: [{ visibility: googlePlaces ? 'on' : 'off' }] },

	// Park green is ground, not a label — and it is one of the few things
	// satellite and terrain also show, so it stays on either way.
	{ featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: t.map.park }, { visibility: 'on' }] },

	{ featureType: 'road', elementType: 'geometry', stylers: [{ color: t.map.road }] },
	{ featureType: 'road', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
	// Route shields (E1, N2). Satellite and terrain draw them with no say from
	// us, so muting them here would only make standard the odd one out.
	{ featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'on' }] },
	{ featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: t.map.roadMajor }] },
	{ featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: t.map.roadMajor }] },

	// The coloured rail overlays never belonged on a jeepney map.
	{ featureType: 'transit.line', stylers: [{ visibility: 'off' }] },

	{ featureType: 'water', elementType: 'geometry', stylers: [{ color: t.map.water }] },
	{ featureType: 'water', elementType: 'labels.text', stylers: [{ visibility: 'on' }] }
]

/** For maps that carry Biyahero's own place layer, and the route thumbnails. */
export const MAP_STYLES = { light: build(day, false), dark: build(night, false) }

/**
 * For maps with no place layer of their own — the driver's destination picker,
 * where the whole task is "tap near the terminal" and Google's labels are the
 * only landmarks on screen.
 */
export const MAP_STYLES_WITH_PLACES = { light: build(day, true), dark: build(night, true) }
