<?php

namespace App\Services;

use App\Models\Vehicle;
use Illuminate\Support\Facades\Http;

class AiRadarService {
	public function findNearbyVehicles(float $lat, float $lng, float $radiusKm, string $vehicleType, int $routeId): array
	{
		$candidates = Vehicle::where('vehicle_type', $vehicleType)
			->where('route_id', $routeId)
			->with('route')
			->get();

		$payload = [
			'commuter_location' => [
				'lat' => $lat,
				'lng' => $lng
			],
			'radius_km' => $radiusKm,
			'candidate_vehicles' => $candidates->map(function (Vehicle $vehicle) {
				$position = $vehicle->currentPosition();

				return [
					'vehicle_id' => $vehicle->vehicle_code,
					'vehicle_type' => $vehicle->vehicle_type,
					'curr_position' => [
						'lat' => $position['lat'],
						'lng' => $position['lng'],
					],
				];
			})->values()->toArray(),
		];

		$res = Http::post(config('services.ai.url') . '/radar', $payload);

		if ($res->failed()) {
			throw new \RuntimeException('AI service request failed: ' . $res->body());
		}

		return $res->json();
	}

	public function predictEta(int $routeId, string $vehicleType, int $hourOfDay, string $dayOfWeek, float $distanceKm): array
	{
			$payload = [
					'route_id' => $routeId,
					'vehicle_type' => $vehicleType,
					'hour_of_day' => $hourOfDay,
					'day_of_week' => $dayOfWeek,
					'distance_km' => $distanceKm,
			];

			$res = Http::post(config('services.ai.url') . '/eta', $payload);

			if ($res->failed()) {
					throw new \RuntimeException('AI ETA request failed: ' . $res->body());
			}

			return $res->json();
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
		$vehiclesWithEta = array_map(function (array $vehicle) use ($routeId, $vehicleType, $hourOfDay, $dayOfWeek) {
			$etaResult = $this->predictEta(
				$routeId,
				$vehicleType,
				$hourOfDay,
				$dayOfWeek,
				$vehicle['distance_km'],
			);

			$vehicleModel = Vehicle::where('vehicle_code', $vehicle['vehicle_id'])->first();
			$position = $vehicleModel ? $vehicleModel->currentPosition() : null;

			return array_merge($vehicle, [
				'predicted_eta_minutes' => $etaResult['predicted_travel_time_minutes'],
				'position' => $position
			]);
		}, $vehicles);

		return ['nearby_vehicles' => $vehiclesWithEta];
	}
}