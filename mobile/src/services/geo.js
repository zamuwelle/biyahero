/** Straight-line distance in metres between two {latitude, longitude} points. */
export const distanceM = (a, b) => {
	if (!a || !b) return null

	const R = 6371000
	const dLat = ((b.latitude - a.latitude) * Math.PI) / 180
	const dLng = ((b.longitude - a.longitude) * Math.PI) / 180
	const s =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((a.latitude * Math.PI) / 180) * Math.cos((b.latitude * Math.PI) / 180) * Math.sin(dLng / 2) ** 2

	return Math.round(R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)))
}

/** A vehicle inside this radius counts as "malapit na". */
export const NEAR_M = 350
/** Must leave this radius before the same vehicle can alert again. */
export const NEAR_RESET_M = 600

/** Metres from a point to the segment a–b, planar approximation (city scale). */
const distToSegmentM = (p, a, b) => {
	const kx = 111320 * Math.cos((p.latitude * Math.PI) / 180)
	const ky = 110574
	const ax = (a.longitude - p.longitude) * kx
	const ay = (a.latitude - p.latitude) * ky
	const bx = (b.longitude - p.longitude) * kx
	const by = (b.latitude - p.latitude) * ky
	const dx = bx - ax
	const dy = by - ay
	const len2 = dx * dx + dy * dy
	const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2))
	return Math.hypot(ax + t * dx, ay + t * dy)
}

/**
 * The part of a route still AHEAD of a vehicle — everything behind it is
 * consumed, the way a navigation app eats the line as you drive.
 *
 * `target` orients the line first: corridors are reused in either direction,
 * so when the trip's destination sits at the waypoint list's START the list
 * is reversed before trimming — otherwise the leftover line would point away
 * from where the vehicle is going.
 *
 * Trimming snaps to the nearest SEGMENT and keeps that segment's end vertex:
 * a nearest-vertex cut would drop an upcoming corner for the back half of
 * every segment, and on a 2-point route would erase the line entirely past
 * the midpoint. The result always has ≥ 2 points, anchored at the vehicle.
 */
export const remainingRoute = (position, waypoints, target = null) => {
	if (!waypoints?.length) return waypoints ?? []

	let pts = waypoints
	if (target && waypoints.length > 1) {
		const toFirst = distanceM(target, waypoints[0])
		const toLast = distanceM(target, waypoints[waypoints.length - 1])
		if (toFirst !== null && toLast !== null && toFirst < toLast) pts = [...waypoints].reverse()
	}

	if (!position || pts.length < 2) return pts

	let best = 0
	let bestD = Infinity
	for (let i = 0; i < pts.length - 1; i++) {
		const d = distToSegmentM(position, pts[i], pts[i + 1])
		if (d < bestD) {
			bestD = d
			best = i
		}
	}

	return [position, ...pts.slice(best + 1)]
}
