import { day, night } from './tokens'

/**
 * Google Maps styles matching the Figma Map Canvas: a desaturated street grid
 * with tinted arterials. Deliberately low contrast — a route line or a vehicle
 * pin must never compete with the basemap. One recipe, both themes.
 */
const build = t => [
	{ elementType: 'geometry', stylers: [{ color: t.map.block }] },
	{ elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
	{ elementType: 'labels.text.fill', stylers: [{ color: t.text.secondary }] },
	{ elementType: 'labels.text.stroke', stylers: [{ color: t.surface.default }] },

	{ featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
	{ featureType: 'poi', stylers: [{ visibility: 'off' }] },
	{ featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: t.map.park }, { visibility: 'on' }] },

	{ featureType: 'road', elementType: 'geometry', stylers: [{ color: t.map.road }] },
	{ featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
	{ featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: t.map.roadMajor }] },
	{ featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: t.map.roadMajor }] },
	{ featureType: 'road.highway', elementType: 'labels', stylers: [{ visibility: 'simplified' }] },

	{ featureType: 'transit', stylers: [{ visibility: 'off' }] },
	{ featureType: 'water', elementType: 'geometry', stylers: [{ color: t.map.water }] },
	{ featureType: 'water', elementType: 'labels.text', stylers: [{ visibility: 'off' }] }
]

export const MAP_STYLES = { light: build(day), dark: build(night) }
