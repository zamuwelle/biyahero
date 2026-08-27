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

	{ featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },

	// Landmarks on, storefronts off: a church or school locates you on the
	// road; a sari-sari store label is noise at jeepney-route zoom levels.
	{ featureType: 'poi', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
	{ featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
	{ featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: t.map.park }, { visibility: 'on' }] },

	{ featureType: 'road', elementType: 'geometry', stylers: [{ color: t.map.road }] },
	{ featureType: 'road', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },
	{ featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: t.map.roadMajor }] },
	{ featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: t.map.roadMajor }] },

	// Stations matter to commuters; the coloured line overlays do not.
	{ featureType: 'transit.line', stylers: [{ visibility: 'off' }] },
	{ featureType: 'transit.station', elementType: 'labels.text', stylers: [{ visibility: 'on' }] },

	{ featureType: 'water', elementType: 'geometry', stylers: [{ color: t.map.water }] },
	{ featureType: 'water', elementType: 'labels.text', stylers: [{ visibility: 'on' }] }
]

export const MAP_STYLES = { light: build(day), dark: build(night) }
