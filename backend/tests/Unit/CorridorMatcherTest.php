<?php

use App\Services\CorridorMatcher;

beforeEach(function () {
    $this->corridor = new CorridorMatcher;
});

/*
 * Taft Avenue runs almost due south. These fixtures use real Metro Manila
 * coordinates so the numbers stay meaningful rather than arbitrary.
 */
$taft = [
    ['lat' => 14.5540, 'lng' => 120.9976], // Buendia
    ['lat' => 14.5455, 'lng' => 120.9969],
    ['lat' => 14.5340, 'lng' => 120.9967], // Baclaran
];

it('measures roughly zero distance to a point sitting on the line', function () use ($taft) {
    expect($this->corridor->minDistanceToRoute(14.5455, 120.9969, $taft))->toBeLessThan(1.0);
});

it('measures against segments, not just the vertices', function () use ($taft) {
    // Midway between two waypoints, and slightly off to the side. Vertex-only
    // matching would report ~470 m here and wrongly miss the corridor.
    $distance = $this->corridor->minDistanceToRoute(14.5400, 120.9969, $taft);

    expect($distance)->toBeLessThan(60.0);
});

it('does not match a point beyond the end of the line', function () use ($taft) {
    // 2 km south of Baclaran — the projection must clamp to the endpoint
    // instead of running on down an imaginary extension of the road.
    $distance = $this->corridor->minDistanceToRoute(14.5160, 120.9967, $taft);

    expect($distance)->toBeGreaterThan(1500.0);
});

it('separates a point on the corridor from one a kilometre off it', function () use ($taft) {
    // ~0.0027° of longitude ≈ 290 m at this latitude.
    $inside = $this->corridor->minDistanceToRoute(14.5455, 121.0000, $taft);
    // ~0.0090° ≈ 1 km.
    $outside = $this->corridor->minDistanceToRoute(14.5455, 121.0066, $taft);

    // Tight rule (does this corridor SERVE the place): only the near point.
    expect($inside)->toBeLessThan(CorridorMatcher::SERVES_RADIUS_M)
        ->and($outside)->toBeGreaterThan(CorridorMatcher::SERVES_RADIUS_M)
        // Commuter rule (does it PASS the place): a kilometre still counts,
        // because a ride running past your mall is still your ride.
        ->and($outside)->toBeLessThan(CorridorMatcher::CORRIDOR_RADIUS_M);
});

it('computes a plausible route length', function () use ($taft) {
    // Buendia to Baclaran along Taft is a little over 2 km in reality.
    expect($this->corridor->routeLengthKm($taft))->toBeGreaterThan(2.0)
        ->and($this->corridor->routeLengthKm($taft))->toBeLessThan(2.6);
});

it('survives malformed waypoints instead of poisoning the maths', function () {
    $messy = [
        ['lat' => 14.5540, 'lng' => 120.9976],
        ['lat' => null, 'lng' => 120.9970],
        'nonsense',
        ['lat' => 14.5340, 'lng' => 120.9967],
    ];

    expect($this->corridor->minDistanceToRoute(14.5455, 120.9969, $messy))->toBeFloat()
        ->and($this->corridor->routeLengthKm($messy))->toBeGreaterThan(0.0);
});

it('reports infinite distance for an empty route', function () {
    expect($this->corridor->minDistanceToRoute(14.55, 121.0, []))->toBe(INF);
});

it('handles a degenerate segment of duplicate waypoints', function () {
    $duplicate = [
        ['lat' => 14.5540, 'lng' => 120.9976],
        ['lat' => 14.5540, 'lng' => 120.9976],
    ];

    expect($this->corridor->minDistanceToRoute(14.5540, 120.9976, $duplicate))->toBeLessThan(1.0);
});
