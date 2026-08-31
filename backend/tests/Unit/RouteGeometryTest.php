<?php

use App\Services\RouteGeometry;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

// Needs the container: the service resolves the Http facade.
uses(TestCase::class);

beforeEach(function () {
    $this->geometry = new RouteGeometry;
});

$anchors = [
    ['lat' => 14.5540, 'lng' => 120.9976],
    ['lat' => 14.5340, 'lng' => 120.9967],
];

it('converts an OSRM response into lat/lng waypoints with real distance', function () use ($anchors) {
    Http::fake(['router.project-osrm.org/*' => Http::response([
        'code' => 'Ok',
        'routes' => [[
            'distance' => 3521.4,
            'duration' => 431.2,
            'geometry' => ['coordinates' => [
                // GeoJSON is [lng, lat] — the flip is the thing worth testing.
                [120.997587, 14.554049],
                [120.997100, 14.545000],
                [120.996700, 14.534000],
            ]],
        ]],
    ])]);

    $result = $this->geometry->snapToRoads($anchors);

    expect($result['matched'])->toBeTrue()
        ->and($result['length_km'])->toBe(3.52)
        ->and($result['duration_min'])->toBe(7)
        ->and($result['waypoints'])->toHaveCount(3)
        ->and($result['waypoints'][0])->toBe(['lat' => 14.554049, 'lng' => 120.997587]);
});

it('falls back to the control points when OSRM is unreachable', function () use ($anchors) {
    Http::fake(['router.project-osrm.org/*' => Http::response(null, 503)]);

    $result = $this->geometry->snapToRoads($anchors);

    expect($result['matched'])->toBeFalse()
        ->and($result['waypoints'])->toBe($anchors)
        // Straight-line distance, flagged as unmatched so nothing claims it is
        // a real driving distance.
        ->and($result['length_km'])->toBeGreaterThan(2.0)
        ->and($result['duration_min'])->toBe(0);
});

it('falls back when OSRM returns a non-Ok code', function () use ($anchors) {
    Http::fake(['router.project-osrm.org/*' => Http::response(['code' => 'NoRoute'])]);

    expect($this->geometry->snapToRoads($anchors)['matched'])->toBeFalse();
});

it('does not call OSRM for a single point', function () {
    Http::fake();

    $result = $this->geometry->snapToRoads([['lat' => 14.55, 'lng' => 120.99]]);

    expect($result['matched'])->toBeFalse();
    Http::assertNothingSent();
});
