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

    // Nothing here may touch the network: an unfaked URL is executed for
    // real by Laravel's partial fake, which once let a live Nominatim
    // lookup decide a test's outcome.
    Http::preventStrayRequests();

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

    $driver = actingDriver();

    // A namesake row ~550 m from the pin: the name-table fallback would serve
    // ITS coordinates, so only the trip's own dest_lat/lng can satisfy the
    // exactness assertions below.
    Destination::create([
        'name' => 'Malapit sa palengke',
        'subtitle' => 'namesake',
        'lat' => 15.5720,
        'lng' => 120.6850,
        'is_popular' => false,
    ]);

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

    // The commuter side must pin EXACTLY where the driver pinned — never a
    // nearby namesake from the destinations table.
    $this->getJson('/api/active-vehicles/'.$driver->vehicle->id)
        ->assertOk()
        ->assertJsonPath('data.destination_position.lat', 15.568)
        ->assertJsonPath('data.destination_position.lng', 120.682);
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

it('suggests places as the driver types, known destinations first, behind auth', function () {
    Http::fake([
        'nominatim.openstreetmap.org/search*' => Http::response([
            // Far namesake listed FIRST, as Nominatim really does.
            ['name' => 'Bacong', 'lat' => '9.2500', 'lon' => '123.2900', 'display_name' => 'Bacong, Negros Oriental, Philippines'],
            ['name' => 'Bacolor', 'lat' => '14.9989', 'lon' => '120.6503', 'display_name' => 'Bacolor, Pampanga, Central Luzon, 2000, Philippines'],
            // A namesake of the seeded row must not be offered twice.
            ['name' => 'Baclaran', 'lat' => '14.5340', 'lon' => '120.9967', 'display_name' => 'Baclaran, Parañaque, Metro Manila, Philippines'],
        ]),
    ]);

    $this->getJson('/api/places/search?q=bac')->assertUnauthorized();

    actingDriver();

    $rows = $this->getJson('/api/places/search?q=bac&lat='.DRIVER_LAT.'&lng='.DRIVER_LNG)
        ->assertOk()
        ->json('data');

    expect($rows)->not->toBeEmpty()
        // The seeded Baclaran is ours, so it leads and is not duplicated.
        ->and($rows[0]['name'])->toBe('Baclaran')
        ->and($rows[0]['known'])->toBeTrue()
        ->and(collect($rows)->where('name', 'Baclaran')->count())->toBe(1)
        // Pampanga is next door to this Tarlac driver; Negros is not — the
        // geocoder's own order must not survive.
        ->and(collect($rows)->pluck('name')->all())->toContain('Bacolor')
        ->and(collect($rows)->search(fn (array $r) => $r['name'] === 'Bacolor'))
        ->toBeLessThan(collect($rows)->search(fn (array $r) => $r['name'] === 'Bacong'));

    foreach ($rows as $row) {
        expect($row)->toHaveKeys(['name', 'subtitle', 'lat', 'lng', 'known', 'distance_m']);
    }

    // The distance is what tells a driver the branch on offer is in the next
    // province, so it has to be real, not a placeholder.
    $bacong = collect($rows)->firstWhere('name', 'Bacong');
    $bacolor = collect($rows)->firstWhere('name', 'Bacolor');

    expect($bacolor['distance_m'])->toBeLessThan($bacong['distance_m'])
        ->and($bacolor['distance_m'])->toBeGreaterThan(0);
});

it('asks the geocoder for a pool worth ranking, not just a page of it', function () {
    actingDriver();

    Http::fake(['nominatim.openstreetmap.org/search*' => Http::response([])]);

    $this->getJson('/api/places/search?q=jollibee&lat='.DRIVER_LAT.'&lng='.DRIVER_LNG)->assertOk();

    // Nominatim ranks by its own idea of importance and treats the viewbox as
    // a hint. A short list came back full of famous far-away branches with the
    // reachable one missing entirely, so the fix is to ask for enough rows
    // that our own distance sort has something to work with.
    Http::assertSent(function ($request) {
        parse_str(parse_url($request->url(), PHP_URL_QUERY) ?? '', $query);

        return (int) ($query['limit'] ?? 0) >= 40;
    });
});

it('leaves out a distance it cannot compute', function () {
    actingDriver();

    Http::fake([
        'nominatim.openstreetmap.org/search*' => Http::response([
            ['name' => 'Bacolor', 'lat' => '14.9989', 'lon' => '120.6503', 'display_name' => 'Bacolor, Pampanga, Philippines'],
        ]),
    ]);

    // No position sent: a distance printed as 0 m would read as "right here".
    $rows = $this->getJson('/api/places/search?q=bac')->assertOk()->json('data');

    expect(collect($rows)->firstWhere('name', 'Bacolor')['distance_m'])->toBeNull();
});

it('rejects a place search that is too short to mean anything', function () {
    actingDriver();

    $this->getJson('/api/places/search?q=b')->assertUnprocessable();
});

it('offers the driver their five most recent routes, newest first, no repeats', function () {
    $driver = actingDriver();

    // Own the whole history for this vehicle so the ordering under test is the
    // only ordering in play — the seeder ships runs of its own.
    Trip::query()->where('vehicle_id', $driver->vehicle->id)->delete();

    // Six distinct routes plus a repeat: the list must collapse the repeat,
    // keep the newest five, and drop the sixth-oldest entirely.
    $routes = Route::query()->take(5)->pluck('id')->all();
    $routes[] = Route::create([
        'name' => 'Test Sixth',
        'label' => 'Test Sixth',
        'waypoints' => [['lat' => 14.5, 'lng' => 121.0], ['lat' => 14.6, 'lng' => 121.1]],
        'length_km' => 5,
    ])->id;

    $plan = [
        [$routes[0], 'Pinakaluma', 9],
        [$routes[5], 'Ikaanim', 8],
        [$routes[1], 'Cubao', 5],
        [$routes[0], 'Baclaran ulit', 4],
        [$routes[2], 'Monumento', 3],
        [$routes[3], 'Alabang', 2],
        [$routes[4], 'Ayala', 1],
    ];

    foreach ($plan as [$routeId, $destination, $daysAgo]) {
        Trip::create([
            'vehicle_id' => $driver->vehicle->id,
            'route_id' => $routeId,
            'destination' => $destination,
            'capacity' => 'open',
            'started_at' => now()->subDays($daysAgo),
            'ended_at' => now()->subDays($daysAgo)->addHour(),
        ]);
    }

    $rows = $this->getJson('/api/routes/recent')->assertOk()->json('data');

    expect($rows)->toHaveCount(5)
        ->and(array_column($rows, 'destination'))
        ->toBe(['Ayala', 'Alabang', 'Monumento', 'Baclaran ulit', 'Cubao'])
        // The 8-day-old sixth route falls off the end; the 9-day-old run on
        // route[0] is represented by its newer repeat, not twice.
        ->and(array_column($rows, 'id'))->not->toContain($routes[5])
        ->and($rows[0])->toHaveKeys(['id', 'label', 'length_km', 'destination', 'last_used_at']);
});

it('requires auth for recent routes', function () {
    $this->getJson('/api/routes/recent')->assertUnauthorized();
});

it('suggests places to commuters without any position, fleet-served first', function () {
    Http::fake([
        'nominatim.openstreetmap.org/*' => Http::response([
            // Far from every running route.
            ['name' => 'Sample Far', 'lat' => '9.3000', 'lon' => '123.3000', 'display_name' => 'Sample Far, Negros Oriental, Philippines'],
            // Sitting on the seeded Taft corridor.
            ['name' => 'Sample Near', 'lat' => '14.5636', 'lon' => '120.9944', 'display_name' => 'Sample Near, Pasay, Metro Manila, Philippines'],
        ]),
    ]);

    // Public: no token, and the endpoint accepts no coordinates at all.
    $rows = $this->getJson('/api/places/suggest?q=sample')->assertOk()->json('data');

    expect($rows)->not->toBeEmpty()
        // A JSON list, not an object keyed by row index — the app maps over it.
        ->and(array_is_list($rows))->toBeTrue()
        ->and(array_column($rows, 'name'))->toBe(['Sample Near', 'Sample Far']);

    // A position offered anyway must not change the answer.
    $withPosition = $this->getJson('/api/places/suggest?q=sample&lat=9.3&lng=123.3')->assertOk()->json('data');

    expect(array_column($withPosition, 'name'))->toBe(['Sample Near', 'Sample Far']);
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
