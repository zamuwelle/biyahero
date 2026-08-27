import { day } from './tokens'

/**
 * Google Maps style matching the Figma Map Canvas: a desaturated street grid
 * with Signal-tinted arterials. Deliberately low contrast — a route line or a
 * vehicle pin must never have to compete with the basemap.
 */
export const MAP_STYLE = [
	{ elementType: 'geometry', stylers: [{ color: day.map.block }] },
	{ elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
	{ elementType: 'labels.text.fill', stylers: [{ color: day.text.secondary }] },
	{ elementType: 'labels.text.stroke', stylers: [{ color: day.surface.default }] },

	{ featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
	{ featureType: 'poi', stylers: [{ visibility: 'off' }] },
	{ featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: day.map.park }, { visibility: 'on' }] },

	{ featureType: 'road', elementType: 'geometry', stylers: [{ color: day.map.road }] },
	{ featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
	{ featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: day.map.roadMajor }] },
	{ featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: day.map.roadMajor }] },
	{ featureType: 'road.highway', elementType: 'labels', stylers: [{ visibility: 'simplified' }] },

	{ featureType: 'transit', stylers: [{ visibility: 'off' }] },
	{ featureType: 'water', elementType: 'geometry', stylers: [{ color: day.map.water }] },
	{ featureType: 'water', elementType: 'labels.text', stylers: [{ visibility: 'off' }] }
]
