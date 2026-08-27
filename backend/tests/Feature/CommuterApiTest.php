<?php

use App\Models\Trip;
use App\Models\Vehicle;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

beforeEach(function () {
    // Feature tests must not depend on a public routing host. OSRM is faked to
    // fail so seeding falls back to the hand-placed control points, which makes
    // corridor results deterministic. RouteGeometry itself is unit-tested with a
    // canned OSRM response in tests/Unit.
    Http::fake(['router.project-osrm.org/*' => Http::response(null, 503)]);

    $this->seed(DatabaseSeeder::class);
});

/*
 * The product rule these tests exist to defend: the app never learns where the
 * commuter is. Anything that would require a commuter position — a distance, an
 * ETA, a radius — must stay absent from the API. If one of these fails, someone
 * has reintroduced the location dependency the design deliberately removed.
 */

it('never returns a distance or an ETA to the commuter', function () {
    $payload = $this->getJson('/api/active-vehicles')->assertOk()->json();

    // Walk every key in the response — a substring check would trip over "meta".
    $keys = [];
    $walk = function ($node) use (&$walk, &$keys) {
        foreach ((array) $node as $key => $value) {
            if (is_string($key)) {
                $keys[] = $key;
            }
            if (is_array($value)) {
                $walk($value);
            }
        }
    };
    $walk($payload);

    $forbidden = ['distance_km', 'distance', 'eta', 'eta_minutes', 'predicted_eta_minutes', 'predicted_travel_time_minutes'];

    expect(array_intersect($forbidden, $keys))->toBeEmpty();
});

it('ignores any commuter position passed to it', function () {
    $withPosition = $this->getJson('/api/active-vehicles?lat=14.55&lng=121.02&radius_km=2')->assertOk();
    $without = $this->getJson('/api/active-vehicles')->assertOk();

    // Same result either way — the parameters are simply not part of the query.
    expect($withPosition->json('meta.count'))->toBe($without->json('meta.count'));
});

it('lists every active vehicle when no destination is given', function () {
    $this->getJson('/api/active-vehicles')
        ->assertOk()
        ->assertJsonPath('meta.count', 12);
});

it('corridor-matches a destination to routes that pass within 400 m', function () {
    $response = $this->getJson('/api/active-vehicles?destination=Baclaran')->assertOk();

    expect($response->json('meta.count'))->toBe(5)
        ->and($response->json('meta.corridor_radius_m'))->toBe(400);

    // The corridor asks "does this route PASS Baclaran", so every match must be
    // on a Baclaran-serving route — not merely named Baclaran.
    foreach ($response->json('data') as $vehicle) {
        expect($vehicle['route']['label'])->toContain('Baclaran');
    }
});

it('returns nothing for an unknown destination rather than falling back to everything', function () {
    // The dangerous failure mode: a typo silently showing all 12 vehicles as if
    // they all served the typed place.
    $this->getJson('/api/active-vehicles?destination=Narnia')
        ->assertOk()
        ->assertJsonPath('data', [])
        ->assertJsonPath('meta.resolved', false);
});

it('filters by vehicle class', function () {
    $response = $this->getJson('/api/active-vehicles?vehicle_type=bus')->assertOk();

    expect($response->json('data'))->not->toBeEmpty();

    foreach ($response->json('data') as $vehicle) {
        expect($vehicle['vehicle_type'])->toBe('bus');
    }
});

it('rejects a vehicle class that is not one of the four PH classes', function () {
    $this->getJson('/api/active-vehicles?vehicle_type=tricycle')
        ->assertStatus(422);
});

it('marks a vehicle stale and forces its capacity to unknown once the ping ages out', function () {
    $vehicle = Vehicle::where('plate_number', 'RMV 5520')->firstOrFail();

    // Seeded two hours stale, but its trip still claims a real capacity.
    expect(Trip::where('vehicle_id', $vehicle->id)->value('capacity'))->not->toBe('open');

    $response = $this->getJson('/api/active-vehicles')->assertOk();
    $stale = collect($response->json('data'))->firstWhere('plate_number', 'RMV 5520');

    expect($stale['is_stale'])->toBeTrue()
        ->and($stale['capacity'])->toBe('unknown')
        ->and($stale['minutes_since_ping'])->toBeGreaterThan(2);
});

it('reports a fresh ping as live', function () {
    $fresh = collect($this->getJson('/api/active-vehicles')->json('data'))
        ->firstWhere('plate_number', 'NCR 8842');

    expect($fresh['is_stale'])->toBeFalse()
        ->and($fresh['minutes_since_ping'])->toBe(0)
        ->and($fresh['current_street'])->toBe('Taft Ave');
});

it('shows the driver only by short name and never exposes the licence', function () {
    $vehicle = collect($this->getJson('/api/active-vehicles')->json('data'))
        ->firstWhere('plate_number', 'NCR 8842');

    expect($vehicle['driver']['name'])->toBe('Roberto S.')
        ->and($vehicle['driver'])->not->toHaveKey('license_no')
        ->and($vehicle['driver'])->not->toHaveKey('license_hash')
        ->and($vehicle['driver'])->not->toHaveKey('phone');
});

it('counts active vehicles per destination without any commuter position', function () {
    $response = $this->getJson('/api/destinations')->assertOk();

    $baclaran = collect($response->json('data'))->firstWhere('name', 'Baclaran');

    expect($baclaran['active_count'])->toBe(5)
        ->and($baclaran['subtitle'])->toBe('LRT-1 Baclaran Station');
});

it('searches destinations by partial name', function () {
    $response = $this->getJson('/api/destinations?q=bacl')->assertOk();

    expect($response->json('data'))->toHaveCount(1)
        ->and($response->json('data.0.name'))->toBe('Baclaran');
});
