<?php

use App\Models\Destination;
use App\Models\Route;
use App\Models\Trip;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

/**
 * The Tarlac-driver bug these tests exist to forbid: a driver far from Metro
 * Manila typing an unknown destination used to be silently put on
 * Route::first() — a Manila corridor. Now the route is resolved from where
 * the driver actually is, or built fresh, or refused with a clear error.
 */

// Victoria, Tarlac — nowhere near any seeded Manila corridor.
const DRIVER_LAT = 15.5771;
const DRIVER_LNG = 120.6813;

beforeEach(function () {
    // OSRM only — Http::fake stubs are matched in REGISTRATION order, so a
    // nominatim wildcard here would swallow every per-test nominatim fake.
    Http::fake(['router.project-osrm.org/*' => Http::response(null, 503)]);

    $this->seed(DatabaseSeeder::class);
});

function actingDriver(): User
{
    $driver = User::whereHas('vehicle', fn ($q) => $q->where('plate_number', 'NCR 8842'))->firstOrFail();
    Sanctum::actingAs($driver);

    return $driver;
}

it('never falls back to a Manila route for an unknown, ungeocodable destination', function () {
    Http::fake(['nominatim.openstreetmap.org/*' => Http::response([], 200)]);

    actingDriver();

    $this->postJson('/api/trips', [
        'destination' => 'Kung Saan-Saan Lang',
        'lat' => DRIVER_LAT,
        'lng' => DRIVER_LNG,
    ])->assertUnprocessable();
});

it('creates a road route from the driver position when the destination geocodes', function () {
    Http::fake([
        'nominatim.openstreetmap.org/search*' => Http::response([
            ['lat' => '15.6237', 'lon' => '120.6469', 'display_name' => 'Pura, Tarlac, Central Luzon, Philippines'],
        ]),
        'nominatim.openstreetmap.org/reverse*' => Http::response([
            'address' => ['town' => 'Victoria'],
        ]),
    ]);

    actingDriver();

    $response = $this->postJson('/api/trips', [
        'destination' => 'Pura',
        'lat' => DRIVER_LAT,
        'lng' => DRIVER_LNG,
    ])->assertCreated();

    $route = Route::findOrFail($response->json('data.route_id'));

    // Canonical name, real label, geometry anchored where the driver stood.
    expect($response->json('data.destination'))->toBe('Pura')
        ->and($route->label)->toBe('Victoria → Pura')
        ->and($route->waypoints[0]['lat'])->toBe(DRIVER_LAT)
        ->and(Destination::query()->where('name', 'Pura')->exists())->toBeTrue();
});

it('reuses a corridor only when it passes near the driver, else builds a fresh one', function () {
    Http::fake(['nominatim.openstreetmap.org/*' => Http::response(['address' => ['town' => 'Victoria']])]);

    actingDriver();
    $manilaRouteIds = Route::query()->pluck('id')->all();

    // "Baclaran" names a seeded Manila destination, but this driver is in
    // Tarlac — no Manila corridor passes near them, so a NEW route is built
    // from where they stand instead of teleporting them onto Route::first().
    $far = $this->postJson('/api/trips', [
        'destination' => 'Baclaran',
        'lat' => DRIVER_LAT,
        'lng' => DRIVER_LNG,
    ])->assertCreated();

    $newRoute = Route::findOrFail($far->json('data.route_id'));

    expect(in_array($newRoute->id, $manilaRouteIds, true))->toBeFalse()
        ->and($newRoute->waypoints[0]['lat'])->toBe(DRIVER_LAT);

    // The same request placed ON the Baclaran corridor reuses the Manila route.
    $baclaran = Destination::query()->where('name', 'Baclaran')->firstOrFail();

    $near = $this->postJson('/api/trips', [
        'destination' => 'Baclaran',
        'lat' => (float) $baclaran->lat,
        'lng' => (float) $baclaran->lng,
    ])->assertCreated();

    expect(in_array($near->json('data.route_id'), $manilaRouteIds, true))->toBeTrue();
});

it('accepts a destination pinned on the map instead of typed', function () {
    Http::fake(['nominatim.openstreetmap.org/*' => Http::response(['address' => ['town' => 'Victoria']])]);

    actingDriver();

    $response = $this->postJson('/api/trips', [
        'destination' => 'Malapit sa palengke',
        'lat' => DRIVER_LAT,
        'lng' => DRIVER_LNG,
        'dest_lat' => 15.5680,
        'dest_lng' => 120.6820,
    ])->assertCreated();

    $route = Route::findOrFail($response->json('data.route_id'));
    $waypoints = $route->waypoints;
    $end = end($waypoints);

    expect($end['lat'])->toBe(15.5680)
        ->and($end['lng'])->toBe(120.6820)
        ->and($response->json('data.destination'))->toBe('Malapit sa palengke');
});

it('reroutes a live trip from the vehicle current position and keeps the run', function () {
    Http::fake([
        'nominatim.openstreetmap.org/search*' => Http::response([
            ['lat' => '15.4861', 'lon' => '120.5894', 'display_name' => 'Tarlac City, Tarlac, Philippines'],
        ]),
        'nominatim.openstreetmap.org/reverse*' => Http::response(['address' => ['town' => 'Victoria']]),
    ]);

    $driver = actingDriver();
    $trip = Trip::query()->active()->where('vehicle_id', $driver->vehicle->id)->firstOrFail();
    $startedAt = $trip->started_at;
    $originalRoute = $trip->route_id;

    $driver->vehicle->update(['live_lat' => DRIVER_LAT, 'live_lng' => DRIVER_LNG]);

    $this->patchJson("/api/trips/{$trip->id}/route", [
        'destination' => 'Tarlac City',
    ])->assertOk();

    $trip->refresh();

    expect($trip->route_id)->not->toBe($originalRoute)
        ->and($trip->destination)->toBe('Tarlac City')
        ->and($trip->started_at->equalTo($startedAt))->toBeTrue()
        ->and($trip->ended_at)->toBeNull();
});

it('refuses to start without a driver position rather than guessing a corridor', function () {
    actingDriver();

    // "Baclaran" exact-matches a seeded destination — the OLD code would have
    // put this positionless driver straight onto the Manila corridor.
    $this->postJson('/api/trips', ['destination' => 'Baclaran'])->assertUnprocessable();
});

it('refuses to reroute a trip that has already ended', function () {
    $driver = actingDriver();
    $trip = Trip::query()->active()->where('vehicle_id', $driver->vehicle->id)->firstOrFail();
    $trip->update(['ended_at' => now()]);
    $frozen = $trip->fresh();

    $this->patchJson("/api/trips/{$trip->id}/route", [
        'destination' => 'Baclaran',
        'lat' => 14.534,
        'lng' => 120.9967,
    ])->assertUnprocessable();

    expect($trip->fresh()->destination)->toBe($frozen->destination)
        ->and($trip->fresh()->route_id)->toBe($frozen->route_id);
});

it('qualifies a namesake destination instead of stealing its coordinates', function () {
    Http::fake(['nominatim.openstreetmap.org/*' => Http::response(['address' => ['town' => 'Victoria']])]);

    actingDriver();

    // A far-away place already owns the name "Baclaran" (seeded, Manila).
    // Pinning a spot in Tarlac that reverse-geocodes under a colliding name
    // must NOT reuse Manila's row — and must not hijack its cache key either.
    $response = $this->postJson('/api/trips', [
        'destination' => 'Baclaran',
        'lat' => DRIVER_LAT,
        'lng' => DRIVER_LNG,
        'dest_lat' => 15.5680,
        'dest_lng' => 120.6820,
    ])->assertCreated();

    $name = $response->json('data.destination');

    expect($name)->not->toBe('Baclaran')
        ->and($name)->toContain('Baclaran');

    $row = Destination::query()->where('name', $name)->firstOrFail();
    expect((float) $row->lat)->toBe(15.5680);
});

it('stops a driver from rerouting another driver trip', function () {
    actingDriver();

    $other = Trip::query()->active()
        ->whereHas('vehicle', fn ($q) => $q->where('plate_number', '!=', 'NCR 8842'))
        ->firstOrFail();

    $this->patchJson("/api/trips/{$other->id}/route", ['destination' => 'Cubao'])->assertForbidden();
});

it('lists routes near the driver, nearest corridor first, behind auth', function () {
    $this->getJson('/api/routes/nearby?lat=14.55&lng=120.99')->assertUnauthorized();

    actingDriver();

    $response = $this->getJson('/api/routes/nearby?lat=14.5636&lng=120.9944')->assertOk();
    $rows = $response->json('data');

    expect($rows)->not->toBeEmpty();

    $distances = array_column($rows, 'distance_m');
    $sorted = $distances;
    sort($sorted);

    expect($distances)->toBe($sorted)
        ->and($rows[0])->toHaveKeys(['id', 'label', 'length_km', 'destination', 'distance_m']);
});
