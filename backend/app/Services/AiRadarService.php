<?php

namespace App\Services;

use App\Models\Vehicle;
use Illuminate\Support\Facades\Http;

class AiRadarService {
	protected function localHaversine(float $lat1, float $lng1, float $lat2, float $lng2): float
	{
		$earthRadius = 6371.0;
		$dLat = deg2rad($lat2 - $lat1);
		$dLng = deg2rad($lng2 - $lng1);
		$a = sin($dLat / 2) * sin($dLat / 2) +
			cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
			sin($dLng / 2) * sin($dLng / 2);
		$c = 2 * atan2(sqrt($a), sqrt(1 - $a));
		return round($earthRadius * $c, 3);
	}

	public function findNearbyVehicles(float $lat, float $lng, float $radiusKm, string $vehicleType, int $routeId): array
	{
		$query = Vehicle::where('route_id', $routeId);

		if (strtolower($vehicleType) !== 'all' && !empty($vehicleType)) {
			$query->where('vehicle_type', strtolower($vehicleType));
		}

		$candidates = $query->with('route')->get();

		$candidateList = $candidates->map(function (Vehicle $vehicle) {
			$position = $vehicle->currentPosition();

			return [
				'vehicle_id' => $vehicle->vehicle_code,
				'vehicle_type' => $vehicle->vehicle_type,
				'curr_position' => [
					'lat' => $position['lat'],
					'lng' => $position['lng'],
				],
			];
		})->values()->toArray();

		try {
			$payload = [
				'commuter_location' => [
					'lat' => $lat,
					'lng' => $lng
				],
				'radius_km' => $radiusKm,
				'candidate_vehicles' => $candidateList,
			];

			$res = Http::timeout(4)->post(config('services.ai.url') . '/radar', $payload);

			if ($res->successful()) {
				return $res->json();
			}
		} catch (\Throwable $e) {
			// Fallback to local haversine calculation
		}

		$nearby = [];
		foreach ($candidateList as $v) {
			$dist = $this->localHaversine($lat, $lng, $v['curr_position']['lat'], $v['curr_position']['lng']);
			if ($dist <= $radiusKm) {
				$nearby[] = [
					'vehicle_id' => $v['vehicle_id'],
					'vehicle_type' => $v['vehicle_type'],
					'distance_km' => $dist,
				];
			}
		}
		usort($nearby, fn($a, $b) => $a['distance_km'] <=> $b['distance_km']);

		return ['nearby_vehicles' => $nearby];
	}

	public function predictEta(int $routeId, string $vehicleType, int $hourOfDay, string $dayOfWeek, float $distanceKm): array
	{
		try {
			$payload = [
				'route_id' => $routeId,
				'vehicle_type' => strtolower($vehicleType),
				'hour_of_day' => $hourOfDay,
				'day_of_week' => strtolower($dayOfWeek),
				'distance_km' => $distanceKm,
			];

			$res = Http::timeout(4)->post(config('services.ai.url') . '/eta', $payload);

			if ($res->successful()) {
				return $res->json();
			}
		} catch (\Throwable $e) {
			// Fallback to heuristic calculation
		}

		$baseSpeed = match (strtolower($vehicleType)) {
			'bus' => 15.0,
			'e-jeep' => 20.0,
			default => 18.0,
		};
		$multiplier = ((7 <= $hourOfDay && $hourOfDay <= 9) || (16 <= $hourOfDay && $hourOfDay <= 19)) ? 0.55 : 1.0;
		$speed = $baseSpeed * $multiplier;
		$travelTime = round(($distanceKm / max($speed, 1.0)) * 60, 2);

		return ['predicted_travel_time_minutes' => $travelTime];
	}

	public function findNearbyVehiclesWithEta(
		float $lat,
    float $lng,
    float $radiusKm,
    string $vehicleType,
    int $routeId,
    int $hourOfDay,
    string $dayOfWeek
	): array {

		#get existing function
		$radarResult = $this->findNearbyVehicles($lat, $lng, $radiusKm, $vehicleType, $routeId);

		$vehicles = $radarResult['nearby_vehicles'] ?? [];

		#for each vehicles, predict ETA
		$vehiclesWithEta = array_map(function (array $vehicle) use ($routeId, $hourOfDay, $dayOfWeek) {
			$etaResult = $this->predictEta(
				$routeId,
				$vehicle['vehicle_type'],
				$hourOfDay,
				$dayOfWeek,
				$vehicle['distance_km'],
			);

			$vehicleModel = Vehicle::where('vehicle_code', $vehicle['vehicle_id'])->with(['user', 'route'])->first();
			$position = $vehicleModel ? $vehicleModel->currentPosition() : null;

			return array_merge($vehicle, [
				'predicted_eta_minutes' => $etaResult['predicted_travel_time_minutes'],
				'position' => $position,
				'plate_number' => $vehicleModel?->plate_number,
				'model' => $vehicleModel?->model,
				'occupancy' => $vehicleModel?->occupancy ?? 'available',
				'driver_name' => $vehicleModel?->user?->name,
				'is_verified' => $vehicleModel?->user?->is_verified ?? true,
				'destination' => $vehicleModel?->route?->name ?? 'Baclaran'
			]);
		}, $vehicles);

		return ['nearby_vehicles' => $vehiclesWithEta];
	}
}