<?php

namespace App\Services;

use App\Models\Route;
use Illuminate\Support\Collection;

/**
 * Answers "which routes pass near this destination?" WITHOUT ever taking a
 * commuter position. The old radar asked "what is near YOU", which required a
 * GPS permission the app deliberately never requests. This asks "what goes
 * THERE" instead — the destination is typed, not sensed.
 */
class CorridorMatcher
{
    /**
     * Metres either side of a destination that still counts as passing it,
     * for COMMUTER search. Generous on purpose: a jeepney bound elsewhere
     * that runs past your mall is still your ride — the Nepo-Dau route
     * passes SM City Clark 966 m out. Cards show the actual distance, so a
     * wide net informs rather than misleads.
     */
    public const CORRIDOR_RADIUS_M = 1500;

    /**
     * Tighter: what it takes for an existing corridor to SERVE a driver's
     * declared destination. Loose matching here would put a driver on a
     * route that never reaches where they said they are going.
     */
    public const SERVES_RADIUS_M = 400;

    private const EARTH_RADIUS_M = 6_371_000;

    /**
     * Route ids whose polyline passes within the corridor of the given point.
     *
     * @return array<int>
     */
    public function routeIdsNear(float $lat, float $lng, ?int $radiusM = null): array
    {
        $radius = $radiusM ?? self::CORRIDOR_RADIUS_M;

        return Route::query()
            ->get(['id', 'waypoints'])
            ->filter(fn (Route $route) => $this->minDistanceToRoute($lat, $lng, $route->waypoints ?? []) <= $radius)
            ->pluck('id')
            ->all();
    }

    /**
     * Shortest distance in metres from a point to a route's polyline.
     * Measured against SEGMENTS rather than vertices — a long straight stretch
     * between two far-apart waypoints still counts as passing the destination.
     */
    public function minDistanceToRoute(float $lat, float $lng, array $waypoints): float
    {
        $points = $this->normalise($waypoints);
        if ($points === []) {
            return INF;
        }
        if (count($points) === 1) {
            return $this->haversine($lat, $lng, $points[0][0], $points[0][1]);
        }

        $min = INF;
        for ($i = 0; $i < count($points) - 1; $i++) {
            $d = $this->distanceToSegment($lat, $lng, $points[$i], $points[$i + 1]);
            if ($d < $min) {
                $min = $d;
            }
        }

        return $min;
    }

    /** Total length of a polyline in kilometres. */
    public function routeLengthKm(array $waypoints): float
    {
        $points = $this->normalise($waypoints);
        $total = 0.0;

        for ($i = 0; $i < count($points) - 1; $i++) {
            $total += $this->haversine($points[$i][0], $points[$i][1], $points[$i + 1][0], $points[$i + 1][1]);
        }

        return round($total / 1000, 2);
    }

    /**
     * Point-to-segment distance via equirectangular projection. Over a few
     * hundred metres in Metro Manila the error is centimetres, and it keeps this
     * cheap enough to run over every route on each poll.
     */
    private function distanceToSegment(float $lat, float $lng, array $a, array $b): float
    {
        $latRef = deg2rad($lat);
        $toX = fn (float $lo) => deg2rad($lo) * cos($latRef) * self::EARTH_RADIUS_M;
        $toY = fn (float $la) => deg2rad($la) * self::EARTH_RADIUS_M;

        $px = $toX($lng);
        $py = $toY($lat);
        $ax = $toX($a[1]);
        $ay = $toY($a[0]);
        $bx = $toX($b[1]);
        $by = $toY($b[0]);

        $dx = $bx - $ax;
        $dy = $by - $ay;
        $lenSq = $dx * $dx + $dy * $dy;

        // Degenerate segment (duplicate waypoints) — fall back to point distance.
        if ($lenSq == 0.0) {
            return sqrt(($px - $ax) ** 2 + ($py - $ay) ** 2);
        }

        // Clamp the projection to the segment so we never measure past its ends.
        $t = max(0.0, min(1.0, (($px - $ax) * $dx + ($py - $ay) * $dy) / $lenSq));

        return sqrt(($px - ($ax + $t * $dx)) ** 2 + ($py - ($ay + $t * $dy)) ** 2);
    }

    private function haversine(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);

        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return self::EARTH_RADIUS_M * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    /**
     * Waypoints are stored as {lat, lng} maps; normalise to [lat, lng] pairs and
     * drop anything unparseable rather than letting a null poison the maths.
     */
    private function normalise(array $waypoints): array
    {
        return (new Collection($waypoints))
            ->map(function ($w) {
                $lat = is_array($w) ? ($w['lat'] ?? $w[0] ?? null) : null;
                $lng = is_array($w) ? ($w['lng'] ?? $w[1] ?? null) : null;

                return ($lat === null || $lng === null) ? null : [(float) $lat, (float) $lng];
            })
            ->filter()
            ->values()
            ->all();
    }
}
