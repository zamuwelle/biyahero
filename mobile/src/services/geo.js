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
