import { day, night } from './tokens'

/**
 * Google Maps styles matching the Figma Map Canvas: a desaturated street grid
 * with tinted arterials. Colours stay muted so route lines and vehicle pins
 * keep the figure/ground contrast — but LABELS stay on: street names, town
 * names, landmarks and stations are how a commuter orients ("nasa MacArthur
 * na", "malapit sa simbahan"). Only shop-level clutter is off.
 */
const build = t => [
	{ elementType: 'geometry', stylers: [{ color: t.map.block }] },
	{ elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
	{ elementType: 'labels.text.fill', stylers: [{ color: t.text.secondary }] },
	{ elementType: 'labels.text.stroke', stylers: [{ color: t.surface.default }] },

	// Boundary lines off, place NAMES on. Barangay names ride on
	// administrative.neighborhood and are how people here actually say where
	// they are ("nasa Balibago na"), so they are pinned on explicitly rather
	// than left to Google's default zoom heuristics.
	{ featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
	{ featureType: 'administrative', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
	{ featureType: 'administrative.locality', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
	{ featureType: 'administrative.neighborhood', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
	{ featureType: 'administrative.land_parcel', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },

	// Every place Google knows stays on the map — terminals, tindahan,
	// simbahan, eskwelahan. Hiding businesses kept the canvas tidy but also
	// hid the landmarks people actually navigate by ("sa tapat ng terminal"),
	// and a commuter zooming in expects what Google Maps shows them.
	{ featureType: 'poi', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
	{ featureType: 'poi.business', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
	{ featureType: 'poi.business', elementType: 'labels.icon', stylers: [{ visibility: 'on' }] },
	{ featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: t.map.park }, { visibility: 'on' }] },

	// Icons for the landmarks people navigate by — church, school, clinic,
	// municipio, park — while the global icon rule above keeps the rest mute.
	{ featureType: 'poi.park', elementType: 'labels.icon', stylers: [{ visibility: 'on' }] },
	{ featureType: 'poi.school', elementType: 'labels.icon', stylers: [{ visibility: 'on' }] },
	{ featureType: 'poi.medical', elementType: 'labels.icon', stylers: [{ visibility: 'on' }] },
	{ featureType: 'poi.place_of_worship', elementType: 'labels.icon', stylers: [{ visibility: 'on' }] },
	{ featureType: 'poi.government', elementType: 'labels.icon', stylers: [{ visibility: 'on' }] },

	{ featureType: 'road', elementType: 'geometry', stylers: [{ color: t.map.road }] },
	{ featureType: 'road', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
	{ featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: t.map.roadMajor }] },
	{ featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: t.map.roadMajor }] },

	// Stations matter to commuters; the coloured line overlays do not.
	{ featureType: 'transit.line', stylers: [{ visibility: 'off' }] },
	{ featureType: 'transit.station', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
	{ featureType: 'transit.station', elementType: 'labels.icon', stylers: [{ visibility: 'on' }] },

	{ featureType: 'water', elementType: 'geometry', stylers: [{ color: t.map.water }] },
	{ featureType: 'water', elementType: 'labels.text', stylers: [{ visibility: 'on' }] }
]

export const MAP_STYLES = { light: build(day), dark: build(night) }
