import math
from .models import RadarRequest, RadarResult, Coordinates

EARTH_RADIUS_KM = 6371.0

def haversine_dist(p1: Coordinates, p2: Coordinates) -> float:
	"""calculates the great-circle distance (the shortest path along the surface) between two points on a sphere using their latitude and longitude"""
	lat1, lng1 = math.radians(p1.lat), math.radians(p1.lng)
	lat2, lng2 = math.radians(p2.lat), math.radians(p2.lng)

	delta_lat = lat2 - lat1
	delta_lng = lng2 - lng1

	a = (
		math.sin(delta_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lng / 2) ** 2
	)

	c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

	return EARTH_RADIUS_KM * c

def find_nearby_vehicles(req: RadarRequest, max_results: int = 3) -> list[RadarResult]:
	results: list[RadarResult] = []

	for vehicle in req.candidate_vehicles:
		distance = haversine_dist(req.commuter_location, vehicle.curr_position)

		if distance <= req.radius_km:

			results.append(
				RadarResult(
					vehicle_id=vehicle.vehicle_id,
					vehicle_type=vehicle.vehicle_type,
					distance_km=round(distance, 3)
				)
			)

	results.sort(key=lambda r: r.distance_km)

	return results[:max_results]
