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
}