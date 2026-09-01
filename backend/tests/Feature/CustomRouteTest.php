<?php

use App\Models\Route;
use App\Models\Trip;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

/**
 * A jeepney route is defined by the roads it uses, not by its endpoints.
 *
 * Two jeepneys running Victoria to Tarlac by different highways are different
 * routes, and before this the app drew both as whatever line OSRM liked best.
 * The commuter standing on the road one of them skips was told it passes them,
 * and the commuter on the road it actually takes was told nothing does.
 */
beforeEach(function () {
    // With OSRM refused, snapToRoads falls back to returning the control
    // points as the polyline — which is exactly what these tests want to read.
    Http::fake(['router.project-osrm.org/*' => Http::response(null, 503)]);
    Http::preventStrayRequests();

    $this->seed(DatabaseSeeder::class);
});

// Victoria, Tarlac, and a road well off the straight line to Tarlac City.
const START_LAT = 15.5771;
const START_LNG = 120.6813;
const VIA_LAT = 15.6400;
const VIA_LNG = 120.8100;

function customRouteDriver(): User
{
    $driver = User::whereHas('vehicle')->firstOrFail();
    Sanctum::actingAs($driver);

    return $driver;
}

/** @return array<string, mixed> */
function tripPayload(array $via = []): array
{
    return [
        'destination' => 'Tarlac City',
        'dest_lat' => 15.4869,
        'dest_lng' => 120.5975,
        'lat' => START_LAT,
        'lng' => START_LNG,
        ...($via === [] ? [] : ['via' => $via]),
    ];
}

it('builds the route through the roads the driver says they take', function () {
    customRouteDriver();

    $trip = $this->postJson('/api/trips', tripPayload([['lat' => VIA_LAT, 'lng' => VIA_LNG]]))
        ->assertCreated()
        ->json('data');

    $route = Route::findOrFail($trip['route']['id']);

    // Driver, the road they named, then the destination — in the order driven.
    expect($route->control_points)->toHaveCount(3)
        ->and((float) $route->control_points[1]['lat'])->toBe(VIA_LAT)
        ->and((float) $route->control_points[1]['lng'])->toBe(VIA_LNG);

    // And the drawn line goes there, which is what commuter matching reads.
    $onLine = collect($route->waypoints)->contains(
        fn (array $point) => abs((float) $point['lat'] - VIA_LAT) < 0.001
            && abs((float) $point['lng'] - VIA_LNG) < 0.001
    );

    expect($onLine)->toBeTrue();
});

it('tells a commuter on that road that the jeepney passes them', function () {
    customRouteDriver();

    $this->postJson('/api/trips', tripPayload([['lat' => VIA_LAT, 'lng' => VIA_LNG]]))->assertCreated();

    // Someone standing a few hundred metres from the road the driver named.
    $rows = $this->getJson('/api/active-vehicles?dest_lat='.(VIA_LAT + 0.002).'&dest_lng='.(VIA_LNG + 0.002).'&destination=Kanto')
        ->assertOk()
        ->json('data');

    // The whole point of the feature: this jeepney genuinely drives past them.
    expect($rows)->not->toBeEmpty();
});

it('and would not have, before the driver could name that road', function () {
    customRouteDriver();

    // Same trip, same destination, no via point — the old behaviour.
    $this->postJson('/api/trips', tripPayload())->assertCreated();

    $rows = $this->getJson('/api/active-vehicles?dest_lat='.(VIA_LAT + 0.002).'&dest_lng='.(VIA_LNG + 0.002).'&destination=Kanto')
        ->assertOk()
        ->json('data');

    // This is the bug the feature exists to fix: the jeepney drives this road
    // every day, and the commuter standing on it was told nothing passes.
    expect($rows)->toBeEmpty();
});

it('still reuses a shared corridor when the driver names no roads', function () {
    customRouteDriver();

    $first = $this->postJson('/api/trips', tripPayload())->assertCreated()->json('data');
    $this->postJson('/api/trips/'.$first['id'].'/end')->assertOk();

    $second = $this->postJson('/api/trips', tripPayload())->assertCreated()->json('data');

    // Unchanged behaviour: without via points, corridors are shared.
    expect($second['route']['id'])->toBe($first['route']['id']);
});

it('does not mint a new route every run of the same custom one', function () {
    customRouteDriver();

    $via = [['lat' => VIA_LAT, 'lng' => VIA_LNG]];
    $first = $this->postJson('/api/trips', tripPayload($via))->assertCreated()->json('data');
    $routesAfterFirst = Route::count();
    $this->postJson('/api/trips/'.$first['id'].'/end')->assertOk();

    // Tapped again the next morning, a couple of hundred metres off — a driver
    // aims at a junction from a moving jeepney, they do not hit a coordinate.
    $again = [['lat' => VIA_LAT + 0.0015, 'lng' => VIA_LNG + 0.0015]];
    $second = $this->postJson('/api/trips', tripPayload($again))->assertCreated()->json('data');

    expect($second['route']['id'])->toBe($first['route']['id'])
        // And commuters keep searching against one stable corridor rather than
        // a new near-identical row for every morning of the same run.
        ->and(Route::count())->toBe($routesAfterFirst);
});

it('keeps a custom route even when a corridor to the same town exists', function () {
    customRouteDriver();

    $plain = $this->postJson('/api/trips', tripPayload())->assertCreated()->json('data');
    $this->postJson('/api/trips/'.$plain['id'].'/end')->assertOk();

    $custom = $this->postJson('/api/trips', tripPayload([['lat' => VIA_LAT, 'lng' => VIA_LNG]]))
        ->assertCreated()
        ->json('data');

    // Handing the driver the existing corridor would throw away the one thing
    // they just took the trouble to tell us.
    expect($custom['route']['id'])->not->toBe($plain['route']['id']);
});

it('refuses a via point that is not a place on earth', function () {
    customRouteDriver();

    $this->postJson('/api/trips', tripPayload([['lat' => 99, 'lng' => 120.8]]))->assertUnprocessable();
    $this->postJson('/api/trips', tripPayload([['lng' => 120.8]]))->assertUnprocessable();

    // A jeepney route is a handful of roads, not a hundred.
    $tooMany = array_fill(0, 9, ['lat' => VIA_LAT, 'lng' => VIA_LNG]);
    $this->postJson('/api/trips', tripPayload($tooMany))->assertUnprocessable();
});

it('lets a driver change the roads mid-run without ending the trip', function () {
    customRouteDriver();

    $trip = $this->postJson('/api/trips', tripPayload())->assertCreated()->json('data');

    $rerouted = $this->patchJson('/api/trips/'.$trip['id'].'/route', tripPayload([['lat' => VIA_LAT, 'lng' => VIA_LNG]]))
        ->assertOk()
        ->json('data');

    expect($rerouted['id'])->toBe($trip['id'])
        ->and($rerouted['route']['id'])->not->toBe($trip['route']['id'])
        ->and(Trip::find($trip['id'])->ended_at)->toBeNull();
});
