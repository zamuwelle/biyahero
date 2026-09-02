<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Turns a handful of hand-placed control points into a polyline that actually
 * follows the road, using OSRM.
 *
 * Without this a route is drawn as straight segments between sparse anchors,
 * which cuts across blocks and water and reports a straight-line distance that
 * is materially shorter than the real drive. OSRM returns the true geometry and
 * the true distance/duration, so nothing downstream has to estimate.
 */
class RouteGeometry
{
    private const BASE = 'https://router.project-osrm.org';

    /**
     * @param  array<array{lat: float, lng: float}>  $controlPoints
     * @return array{waypoints: array<array{lat: float, lng: float}>, length_km: float, duration_min: int, matched: bool}
     */
    public function snapToRoads(array $controlPoints): array
    {
        $fallback = [
            'waypoints' => $controlPoints,
            'length_km' => round($this->straightLineKm($controlPoints), 2),
            'duration_min' => 0,
            'matched' => false,
        ];

        if (count($controlPoints) < 2) {
            return $fallback;
        }

        $coords = implode(';', array_map(
            fn (array $p) => sprintf('%F,%F', $p['lng'], $p['lat']),
            $controlPoints
        ));

        try {
            $res = Http::timeout(25)->get(self::BASE."/route/v1/driving/{$coords}", [
                'overview' => 'full',
                'geometries' => 'geojson',
            ]);

            if ($res->failed() || ($res->json('code') !== 'Ok')) {
                Log::warning('OSRM route failed, falling back to control points', ['body' => $res->body()]);

                return $fallback;
            }

            $route = $res->json('routes.0');

            return [
                // GeoJSON is [lng, lat]; the app expects {lat, lng}.
                'waypoints' => array_map(
                    fn (array $c) => ['lat' => round($c[1], 6), 'lng' => round($c[0], 6)],
                    $route['geometry']['coordinates']
                ),
                'length_km' => round($route['distance'] / 1000, 2),
                'duration_min' => (int) round($route['duration'] / 60),
                'matched' => true,
            ];
        } catch (\Throwable $e) {
            // Seeding must not fail because a public routing host is down.
            Log::warning('OSRM unreachable, falling back to control points', ['error' => $e->getMessage()]);

            return $fallback;
        }
    }

    /** @param array<array{lat: float, lng: float}> $points */
    /** Crow-flies length of a set of points, in the order given. */
    public function straightLineKm(array $points): float
    {
        $total = 0.0;

        for ($i = 0; $i < count($points) - 1; $i++) {
            $total += $this->haversineM(
                (float) $points[$i]['lat'], (float) $points[$i]['lng'],
                (float) $points[$i + 1]['lat'], (float) $points[$i + 1]['lng']
            );
        }

        return $total / 1000;
    }

    private function haversineM(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return 6_371_000 * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
