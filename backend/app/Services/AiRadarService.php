<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

/**
 * Thin client for the FastAPI service.
 *
 * The commuter-radar methods that used to live here were removed: they took a
 * `commuter_location` and returned distance/ETA to that point, which the app no
 * longer has and deliberately never asks for. What remains is the ETA call,
 * used only for the DRIVER's own route preview ("~8.4 km · tinatayang 34 min").
 */
class AiRadarService
{
    public function predictEta(int $routeId, string $vehicleType, int $hourOfDay, string $dayOfWeek, float $distanceKm): array
    {
        $res = Http::timeout(8)->post(config('services.ai.url').'/eta', [
            'route_id' => $routeId,
            'vehicle_type' => $vehicleType,
            'hour_of_day' => $hourOfDay,
            'day_of_week' => $dayOfWeek,
            'distance_km' => $distanceKm,
        ]);

        if ($res->failed()) {
            throw new \RuntimeException('AI ETA request failed: '.$res->body());
        }

        return $res->json();
    }
}
